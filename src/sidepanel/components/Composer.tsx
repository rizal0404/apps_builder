import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { DEFAULT_MODELS, ProviderId } from '@/shared/constants';
import { enhancePromptViaBackground } from '../api';

export type ComposerMode = 'chat' | 'autonomous';

interface Props {
  providerId: ProviderId;
  model: string;
  onProviderChange: (id: ProviderId) => void;
  onModelChange: (model: string) => void;
  onSend: (text: string) => void | Promise<void>;
  onCancel: () => void;
  onStartPlan?: (goal: string) => void;
  pending: boolean;
  disabled: boolean;
  providerKeyMissing: boolean;
  /** Imperative seed: when this changes, the textarea is replaced with the new value. */
  seedText?: { value: string; nonce: number } | null;
  plannerRunning?: boolean;
  onCancelPlan?: () => void;
}

const PROVIDERS: ProviderId[] = [ProviderId.OPENROUTER, ProviderId.GEMINI];

export function Composer({
  providerId,
  model,
  onProviderChange,
  onModelChange,
  onSend,
  onCancel,
  onStartPlan,
  pending,
  disabled,
  providerKeyMissing,
  seedText,
  plannerRunning,
  onCancelPlan,
}: Props) {
  const [text, setText] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [mode, setMode] = useState<ComposerMode>('chat');

  useEffect(() => {
    if (seedText) setText(seedText.value);
  }, [seedText]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const v = text.trim();
    if (!v || disabled) return;

    if (mode === 'autonomous' && onStartPlan) {
      onStartPlan(v);
      setText('');
    } else {
      void onSend(v);
      setText('');
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const enhance = async () => {
    const v = text.trim();
    if (!v || enhancing || pending) return;
    setEnhanceError(null);
    setEnhancing(true);
    try {
      const next = await enhancePromptViaBackground(providerId, model, v);
      if (next) setText(next);
    } catch (err) {
      setEnhanceError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnhancing(false);
    }
  };

  const enhanceDisabled = !text.trim() || enhancing || pending || providerKeyMissing;
  const isRunning = pending || plannerRunning;

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-slate-200 bg-white p-3">
      {/* Mode toggle */}
      <div className="flex items-center gap-1">
        <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[10px] font-medium">
          <button
            type="button"
            onClick={() => setMode('chat')}
            className={`rounded px-2.5 py-1 transition-colors ${
              mode === 'chat'
                ? 'bg-white text-gaspoll-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            💬 Chat
          </button>
          <button
            type="button"
            onClick={() => setMode('autonomous')}
            className={`rounded px-2.5 py-1 transition-colors ${
              mode === 'autonomous'
                ? 'bg-white text-gaspoll-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            🤖 Autonomous
          </button>
        </div>
        {mode === 'autonomous' && (
          <span className="text-[9px] text-slate-400">AI agent with tool calling</span>
        )}
      </div>

      {/* Provider / model picker */}
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <select
          value={providerId}
          onChange={(e) => onProviderChange(e.target.value as ProviderId)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-gaspoll-500 focus:outline-none"
          aria-label="Provider"
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          list={`models-${providerId}`}
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-gaspoll-500 focus:outline-none"
          aria-label="Model"
        />
        <datalist id={`models-${providerId}`}>
          {DEFAULT_MODELS[providerId].map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        placeholder={
          providerKeyMissing
            ? 'Add an API key in Settings to start chatting…'
            : mode === 'autonomous'
              ? 'Describe the goal for the AI agent (e.g. "Create a web app that shows a dashboard")'
              : 'Describe what you want to build (Enter to send, Shift+Enter for newline)'
        }
        rows={3}
        className="w-full resize-none rounded-md border border-slate-300 bg-white p-2 text-sm leading-5 focus:border-gaspoll-500 focus:outline-none"
        disabled={(disabled && !isRunning) || enhancing}
      />

      {enhanceError ? (
        <div className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
          {enhanceError}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={enhance}
          disabled={enhanceDisabled}
          title="Rewrite the prompt to be more specific before sending"
          className="rounded-md border border-gaspoll-300 bg-white px-2 py-1 text-[11px] font-medium text-gaspoll-700 hover:bg-gaspoll-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enhancing ? 'Enhancing…' : '✨ Enhance'}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">
            {isRunning
              ? mode === 'autonomous'
                ? 'Agent running…'
                : 'Streaming…'
              : mode === 'autonomous'
                ? 'Press Enter to start'
                : 'Press Enter to send'}
          </span>
          {isRunning ? (
            <button
              type="button"
              onClick={plannerRunning ? onCancelPlan : onCancel}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={disabled || !text.trim()}
              className={`rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300 ${
                mode === 'autonomous'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-gaspoll-600 hover:bg-gaspoll-700'
              }`}
            >
              {mode === 'autonomous' ? '🚀 Run' : 'Send'}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
