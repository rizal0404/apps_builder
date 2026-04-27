import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { DEFAULT_MODELS, ProviderId } from '@/shared/constants';
import { enhancePromptViaBackground } from '../api';

interface Props {
  providerId: ProviderId;
  model: string;
  onProviderChange: (id: ProviderId) => void;
  onModelChange: (model: string) => void;
  onSend: (text: string) => void | Promise<void>;
  onCancel: () => void;
  pending: boolean;
  disabled: boolean;
  providerKeyMissing: boolean;
  /** Imperative seed: when this changes, the textarea is replaced with the new value. */
  seedText?: { value: string; nonce: number } | null;
}

const PROVIDERS: ProviderId[] = [ProviderId.OPENROUTER, ProviderId.GEMINI];

export function Composer({
  providerId,
  model,
  onProviderChange,
  onModelChange,
  onSend,
  onCancel,
  pending,
  disabled,
  providerKeyMissing,
  seedText,
}: Props) {
  const [text, setText] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  useEffect(() => {
    if (seedText) setText(seedText.value);
  }, [seedText]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const v = text.trim();
    if (!v || disabled) return;
    void onSend(v);
    setText('');
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

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-slate-200 bg-white p-3">
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
            : 'Describe what you want to build (Enter to send, Shift+Enter for newline)'
        }
        rows={3}
        className="w-full resize-none rounded-md border border-slate-300 bg-white p-2 text-sm leading-5 focus:border-gaspoll-500 focus:outline-none"
        disabled={(disabled && !pending) || enhancing}
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
            {pending ? 'Streaming…' : 'Press Enter to send'}
          </span>
          {pending ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={disabled || !text.trim()}
              className="rounded-md bg-gaspoll-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gaspoll-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
