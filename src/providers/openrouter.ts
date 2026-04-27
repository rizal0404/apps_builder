import { ProviderId } from '@/shared/constants';
import type { ChatMessage } from '@/shared/types';
import { parseSseStream } from './sse';
import type {
  IProvider,
  ProviderChatChunk,
  ProviderChatRequest,
  ProviderChatResult,
} from './types';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterStreamChunk {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
}

function buildMessages(systemPrompt: string | undefined, messages: ChatMessage[]) {
  const out: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (systemPrompt) out.push({ role: 'system', content: systemPrompt });
  for (const m of messages) out.push({ role: m.role, content: m.content });
  return out;
}

export const openRouterProvider: IProvider = {
  id: ProviderId.OPENROUTER,

  async streamChat(
    req: ProviderChatRequest,
    onChunk: (c: ProviderChatChunk) => void,
  ): Promise<ProviderChatResult> {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${req.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/rizal0404/apps_builder',
        'X-Title': 'GASPOLL',
      },
      body: JSON.stringify({
        model: req.model,
        stream: true,
        messages: buildMessages(req.systemPrompt, req.messages),
      }),
      signal: req.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenRouter request failed: ${res.status} ${res.statusText} — ${text}`);
    }

    let fullText = '';
    let finishReason: string | null = null;
    for await (const data of parseSseStream(res.body)) {
      if (data === '[DONE]') break;
      let json: OpenRouterStreamChunk;
      try {
        json = JSON.parse(data) as OpenRouterStreamChunk;
      } catch {
        continue; // ignore keep-alive / non-JSON frames
      }
      const choice = json.choices?.[0];
      const delta = choice?.delta?.content;
      if (delta) {
        fullText += delta;
        onChunk({ delta });
      }
      if (choice?.finish_reason) finishReason = choice.finish_reason;
    }
    return { text: fullText, finishReason };
  },
};
