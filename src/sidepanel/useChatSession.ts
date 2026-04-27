import { useCallback, useEffect, useReducer, useRef } from 'react';
import { MsgType, PortName, ProviderId } from '@/shared/constants';
import { generateId } from '@/shared/id';
import { appendMessage, listMessages, saveConversation } from '@/shared/db';
import type { ChatMessage, ChatRequest, Conversation } from '@/shared/types';

type State = {
  messages: ChatMessage[];
  pending: boolean;
  streamingId: string | null;
  error: string | null;
};

type Action =
  | { type: 'load'; messages: ChatMessage[] }
  | { type: 'append'; message: ChatMessage }
  | { type: 'startStream'; messageId: string }
  | { type: 'streamChunk'; messageId: string; delta: string }
  | { type: 'finishStream' }
  | { type: 'error'; error: string }
  | { type: 'reset' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load':
      return { messages: action.messages, pending: false, streamingId: null, error: null };
    case 'append':
      return { ...state, messages: [...state.messages, action.message], error: null };
    case 'startStream':
      return { ...state, pending: true, streamingId: action.messageId, error: null };
    case 'streamChunk': {
      const idx = state.messages.findIndex((m) => m.id === action.messageId);
      if (idx < 0) return state;
      const next = state.messages.slice();
      next[idx] = { ...next[idx], content: next[idx].content + action.delta };
      return { ...state, messages: next };
    }
    case 'finishStream':
      return { ...state, pending: false, streamingId: null };
    case 'error':
      return { ...state, pending: false, streamingId: null, error: action.error };
    case 'reset':
      return { messages: [], pending: false, streamingId: null, error: null };
  }
}

export interface ChatSessionOptions {
  conversation: Conversation | null;
  systemPrompt: string;
  /** Called once after persisting a fresh conversation (e.g. to refresh the sidebar list). */
  onConversationSaved?: (c: Conversation) => void;
}

export function useChatSession({
  conversation,
  systemPrompt,
  onConversationSaved,
}: ChatSessionOptions) {
  const [state, dispatch] = useReducer(reducer, {
    messages: [],
    pending: false,
    streamingId: null,
    error: null,
  });

  const portRef = useRef<chrome.runtime.Port | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const conversationRef = useRef<Conversation | null>(conversation);
  conversationRef.current = conversation;

  // Load history whenever conversation changes.
  useEffect(() => {
    let alive = true;
    if (!conversation) {
      dispatch({ type: 'reset' });
      return;
    }
    const id = conversation.id;
    void listMessages(id).then((m) => {
      if (alive) dispatch({ type: 'load', messages: m });
    });
    return () => {
      alive = false;
    };
  }, [conversation]);

  // Open / close the streaming port.
  useEffect(() => {
    const port = chrome.runtime.connect({ name: PortName.CHAT });
    portRef.current = port;
    port.onMessage.addListener(async (raw) => {
      if (!raw || typeof raw !== 'object' || !('type' in raw)) return;
      const id = streamingIdRef.current;
      if (raw.type === MsgType.AI_CHAT_CHUNK && id) {
        dispatch({ type: 'streamChunk', messageId: id, delta: raw.delta as string });
      } else if (raw.type === MsgType.AI_CHAT_DONE) {
        const c = conversationRef.current;
        if (id && c) {
          // Persist the final assistant message to IDB.
          // (We only know the final content from the reducer; pull it on next tick.)
          const cur = (await listMessages(c.id)).find((m) => m.id === id);
          // Fallback path: if the reducer message hasn't been replicated yet (rare under
          // concurrent updates), append from in-memory state by reconciling later.
          if (!cur) {
            // We grab the latest assistant message from the in-memory messages via a microtask.
            queueMicrotask(async () => {
              const latest = stateRef.current.messages.find((m) => m.id === id);
              if (latest) await appendMessage(c.id, latest);
              await saveConversation({ ...c, updatedAt: Date.now() });
            });
          } else {
            await saveConversation({ ...c, updatedAt: Date.now() });
          }
        }
        dispatch({ type: 'finishStream' });
      } else if (raw.type === MsgType.AI_CHAT_ERROR) {
        dispatch({ type: 'error', error: String(raw.error) });
      }
    });
    return () => {
      port.disconnect();
      portRef.current = null;
    };
  }, []);

  // Mirror state into a ref so the port handler can read the latest message text.
  const stateRef = useRef(state);
  stateRef.current = state;

  const sendUserMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !conversationRef.current) return;
      const c = conversationRef.current;
      const userMsg: ChatMessage = {
        id: generateId('msg'),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      };
      const assistantId = generateId('msg');
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now() + 1,
      };
      dispatch({ type: 'append', message: userMsg });
      dispatch({ type: 'append', message: assistantMsg });
      dispatch({ type: 'startStream', messageId: assistantId });
      streamingIdRef.current = assistantId;

      await appendMessage(c.id, userMsg);
      await saveConversation({ ...c, updatedAt: Date.now() });
      onConversationSaved?.({ ...c, updatedAt: Date.now() });

      const req: ChatRequest = {
        conversationId: c.id,
        scriptId: c.scriptId,
        providerId: c.providerId as ProviderId,
        model: c.model,
        systemPrompt,
        messages: [...stateRef.current.messages, userMsg].filter(
          (m) => m.role !== 'assistant' || m.content,
        ),
      };
      portRef.current?.postMessage(req);
    },
    [systemPrompt, onConversationSaved],
  );

  // After streaming finishes, persist the assistant message that lives only in reducer state.
  useEffect(() => {
    if (state.pending) return;
    const id = streamingIdRef.current;
    if (!id) return;
    const c = conversationRef.current;
    if (!c) return;
    const finalMsg = state.messages.find((m) => m.id === id);
    if (finalMsg && finalMsg.content) {
      void appendMessage(c.id, finalMsg);
    }
    streamingIdRef.current = null;
  }, [state.pending, state.messages]);

  const cancel = useCallback(() => {
    portRef.current?.postMessage({ type: 'cancel' });
  }, []);

  return { ...state, sendUserMessage, cancel };
}
