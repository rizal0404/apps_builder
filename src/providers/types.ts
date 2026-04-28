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

/** Structured tool_call carried on an assistant wire message. */
export interface WireToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/**
 * Wire-level message shape sent to tool-calling providers. Unlike `ChatMessage`,
 * this preserves the OpenAI tool-calling protocol: assistant messages can carry
 * structured `tool_calls`, and tool-role messages reference a previous
 * `tool_call_id` plus the function `name` (needed by Gemini's
 * `functionResponse.name`).
 */
export type WireMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | { role: 'assistant'; content: string; tool_calls: WireToolCall[] }
  | { role: 'tool'; tool_call_id: string; name: string; content: string };

export interface ProviderChatRequestWithTools extends Omit<ProviderChatRequest, 'messages'> {
  /**
   * Full conversation history for the current iteration, including any
   * prior assistant-with-tool_calls messages and their matching tool results
   * in the exact order required by the OpenAI / Gemini tool-calling protocols.
   */
  messages: WireMessage[];
  tools: Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
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
