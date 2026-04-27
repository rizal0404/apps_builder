import { MsgType } from '@/shared/constants';

/**
 * Background service worker — central router.
 *
 * Phase 0: minimal stub. It only:
 *   - announces itself in the console on install
 *   - responds to PING messages so we can verify content/sidepanel ↔ background wiring
 *
 * Real responsibilities (added in later phases):
 *   - AI provider routing (OpenRouter, Gemini, ...)
 *   - chrome.identity OAuth + Apps Script REST API client
 *   - Storage facade (settings + chat history)
 */

chrome.runtime.onInstalled.addListener((details) => {
  console.info('[GASPOLL] installed', details.reason);
});

// Allow clicking the toolbar icon to toggle the side panel on the active tab.
chrome.runtime.onInstalled.addListener(() => {
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
      // Unknown message: ignore for now.
      return undefined;
  }
});
