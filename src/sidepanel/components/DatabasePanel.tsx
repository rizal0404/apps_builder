import { useEffect, useState } from 'react';
import {
  DATABASE_PROVIDERS,
  type DatabaseProviderId,
} from '@/shared/constants';
import { getDatabaseConfig, setDatabaseConfig } from '@/shared/storage';

export function DatabasePanel() {
  const [provider, setProvider] = useState<DatabaseProviderId>('spreadsheet');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getDatabaseConfig().then((cfg) => {
      setProvider(cfg.provider);
      setSpreadsheetUrl(cfg.spreadsheetUrl);
    });
  }, []);

  const handleProviderChange = async (id: DatabaseProviderId) => {
    setProvider(id);
    await setDatabaseConfig({ provider: id });
  };

  const handleConnect = async () => {
    if (!spreadsheetUrl.trim()) return;
    setSaving(true);
    setSaved(false);
    await setDatabaseConfig({ spreadsheetUrl: spreadsheetUrl.trim() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const openNewSheet = () => {
    window.open('https://sheets.new', '_blank');
  };

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-6">
      {/* Hero */}
      <div className="flex flex-col items-center text-center">
        <div className="rounded-full bg-emerald-50 p-4">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-emerald-600"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        </div>
        <h2 className="mt-3 text-base font-bold text-slate-800">App Database Setup</h2>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
          Choose the database provider for this Apps Script project. You can keep using Spreadsheet
          or switch the project to Baserow.
        </p>
      </div>

      {/* Database Provider card */}
      <div className="mt-6 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold text-slate-700">Database Provider</label>
        <select
          value={provider}
          onChange={(e) => void handleProviderChange(e.target.value as DatabaseProviderId)}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          aria-label="Database Provider"
          id="database-provider-select"
        >
          {DATABASE_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Step 1 */}
      {provider === 'spreadsheet' && (
        <>
          <div className="mt-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-emerald-700">Step 1: Get a Spreadsheet</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Don't have one? Click below to instantly create a new blank Google Sheet, then come
              back here.
            </p>
            <button
              type="button"
              onClick={openNewSheet}
              className="mt-3 w-full rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100"
              id="database-create-sheet"
            >
              + Create New Blank Sheet
            </button>
          </div>

          {/* Step 2 */}
          <div className="mt-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-emerald-700">Step 2: Connect It</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Paste the full URL of your Google Sheet below so the AI knows where to save your
              app's data.
            </p>
            <input
              type="url"
              value={spreadsheetUrl}
              onChange={(e) => setSpreadsheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              id="database-spreadsheet-url"
            />
            <button
              type="button"
              onClick={() => void handleConnect()}
              disabled={!spreadsheetUrl.trim() || saving}
              className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              id="database-connect-btn"
            >
              {saving ? 'Connecting…' : saved ? '✓ Connected!' : 'Connect to App'}
            </button>
          </div>
        </>
      )}

      {provider === 'baserow' && (
        <div className="mt-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs leading-relaxed text-slate-500">
            Baserow integration is coming soon. Stay tuned!
          </p>
        </div>
      )}
    </div>
  );
}
