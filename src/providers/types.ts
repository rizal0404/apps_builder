import type { ChatMessage } from '@/shared/types';
import type { ProviderId } from '@/shared/constants';

export interface ProviderChatRequest {
  apiKey: string;
  model: string;
  systemPrompt?: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

export interface ProviderChatChunk {
  delta: string;
}

export interface ProviderChatResult {
  finishReason: string | null;
  /** Concatenated full text streamed back. */
  text: string;
}

export interface IProvider {
  id: ProviderId;
  /** Stream completion. The implementation MUST resolve only after the stream completes. */
  streamChat(
    req: ProviderChatRequest,
    onChunk: (c: ProviderChatChunk) => void,
  ): Promise<ProviderChatResult>;
}
