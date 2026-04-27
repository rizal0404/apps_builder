/**
 * ISOLATED-world content script for `script.google.com/*`.
 *
 * Responsibilities:
 *   - Health-check from the side panel via `MsgType.PING`.
 *   - Bridge to the MAIN-world `monaco-bridge.ts` for live-typing fallback.
 */

import { MsgType } from '@/shared/constants';

console.info('[GASPOLL] content script loaded on', location.href);

interface PendingRequest {
  resolve: (payload: Record<string, unknown>) => void;
  reject: (err: Error) => void;
  timer: number;
}

const pending = new Map<string, PendingRequest>();

window.addEventListener('message', (ev) => {
  if (ev.source !== window) return;
  const data = ev.data as { source?: string; requestId?: string } | null;
  if (!data || data.source !== 'gaspoll/main' || !data.requestId) return;
  const p = pending.get(data.requestId);
  if (!p) return;
  pending.delete(data.requestId);
  clearTimeout(p.timer);
  p.resolve(data as Record<string, unknown>);
});

function callBridge<T extends Record<string, unknown>>(
  kind: 'ping' | 'getActiveModelText' | 'replaceActiveModelText',
  extra: Record<string, unknown> = {},
  timeoutMs = 2000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const requestId = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timer = window.setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`monaco-bridge timeout for ${kind}`));
    }, timeoutMs);
    pending.set(requestId, {
      resolve: resolve as (p: Record<string, unknown>) => void,
      reject,
      timer,
    });
    window.postMessage({ source: 'gaspoll', requestId, kind, ...extra }, window.location.origin);
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || !('type' in msg)) return undefined;
  if (msg.type === MsgType.PING) {
    sendResponse({ ok: true, where: 'content', url: location.href });
    return true;
  }
  if (msg.type === MsgType.GET_SCRIPT_CONTEXT) {
    void (async () => {
      try {
        const pong = await callBridge<{ monaco: boolean; editors: number }>('ping');
        sendResponse({ ok: true, monacoLoaded: pong.monaco, editors: pong.editors });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true;
  }
  if (msg.type === MsgType.APPLY_PATCH) {
    // Live-typing fallback for the currently focused file. Used when the REST API
    // is unavailable. Does NOT create new files.
    const text = (msg as { text?: string }).text ?? '';
    void (async () => {
      try {
        const result = await callBridge<{ ok: boolean; error?: string }>(
          'replaceActiveModelText',
          { text },
          5000,
        );
        sendResponse(result);
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true;
  }
  return undefined;
});
