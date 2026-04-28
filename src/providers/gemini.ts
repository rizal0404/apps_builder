import { ProviderId } from '@/shared/constants';
import type { ChatMessage } from '@/shared/types';
import { parseSseStream } from './sse';
import type {
  IProvider,
  ProviderChatChunk,
  ProviderChatRequest,
  ProviderChatRequestWithTools,
  ProviderChatResult,
  ProviderChatResultWithTools,
  ProviderToolCall,
  WireMessage,
} from './types';

const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[]; role?: string };
  finishReason?: string;
}

interface GeminiStreamChunk {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
}

/** Map our chat history into Gemini's `contents` array (role: 'user' | 'model'). */
function buildContents(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
}

/**
 * Map our WireMessage history into Gemini's `contents` array, preserving the
 * interleaving of `functionCall` (model) and `functionResponse` (function)
 * parts required by the Gemini tool-calling protocol.
 */
function buildContentsFromWire(messages: WireMessage[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.role === 'tool') {
      // tool result → function response keyed by the original function name
      let responsePayload: Record<string, unknown>;
      try {
        const parsed = JSON.parse(m.content) as unknown;
        responsePayload =
          parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : { content: m.content };
      } catch {
        responsePayload = { content: m.content };
      }
      out.push({
        role: 'function',
        parts: [
          {
            functionResponse: {
              name: m.name,
              response: responsePayload,
            },
          },
        ],
      });
      continue;
    }
    if (m.role === 'assistant' && 'tool_calls' in m && m.tool_calls.length) {
      const parts: Array<Record<string, unknown>> = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.tool_calls) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }
        parts.push({ functionCall: { name: tc.function.name, args } });
      }
      out.push({ role: 'model', parts });
      continue;
    }
    // Plain user/assistant text message
    out.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  }
  return out;
}

export const geminiProvider: IProvider = {
  id: ProviderId.GEMINI,

  async streamChat(
    req: ProviderChatRequest,
    onChunk: (c: ProviderChatChunk) => void,
  ): Promise<ProviderChatResult> {
    const url = `${ENDPOINT_BASE}/${encodeURIComponent(req.model)}:streamGenerateContent?alt=sse`;
    const body: Record<string, unknown> = {
      contents: buildContents(req.messages),
    };
    if (req.systemPrompt) {
      body.systemInstruction = { parts: [{ text: req.systemPrompt }] };
    }
    // Send the API key via the header rather than as a URL query parameter so it
    // doesn't end up in chrome://net-export logs, proxy access logs, etc.
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': req.apiKey,
      },
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini request failed: ${res.status} ${res.statusText} — ${text}`);
    }

    let fullText = '';
    let finishReason: string | null = null;
    for await (const data of parseSseStream(res.body)) {
      if (data === '[DONE]') break;
      let json: GeminiStreamChunk;
      try {
        json = JSON.parse(data) as GeminiStreamChunk;
      } catch {
        continue;
      }
      if (json.promptFeedback?.blockReason) {
        throw new Error(`Gemini blocked the request: ${json.promptFeedback.blockReason}`);
      }
      const cand = json.candidates?.[0];
      const parts = cand?.content?.parts ?? [];
      for (const p of parts) {
        if (p.text) {
          fullText += p.text;
          onChunk({ delta: p.text });
        }
      }
      if (cand?.finishReason) finishReason = cand.finishReason;
    }
    return { text: fullText, finishReason };
  },

  async streamChatWithTools(
    req: ProviderChatRequestWithTools,
    onChunk: (c: ProviderChatChunk) => void,
  ): Promise<ProviderChatResultWithTools> {
    const url = `${ENDPOINT_BASE}/${encodeURIComponent(req.model)}:streamGenerateContent?alt=sse`;

    // Translate the planner's WireMessage[] (which already interleaves
    // assistant(tool_calls) and tool(functionResponse) in order) into Gemini's
    // `contents` array.
    const contents = buildContentsFromWire(req.messages);

    // Convert OpenAI-format tools to Gemini functionDeclarations
    const functionDeclarations = req.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }));

    const body: Record<string, unknown> = {
      contents,
      tools: [{ functionDeclarations }],
    };
    if (req.systemPrompt) {
      body.systemInstruction = { parts: [{ text: req.systemPrompt }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': req.apiKey,
      },
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini request failed: ${res.status} ${res.statusText} — ${text}`);
    }

    let fullText = '';
    let finishReason: string | null = null;
    const toolCalls: ProviderToolCall[] = [];
    let tcIndex = 0;

    for await (const data of parseSseStream(res.body)) {
      if (data === '[DONE]') break;
      let json: GeminiStreamChunk;
      try {
        json = JSON.parse(data) as GeminiStreamChunk;
      } catch {
        continue;
      }
      if (json.promptFeedback?.blockReason) {
        throw new Error(`Gemini blocked the request: ${json.promptFeedback.blockReason}`);
      }
      const cand = json.candidates?.[0];
      const parts = cand?.content?.parts ?? [];
      for (const p of parts) {
        if (p.text) {
          fullText += p.text;
          onChunk({ delta: p.text });
        }
        if (p.functionCall) {
          toolCalls.push({
            id: `gemini_tc_${tcIndex++}`,
            name: p.functionCall.name,
            arguments: JSON.stringify(p.functionCall.args),
          });
        }
      }
      if (cand?.finishReason) finishReason = cand.finishReason;
    }

    return { text: fullText, finishReason, toolCalls: toolCalls.length ? toolCalls : undefined };
  },
};
