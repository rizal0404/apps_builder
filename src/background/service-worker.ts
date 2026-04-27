import { MsgType, PortName, ProviderId } from '@/shared/constants';
import { getApiKey } from '@/shared/storage';
import type { ChatRequest } from '@/shared/types';
import { getProvider } from '@/providers/registry';
import {
  AppsScriptApiError,
  getProjectContent,
  updateProjectContent,
} from '@/shared/appsScriptApi';
import { applyPatch, buildPatch, type ProjectPatch } from '@/shared/patch';

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

function toErrorPayload(err: unknown): { ok: false; error: string; code?: string } {
  if (err instanceof AppsScriptApiError) {
    return {
      ok: false,
      error: err.message,
      code: err.status === 403 ? 'apps_script_api_disabled' : `http_${err.status}`,
    };
  }
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || !('type' in msg)) return undefined;
  switch (msg.type) {
    case MsgType.PING:
      sendResponse({ ok: true, pong: Date.now() });
      return undefined;
    case MsgType.GET_PROJECT_CONTENT:
      void (async () => {
        try {
          const content = await getProjectContent((msg as { scriptId: string }).scriptId);
          sendResponse({ ok: true, content });
        } catch (err) {
          sendResponse(toErrorPayload(err));
        }
      })();
      return true;
    case MsgType.BUILD_PATCH:
      void (async () => {
        try {
          const { scriptId, files } = msg as {
            scriptId: string;
            files: import('@/shared/codeBlocks').ExtractedFile[];
          };
          const patch = await buildPatch(scriptId, files);
          sendResponse({ ok: true, patch });
        } catch (err) {
          sendResponse(toErrorPayload(err));
        }
      })();
      return true;
    case MsgType.APPLY_PATCH:
      void (async () => {
        try {
          await applyPatch((msg as { patch: ProjectPatch }).patch);
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse(toErrorPayload(err));
        }
      })();
      return true;
    case MsgType.UPDATE_PROJECT_CONTENT:
      void (async () => {
        try {
          const { scriptId, files } = msg as {
            scriptId: string;
            files: import('@/shared/appsScriptApi').AppsScriptFile[];
          };
          const content = await updateProjectContent(scriptId, files);
          sendResponse({ ok: true, content });
        } catch (err) {
          sendResponse(toErrorPayload(err));
        }
      })();
      return true;
    default:
      return undefined;
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PortName.CHAT) return;
  let aborter: AbortController | null = null;
  let connected = true;

  /** Best-effort postMessage that swallows errors once the port is gone. */
  const safePost = (m: unknown) => {
    if (!connected) return;
    try {
      port.postMessage(m);
    } catch {
      connected = false;
    }
  };

  port.onDisconnect.addListener(() => {
    connected = false;
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
        safePost({
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
        ({ delta }) => safePost({ type: MsgType.AI_CHAT_CHUNK, delta }),
      );
      safePost({ type: MsgType.AI_CHAT_DONE, finishReason: result.finishReason });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      safePost({ type: MsgType.AI_CHAT_ERROR, error });
    } finally {
      aborter = null;
    }
  });
});
