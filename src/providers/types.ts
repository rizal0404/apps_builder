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

// ── Phase 4: Tool calling types ─────────────────────────────────────────────────

export interface ProviderToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

export interface ProviderChatRequestWithTools extends ProviderChatRequest {
  tools: Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>;
  /** Tool results from previous iterations (OpenAI format). */
  toolMessages?: Array<{
    role: 'tool';
    tool_call_id: string;
    content: string;
  }>;
}

export interface ProviderChatResultWithTools extends ProviderChatResult {
  toolCalls?: ProviderToolCall[];
}

export interface IProvider {
  id: ProviderId;
  /** Stream completion. The implementation MUST resolve only after the stream completes. */
  streamChat(
    req: ProviderChatRequest,
    onChunk: (c: ProviderChatChunk) => void,
  ): Promise<ProviderChatResult>;

  /** Stream completion with tool/function calling support (Phase 4). */
  streamChatWithTools?(
    req: ProviderChatRequestWithTools,
    onChunk: (c: ProviderChatChunk) => void,
  ): Promise<ProviderChatResultWithTools>;
}

