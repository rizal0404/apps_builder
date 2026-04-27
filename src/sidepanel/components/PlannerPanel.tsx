/**
 * Phase 4 — Autonomous mode planner panel.
 *
 * Shows a step-by-step log of the planner's tool calls and AI responses,
 * with a progress indicator, cancel button, and summary view.
 */

import { useEffect, useRef, useState } from 'react';
import type { PlannerStep, PlannerStatus } from '../usePlannerSession';

interface Props {
  status: PlannerStatus;
  steps: PlannerStep[];
  progressText: string;
  error: string | null;
  summary: string | null;
  onCancel: () => void;
  onReset: () => void;
  onClose: () => void;
}

function StepIcon({ kind }: { kind: PlannerStep['kind'] }) {
  switch (kind) {
    case 'iteration':
      return <span className="text-gaspoll-500">🔄</span>;
    case 'tool_call':
      return <span className="text-amber-500">🔧</span>;
    case 'tool_result':
      return <span className="text-emerald-500">📋</span>;
    case 'progress':
      return <span className="text-blue-500">💬</span>;
    case 'done':
      return <span className="text-emerald-600">✅</span>;
    case 'error':
      return <span className="text-rose-500">❌</span>;
  }
}

function StepItem({ step }: { step: PlannerStep }) {
  const [expanded, setExpanded] = useState(false);

  const hasDetail =
    (step.toolCall && Object.keys(step.toolCall.arguments).length > 0) ||
    (step.toolResult && step.toolResult.result.length > 80);

  return (
    <div className="border-b border-slate-100 px-3 py-2">
      <div
        className={`flex items-start gap-2 text-xs ${hasDetail ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetail && setExpanded((e) => !e)}
      >
        <StepIcon kind={step.kind} />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-700">{step.text}</div>
          {step.iteration && (
            <div className="mt-0.5">
              <div className="h-1.5 w-full rounded-full bg-slate-200">
                <div
                  className="h-1.5 rounded-full bg-gaspoll-500 transition-all"
                  style={{
                    width: `${(step.iteration.current / step.iteration.max) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
        {hasDetail && (
          <span className="mt-0.5 text-[10px] text-slate-400">{expanded ? '▼' : '▶'}</span>
        )}
      </div>
      {expanded && step.toolCall && (
        <pre className="mt-1 ml-6 overflow-x-auto rounded bg-slate-50 p-2 text-[10px] text-slate-600">
          {JSON.stringify(step.toolCall.arguments, null, 2)}
        </pre>
      )}
      {expanded && step.toolResult && (
        <pre className="mt-1 ml-6 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-600">
          {step.toolResult.result}
        </pre>
      )}
    </div>
  );
}

export function PlannerPanel({
  status,
  steps,
  progressText,
  error,
  summary,
  onCancel,
  onReset,
  onClose,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [steps, progressText]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">🤖 Autonomous Mode</span>
            {status === 'running' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gaspoll-50 px-2 py-0.5 text-[10px] font-medium text-gaspoll-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gaspoll-500" />
                Running
              </span>
            )}
            {status === 'done' && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                Complete
              </span>
            )}
            {status === 'error' && (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                Error
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500">
            {steps.filter((s) => s.kind === 'tool_call').length} tool calls ·{' '}
            {steps.filter((s) => s.kind === 'iteration').length} iterations
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          Close
        </button>
      </header>

      {/* Steps log */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {steps.map((step) => (
          <StepItem key={step.id} step={step} />
        ))}

        {/* Live progress text (not yet flushed to a step) */}
        {progressText && status === 'running' && (
          <div className="border-b border-slate-100 px-3 py-2">
            <div className="flex items-start gap-2 text-xs">
              <span className="text-blue-500">💬</span>
              <div className="min-w-0 flex-1 whitespace-pre-wrap text-slate-600">
                {progressText}
                <span className="animate-pulse">▊</span>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        {summary && status === 'done' && (
          <div className="m-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
            <div className="mb-1 font-semibold">Plan completed</div>
            <div className="whitespace-pre-wrap">{summary}</div>
          </div>
        )}

        {/* Error */}
        {error && status === 'error' && (
          <div className="m-3 rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
            <div className="mb-1 font-semibold">Error</div>
            <div>{error}</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <div className="text-slate-500">
          {status === 'running'
            ? 'The AI agent is working…'
            : status === 'done'
              ? 'You can close this panel or start a new plan.'
              : status === 'error'
                ? 'The plan encountered an error.'
                : ''}
        </div>
        <div className="flex gap-2">
          {status === 'running' && (
            <button
              onClick={onCancel}
              className="rounded bg-rose-600 px-3 py-1 font-semibold text-white hover:bg-rose-700"
            >
              Cancel
            </button>
          )}
          {(status === 'done' || status === 'error') && (
            <button
              onClick={onReset}
              className="rounded border border-slate-300 px-3 py-1 text-slate-700 hover:bg-white"
            >
              New Plan
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
