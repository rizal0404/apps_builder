import { useEffect, useState } from 'react';
import { APP_NAME, DEFAULT_MODELS, ProviderId } from '@/shared/constants';
import { getApiKey, getSettings, hasApiKey, setApiKey, setSettings } from '@/shared/storage';
import { isValidLicenseFormat, parseLicense } from '@/shared/license';
import { StorageKey } from '@/shared/constants';

const PROVIDERS: ProviderId[] = [ProviderId.OPENROUTER];

export function OptionsApp() {
  const [provider, setProvider] = useState<ProviderId>(ProviderId.OPENROUTER);
  const [apiKey, setApiKeyValue] = useState<string>('');
  const [keyConfigured, setKeyConfigured] = useState<boolean>(false);
  const [model, setModel] = useState<string>(DEFAULT_MODELS[ProviderId.OPENROUTER][0]);
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [licenseInput, setLicenseInput] = useState<string>('');
  const [licenseStored, setLicenseStored] = useState<string>('');
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      setProvider(s.defaultProvider);
      setModel(s.defaultModel);
      setSystemPrompt(s.systemPrompt);
      setKeyConfigured(await hasApiKey(s.defaultProvider));

      const ls = await chrome.storage.local.get(StorageKey.LICENSE);
      setLicenseStored((ls[StorageKey.LICENSE] as string | undefined) ?? '');
    })();
  }, []);

  useEffect(() => {
    void hasApiKey(provider).then(setKeyConfigured);
  }, [provider]);

  const onProviderChange = async (next: ProviderId) => {
    setProvider(next);
    setModel(DEFAULT_MODELS[next][0]);
    setApiKeyValue('');
  };

  const saveSettings = async () => {
    await setSettings({ defaultProvider: provider, defaultModel: model, systemPrompt });
    if (apiKey.trim().length) {
      await setApiKey(provider, apiKey.trim());
      setApiKeyValue('');
      setKeyConfigured(true);
    }
    setSavedAt(Date.now());
  };

  const removeKey = async () => {
    await setApiKey(provider, '');
    setKeyConfigured(false);
    setApiKeyValue('');
  };

  const revealKey = async () => {
    const v = (await getApiKey(provider)) ?? '';
    setApiKeyValue(v);
  };

  const saveLicense = async () => {
    const trimmed = licenseInput.trim().toUpperCase();
    if (!trimmed) {
      await chrome.storage.local.remove(StorageKey.LICENSE as string);
      setLicenseStored('');
      setLicenseError(null);
      return;
    }
    if (!isValidLicenseFormat(trimmed)) {
      setLicenseError('Invalid format. Expected GSP-XXX-XXX-XXX-{FREE|PLUS|PRO}.');
      return;
    }
    const info = parseLicense(trimmed);
    await chrome.storage.local.set({ [StorageKey.LICENSE]: info.raw });
    setLicenseStored(info.raw);
    setLicenseInput('');
    setLicenseError(null);
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gaspoll-600">
          {APP_NAME} settings
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          API keys are AES-GCM encrypted in <code>chrome.storage.local</code> before being
          persisted.
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">AI provider</h2>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-slate-600">Default provider</span>
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as ProviderId)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-gaspoll-500 focus:outline-none"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-slate-600">
            API key{' '}
            {keyConfigured ? <span className="ml-2 text-emerald-600">(configured)</span> : null}
          </span>
          <div className="mt-1 flex gap-2">
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKeyValue(e.target.value)}
              placeholder={keyConfigured ? '••••••••••••••••' : 'Paste your provider API key'}
              className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-gaspoll-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={revealKey}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              Reveal
            </button>
            {keyConfigured ? (
              <button
                type="button"
                onClick={removeKey}
                className="rounded-md border border-rose-300 px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
              >
                Remove
              </button>
            ) : null}
          </div>
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-slate-600">Default model</span>
          <input
            list="model-options"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-gaspoll-500 focus:outline-none"
          />
          <datalist id="model-options">
            {DEFAULT_MODELS[provider].map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">System prompt</h2>
        <p className="mt-1 text-xs text-slate-500">
          Sent as the first message in every chat. Customize to bias the assistant toward your
          coding style.
        </p>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={8}
          className="mt-2 w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs focus:border-gaspoll-500 focus:outline-none"
        />
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">License</h2>
        <p className="mt-1 text-xs text-slate-500">
          Format: <code>GSP-XXX-XXX-XXX-{'{FREE|PLUS|PRO}'}</code>. Online activation will land in a
          later phase; for now we only store the value locally for offline format validation.
        </p>
        {licenseStored ? (
          <p className="mt-2 text-xs text-emerald-700">
            Stored: <code className="font-mono">{licenseStored}</code>
          </p>
        ) : null}
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={licenseInput}
            onChange={(e) => setLicenseInput(e.target.value)}
            placeholder="GSP-XXX-XXX-XXX-FREE"
            className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs uppercase focus:border-gaspoll-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={saveLicense}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            Save
          </button>
        </div>
        {licenseError ? <p className="mt-2 text-xs text-rose-600">{licenseError}</p> : null}
      </section>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={saveSettings}
          className="rounded-md bg-gaspoll-600 px-4 py-2 text-sm font-medium text-white hover:bg-gaspoll-700"
        >
          Save settings
        </button>
        {savedAt ? (
          <span className="text-xs text-emerald-700">
            Saved at {new Date(savedAt).toLocaleTimeString()}
          </span>
        ) : null}
      </div>
    </div>
  );
}
