import { APP_NAME } from '@/shared/constants';

export function OptionsApp() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-gaspoll-600">
        {APP_NAME} settings
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Settings UI ships in Phase 1. For now this page is a placeholder so the options entry is
        wired in the manifest.
      </p>

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Roadmap</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Provider API keys (OpenRouter, Gemini) — encrypted in chrome.storage.local</li>
          <li>Default model picker</li>
          <li>License key activation (GSP-XXX-XXX-XXX-FREE/PLUS/PRO)</li>
          <li>Telemetry opt-in</li>
        </ol>
      </section>
    </div>
  );
}
