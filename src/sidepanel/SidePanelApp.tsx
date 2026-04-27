import { useEffect, useState } from 'react';
import { APP_NAME, APP_TAGLINE, MsgType } from '@/shared/constants';

type BackgroundStatus = 'unknown' | 'ok' | 'error';

export function SidePanelApp() {
  const [bgStatus, setBgStatus] = useState<BackgroundStatus>('unknown');
  const [bgPong, setBgPong] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    chrome.runtime
      .sendMessage({ type: MsgType.PING })
      .then((res: { ok?: boolean; pong?: number } | undefined) => {
        if (!mounted) return;
        if (res?.ok) {
          setBgStatus('ok');
          setBgPong(res.pong ?? null);
        } else {
          setBgStatus('error');
        }
      })
      .catch(() => mounted && setBgStatus('error'));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <div className="text-lg font-semibold tracking-tight text-gaspoll-600">{APP_NAME}</div>
          <div className="text-xs text-slate-500">{APP_TAGLINE}</div>
        </div>
        <span
          className={
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ' +
            (bgStatus === 'ok'
              ? 'bg-emerald-50 text-emerald-700'
              : bgStatus === 'error'
                ? 'bg-rose-50 text-rose-700'
                : 'bg-slate-100 text-slate-600')
          }
          title={bgPong ? `pong @ ${new Date(bgPong).toISOString()}` : ''}
        >
          <span
            className={
              'h-1.5 w-1.5 rounded-full ' +
              (bgStatus === 'ok'
                ? 'bg-emerald-500'
                : bgStatus === 'error'
                  ? 'bg-rose-500'
                  : 'bg-slate-400')
            }
          />
          {bgStatus === 'ok' ? 'connected' : bgStatus === 'error' ? 'error' : 'connecting…'}
        </span>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-semibold text-slate-800">Hello, GASPOLL!</h2>
          <p className="mt-1 text-sm text-slate-600">
            Phase 0 skeleton is alive. Open a project on{' '}
            <code className="rounded bg-white px-1 py-0.5 text-xs">script.google.com</code> and the
            content script will announce itself in the page console.
          </p>
        </section>

        <section className="mt-4 space-y-2 text-sm text-slate-600">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Coming next
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>OpenRouter + Gemini providers (Phase 1)</li>
            <li>Apps Script REST API integration (Phase 2)</li>
            <li>Templates & design skills (Phase 3)</li>
            <li>Autonomous mode + publish (Phase 4)</li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-slate-200 px-4 py-2 text-[11px] text-slate-400">
        v0.1.0 · Phase 0 · Not affiliated with Google LLC
      </footer>
    </div>
  );
}
