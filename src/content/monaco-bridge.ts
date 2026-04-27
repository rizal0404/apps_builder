/**
 * Content script (MAIN world) — runs in the page's JS context so it can reach
 * `window.monaco` and the Apps Script editor model.
 *
 * Phase 0: just announces itself. In Phase 2+ we will:
 *   - wait for `window.monaco` to be available
 *   - locate the active editor instance
 *   - expose a small RPC bridge over `window.postMessage` so the ISOLATED-world
 *     content script can request `executeEdits` operations.
 */

(() => {
  console.info('[GASPOLL] monaco-bridge (MAIN world) ready');
})();
