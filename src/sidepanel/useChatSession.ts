import { useCallback, useEffect, useReducer, useRef } from 'react';
import { MsgType, PortName, ProviderId, FRONTEND_STACKS, DESIGN_SKILLS } from '@/shared/constants';
import type { FrontendStackId, DesignSkillId } from '@/shared/constants';
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
  frontendStack?: FrontendStackId;
  designSkill?: DesignSkillId;
  /** Called once after persisting a fresh conversation (e.g. to refresh the sidebar list). */
  onConversationSaved?: (c: Conversation) => void;
}

export function useChatSession({
  conversation,
  systemPrompt,
  frontendStack,
  designSkill,
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

  // Load history when the conversation identity changes. We deliberately depend on the id
  // (not the full object) so metadata updates — model picker, provider switch, updatedAt
  // bumps — do NOT reset the in-memory transcript or wipe the streaming state mid-stream.
  const conversationId = conversation?.id ?? null;
  useEffect(() => {
    let alive = true;
    if (!conversationId) {
      dispatch({ type: 'reset' });
      return;
    }
    void listMessages(conversationId).then((m) => {
      if (alive) dispatch({ type: 'load', messages: m });
    });
    return () => {
      alive = false;
    };
  }, [conversationId]);

  // Open / close the streaming port.
  // MV3 service workers can go idle and terminate, disconnecting all ports.
  // We auto-reconnect on disconnect to keep the chat working.
  useEffect(() => {
    let disposed = false;

    function onPortMessage(raw: unknown) {
      if (!raw || typeof raw !== 'object' || !('type' in (raw as Record<string, unknown>)))
        return;
      const msg = raw as Record<string, unknown>;
      const id = streamingIdRef.current;
      if (msg.type === MsgType.AI_CHAT_CHUNK && id) {
        dispatch({ type: 'streamChunk', messageId: id, delta: msg.delta as string });
      } else if (msg.type === MsgType.AI_CHAT_DONE) {
        const c = conversationRef.current;
        if (id && c) {
          void (async () => {
            const cur = (await listMessages(c.id)).find((m) => m.id === id);
            if (!cur) {
              queueMicrotask(async () => {
                const latest = stateRef.current.messages.find((m) => m.id === id);
                if (latest) await appendMessage(c.id, latest);
                await saveConversation({ ...c, updatedAt: Date.now() });
              });
            } else {
              await saveConversation({ ...c, updatedAt: Date.now() });
            }
          })();
        }
        dispatch({ type: 'finishStream' });
      } else if (msg.type === MsgType.AI_CHAT_ERROR) {
        dispatch({ type: 'error', error: String(msg.error) });
      }
    }

    function connect() {
      if (disposed) return;
      const port = chrome.runtime.connect({ name: PortName.CHAT });
      portRef.current = port;
      port.onMessage.addListener(onPortMessage);
      port.onDisconnect.addListener(() => {
        portRef.current = null;
        // Auto-reconnect after a brief delay (SW may be restarting)
        if (!disposed) setTimeout(connect, 200);
      });
    }

    connect();
    return () => {
      disposed = true;
      portRef.current?.disconnect();
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

      // Build contextual system prompt with stack/design preferences
      let contextualPrompt = systemPrompt;
      const contextLines: string[] = [];
      if (frontendStack && frontendStack !== 'auto') {
        const label = FRONTEND_STACKS.find((s) => s.id === frontendStack)?.label ?? frontendStack;
        contextLines.push(`[Context] Frontend Stack: ${label}`);
      }
      if (designSkill && designSkill !== 'auto') {
        const label = DESIGN_SKILLS.find((s) => s.id === designSkill)?.label ?? designSkill;
        contextLines.push(`[Context] Design Style: ${label}`);
      }
      if (contextLines.length) {
        contextualPrompt = contextLines.join('\n') + '\n\n' + systemPrompt;
      }

      const req: ChatRequest = {
        conversationId: c.id,
        scriptId: c.scriptId,
        providerId: c.providerId as ProviderId,
        model: c.model,
        systemPrompt: contextualPrompt,
        messages: [...stateRef.current.messages, userMsg].filter(
          (m) => m.role !== 'assistant' || m.content,
        ),
      };
      const port = portRef.current;
      if (!port) {
        dispatch({ type: 'error', error: 'Connection to background worker lost. Please try again.' });
        return;
      }
      try {
        port.postMessage(req);
      } catch {
        dispatch({ type: 'error', error: 'Connection to background worker lost. Please try again.' });
      }
    },
    [systemPrompt, frontendStack, designSkill, onConversationSaved],
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
