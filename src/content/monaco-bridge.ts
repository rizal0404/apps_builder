/**
 * Apps Script editor MAIN-world bridge.
 *
 * Runs in the page's JS world (NOT the extension's isolated world), so it can reach
 * `window.monaco`. Communicates with the ISOLATED world content script via
 * `window.postMessage` using the request/response shape declared below.
 *
 * Contract (request → response by `requestId`):
 *
 *   { source: 'gaspoll', kind: 'ping' }
 *     → { source: 'gaspoll/main', kind: 'pong', monaco: boolean, editors: number }
 *
 *   { source: 'gaspoll', kind: 'getActiveModelText' }
 *     → { source: 'gaspoll/main', kind: 'activeModelText', text: string|null,
 *         uri: string|null }
 *
 *   { source: 'gaspoll', kind: 'replaceActiveModelText', text: string }
 *     → { source: 'gaspoll/main', kind: 'replaceResult', ok: boolean, error?: string }
 *
 * The bridge is a best-effort fallback used only when the Apps Script REST API is
 * unavailable. It cannot create new files; for that you need the REST API.
 */

interface MonacoEditorLike {
  getModel(): MonacoModelLike | null;
  hasTextFocus?(): boolean;
  executeEdits(
    source: string,
    edits: Array<{
      range: unknown;
      text: string;
      forceMoveMarkers?: boolean;
    }>,
  ): boolean;
  getModel_?: never;
}

interface MonacoModelLike {
  uri: { toString(): string };
  getValue(): string;
  getFullModelRange(): unknown;
}

interface MonacoNamespace {
  editor: {
    getEditors(): MonacoEditorLike[];
    getModels?: () => MonacoModelLike[];
  };
}

interface BridgeRequest {
  source: 'gaspoll';
  requestId: string;
  kind: 'ping' | 'getActiveModelText' | 'replaceActiveModelText';
  text?: string;
}

function getMonaco(): MonacoNamespace | null {
  const w = window as unknown as { monaco?: MonacoNamespace };
  return w.monaco ?? null;
}

function pickActiveEditor(monaco: MonacoNamespace): MonacoEditorLike | null {
  const editors = monaco.editor.getEditors?.() ?? [];
  if (editors.length === 0) return null;
  const focused = editors.find((e) => e.hasTextFocus?.());
  return focused ?? editors[0]!;
}

function reply(req: BridgeRequest, payload: Record<string, unknown>): void {
  window.postMessage(
    {
      source: 'gaspoll/main',
      requestId: req.requestId,
      ...payload,
    },
    window.location.origin,
  );
}

window.addEventListener('message', (ev) => {
  if (ev.source !== window) return;
  const data = ev.data as BridgeRequest | null;
  if (!data || data.source !== 'gaspoll' || !data.requestId) return;

  const monaco = getMonaco();
  switch (data.kind) {
    case 'ping': {
      reply(data, {
        kind: 'pong',
        monaco: !!monaco,
        editors: monaco?.editor.getEditors?.().length ?? 0,
      });
      return;
    }
    case 'getActiveModelText': {
      if (!monaco) return reply(data, { kind: 'activeModelText', text: null, uri: null });
      const editor = pickActiveEditor(monaco);
      const model = editor?.getModel() ?? null;
      reply(data, {
        kind: 'activeModelText',
        text: model?.getValue() ?? null,
        uri: model?.uri.toString() ?? null,
      });
      return;
    }
    case 'replaceActiveModelText': {
      if (!monaco) {
        reply(data, { kind: 'replaceResult', ok: false, error: 'Monaco not loaded' });
        return;
      }
      const editor = pickActiveEditor(monaco);
      const model = editor?.getModel() ?? null;
      if (!editor || !model) {
        reply(data, { kind: 'replaceResult', ok: false, error: 'No active editor' });
        return;
      }
      try {
        editor.executeEdits('gaspoll', [
          {
            range: model.getFullModelRange(),
            text: data.text ?? '',
            forceMoveMarkers: true,
          },
        ]);
        reply(data, { kind: 'replaceResult', ok: true });
      } catch (err) {
        reply(data, {
          kind: 'replaceResult',
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }
  }
});

console.info('[GASPOLL] monaco-bridge (MAIN world) ready');
