import { ProviderId } from '@/shared/constants';
import type { ChatMessage } from '@/shared/types';
import { parseSseStream } from './sse';
import type {
  IProvider,
  ProviderChatChunk,
  ProviderChatRequest,
  ProviderChatResult,
} from './types';

const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  text?: string;
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

export const geminiProvider: IProvider = {
  id: ProviderId.GEMINI,

  async streamChat(
    req: ProviderChatRequest,
    onChunk: (c: ProviderChatChunk) => void,
  ): Promise<ProviderChatResult> {
    const url =
      `${ENDPOINT_BASE}/${encodeURIComponent(req.model)}:streamGenerateContent` +
      `?alt=sse&key=${encodeURIComponent(req.apiKey)}`;
    const body: Record<string, unknown> = {
      contents: buildContents(req.messages),
    };
    if (req.systemPrompt) {
      body.systemInstruction = { parts: [{ text: req.systemPrompt }] };
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
};
