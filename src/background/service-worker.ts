import { MsgType, PortName, ProviderId } from '@/shared/constants';
import { getApiKey } from '@/shared/storage';
import type { ChatRequest } from '@/shared/types';
import { getProvider } from '@/providers/registry';

/**
 * Background service worker — central router.
 *
 * Phase 1 responsibilities:
 *   - PING/pong healthcheck
 *   - Streaming chat sessions over a long-lived port (PortName.CHAT)
 *
 * Real responsibilities to add later:
 *   - chrome.identity OAuth + Apps Script REST API client (Phase 2)
 *   - additional providers (Phase 3+)
 */

chrome.runtime.onInstalled.addListener((details) => {
  console.info('[GASPOLL] installed', details.reason);
  chrome.sidePanel
    ?.setPanelBehavior?.({ openPanelOnActionClick: true })
    .catch((err) => console.warn('[GASPOLL] sidePanel.setPanelBehavior failed', err));
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || !('type' in msg)) return undefined;
  switch (msg.type) {
    case MsgType.PING:
      sendResponse({ ok: true, pong: Date.now() });
      return undefined;
    default:
      return undefined;
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PortName.CHAT) return;
  let aborter: AbortController | null = null;

  port.onDisconnect.addListener(() => {
    aborter?.abort();
    aborter = null;
  });

  port.onMessage.addListener(async (msg: ChatRequest | { type: 'cancel' }) => {
    if ('type' in msg && msg.type === 'cancel') {
      aborter?.abort();
      return;
    }
    const req = msg as ChatRequest;
    aborter = new AbortController();
    try {
      const apiKey = await getApiKey(req.providerId as ProviderId);
      if (!apiKey) {
        port.postMessage({
          type: MsgType.AI_CHAT_ERROR,
          error: `Missing API key for provider "${req.providerId}". Open Settings to add it.`,
        });
        return;
      }
      const provider = getProvider(req.providerId as ProviderId);
      const result = await provider.streamChat(
        {
          apiKey,
          model: req.model,
          systemPrompt: req.systemPrompt,
          messages: req.messages,
          signal: aborter.signal,
        },
        ({ delta }) => port.postMessage({ type: MsgType.AI_CHAT_CHUNK, delta }),
      );
      port.postMessage({ type: MsgType.AI_CHAT_DONE, finishReason: result.finishReason });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      port.postMessage({ type: MsgType.AI_CHAT_ERROR, error });
    } finally {
      aborter = null;
    }
  });
});
