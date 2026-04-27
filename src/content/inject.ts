/**
 * Content script (ISOLATED world) injected into https://script.google.com/*.
 *
 * Phase 0: just logs and registers a global ping responder so we can verify
 * the extension is loaded inside the Apps Script editor. Later phases will:
 *   - mount an in-page sidebar iframe next to the Monaco editor
 *   - bridge messages between sidepanel and the MAIN-world Monaco helper
 */

import { MsgType } from '@/shared/constants';

console.info('[GASPOLL] content script loaded on', location.href);

// Respond to PING from the side panel so the UI can confirm the editor tab is "ready".
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === MsgType.PING) {
    sendResponse({ ok: true, where: 'content', url: location.href });
    return true;
  }
  return undefined;
});
