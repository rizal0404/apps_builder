import { useEffect, useMemo, useState } from 'react';
import type { ExtractedFile } from '@/shared/codeBlocks';
import type { FilePatch, ProjectPatch } from '@/shared/patch';
import { applyPatchViaBackground, buildPatchViaBackground } from '../api';
import { DiffView } from './DiffView';

interface Props {
  scriptId: string;
  files: ExtractedFile[];
  onClose: () => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; patch: ProjectPatch }
  | { kind: 'applying'; patch: ProjectPatch }
  | { kind: 'applied' }
  | { kind: 'error'; phase: 'build' | 'apply'; message: string; code?: string };

function badge(op: FilePatch['op']): { text: string; className: string } {
  switch (op) {
    case 'create':
      return { text: 'NEW', className: 'bg-emerald-100 text-emerald-800' };
    case 'update':
      return { text: 'EDIT', className: 'bg-amber-100 text-amber-800' };
    case 'unchanged':
      return { text: 'NOOP', className: 'bg-slate-100 text-slate-500' };
  }
}

export function ReviewPanel({ scriptId, files, onClose }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    setStatus({ kind: 'loading' });
    void buildPatchViaBackground(scriptId, files)
      .then((patch) => {
        if (alive) setStatus({ kind: 'ready', patch });
      })
      .catch((err: Error & { code?: string }) => {
        if (alive)
          setStatus({ kind: 'error', phase: 'build', message: err.message, code: err.code });
      });
    return () => {
      alive = false;
    };
  }, [scriptId, files]);

  const patch = status.kind === 'ready' || status.kind === 'applying' ? status.patch : null;
  const activePatch = useMemo<FilePatch | null>(() => {
    if (!patch) return null;
    return patch.files[activeIdx] ?? patch.files[0] ?? null;
  }, [patch, activeIdx]);

  async function apply() {
    if (!patch) return;
    setStatus({ kind: 'applying', patch });
    try {
      await applyPatchViaBackground(patch);
      setStatus({ kind: 'applied' });
    } catch (err) {
      const e = err as Error & { code?: string };
      setStatus({ kind: 'error', phase: 'apply', message: e.message, code: e.code });
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <div>
          <div className="text-sm font-semibold text-slate-800">Review changes</div>
          <div className="text-[11px] text-slate-500">
            {scriptId === 'unknown'
              ? 'No active Apps Script project — open one in another tab to apply.'
              : `Target script: ${scriptId.slice(0, 12)}…`}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          Close
        </button>
      </header>

      {status.kind === 'loading' ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          Building patch…
        </div>
      ) : status.kind === 'error' ? (
        <div className="m-3 rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
          <div className="font-semibold">
            {status.phase === 'apply' ? 'Failed to apply changes' : 'Failed to build patch'}
          </div>
          <div className="mt-1">{status.message}</div>
          {status.code === 'apps_script_api_disabled' ? (
            <a
              href="https://script.google.com/home/usersettings"
              target="_blank"
              rel="noreferrer"
              className="mt-2 block underline"
            >
              Enable the Apps Script API →
            </a>
          ) : null}
        </div>
      ) : status.kind === 'applied' ? (
        <div className="m-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
          Applied. Reload the editor tab to see the changes.
        </div>
      ) : patch && activePatch ? (
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-44 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50">
            {patch.files.map((f, i) => {
              const b = badge(f.op);
              const active = i === activeIdx;
              return (
                <button
                  key={`${f.type}:${f.name}`}
                  onClick={() => setActiveIdx(i)}
                  className={`flex w-full flex-col gap-0.5 border-b border-slate-200 px-2 py-2 text-left text-xs ${
                    active ? 'bg-white' : 'hover:bg-white/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-slate-800">{f.name}</span>
                    <span className={`rounded px-1.5 text-[10px] font-bold ${b.className}`}>
                      {b.text}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    +{f.diff.stats.added} −{f.diff.stats.removed}
                  </div>
                </button>
              );
            })}
          </aside>
          <section className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-slate-200 px-3 py-2 text-xs text-slate-600">
              <span className="font-mono font-semibold">{activePatch.name}</span>
              <span className="ml-2 text-slate-400">{activePatch.type}</span>
            </div>
            <div className="flex-1 overflow-auto p-2">
              <DiffView diff={activePatch.diff} />
            </div>
          </section>
        </div>
      ) : null}

      <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <div className="text-slate-500">
          {patch
            ? `${patch.files.filter((f) => f.op !== 'unchanged').length} file(s) will change`
            : ''}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1 text-slate-700 hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={
              status.kind !== 'ready' ||
              patch?.files.every((f) => f.op === 'unchanged') ||
              scriptId === 'unknown'
            }
            className="rounded bg-gaspoll-600 px-3 py-1 font-semibold text-white hover:bg-gaspoll-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status.kind === 'applying' ? 'Applying…' : 'Apply to project'}
          </button>
        </div>
      </footer>
    </div>
  );
}
