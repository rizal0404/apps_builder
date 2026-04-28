/**
 * Phase 4 — Deploy panel.
 *
 * Allows the user to create a versioned deployment of the current
 * Apps Script project. Creates a version first, then creates a deployment,
 * and displays the resulting web app URL.
 */

import { useState } from 'react';
import { createVersionViaBackground, createDeploymentViaBackground } from '../api';

interface Props {
  scriptId: string;
  onClose: () => void;
}

type DeployStatus =
  | { kind: 'idle' }
  | { kind: 'deploying' }
  | {
      kind: 'deployed';
      versionNumber: number;
      deploymentId: string;
      webAppUrl: string | null;
    }
  | { kind: 'error'; message: string };

export function DeployPanel({ scriptId, onClose }: Props) {
  const [description, setDescription] = useState('GASPOLL deployment');
  const [status, setStatus] = useState<DeployStatus>({ kind: 'idle' });

  const deploy = async () => {
    if (scriptId === 'unknown') return;
    setStatus({ kind: 'deploying' });
    try {
      // 1. Create a version
      const version = await createVersionViaBackground(scriptId, description);

      // 2. Create a deployment from that version
      const deployment = await createDeploymentViaBackground(
        scriptId,
        version.versionNumber,
        description,
      );

      // 3. Extract web app URL
      const webAppEntry = deployment.entryPoints?.find(
        (e: { entryPointType: string }) => e.entryPointType === 'WEB_APP',
      );
      const webAppUrl = webAppEntry?.webApp?.url ?? null;

      setStatus({
        kind: 'deployed',
        versionNumber: version.versionNumber,
        deploymentId: deployment.deploymentId,
        webAppUrl,
      });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const copyUrl = (url: string) => {
    void navigator.clipboard.writeText(url);
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <div>
          <div className="text-sm font-semibold text-slate-800">🚀 Deploy Web App</div>
          <div className="text-[11px] text-slate-500">
            {scriptId === 'unknown'
              ? 'No active Apps Script project — open one in another tab.'
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {status.kind === 'idle' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Deployment description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gaspoll-500 focus:outline-none"
                placeholder="e.g. Initial release"
              />
            </div>

            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
              <div className="mb-1 font-semibold">How it works</div>
              <ol className="ml-4 list-decimal space-y-1">
                <li>
                  Creates an immutable <strong>version</strong> of your project.
                </li>
                <li>
                  Creates a <strong>deployment</strong> from that version.
                </li>
                <li>
                  If your script has a <code>doGet()</code> or <code>doPost()</code> function, a{' '}
                  <strong>Web App URL</strong> is generated.
                </li>
              </ol>
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <strong>Note:</strong> Make sure your script has a <code>doGet()</code> function and
              the <code>appsscript.json</code> has{' '}
              <code>{'"webapp": { "access": "ANYONE", "executeAs": "USER_DEPLOYING" }'}</code> for a
              publicly accessible web app.
            </div>
          </div>
        )}

        {status.kind === 'deploying' && (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-slate-500">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-gaspoll-500" />
            Creating version and deploying…
          </div>
        )}

        {status.kind === 'deployed' && (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-800">
              <div className="mb-2 text-sm font-semibold">🎉 Deployed successfully!</div>
              <div className="space-y-1">
                <div>
                  <span className="font-medium">Version:</span> {status.versionNumber}
                </div>
                <div>
                  <span className="font-medium">Deployment ID:</span>{' '}
                  <code className="text-[10px]">{status.deploymentId}</code>
                </div>
              </div>
            </div>

            {status.webAppUrl ? (
              <div className="rounded-md border border-gaspoll-200 bg-gaspoll-50 p-3">
                <div className="mb-2 text-xs font-semibold text-gaspoll-800">Web App URL</div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={status.webAppUrl}
                    className="min-w-0 flex-1 rounded border border-gaspoll-200 bg-white px-2 py-1.5 text-xs font-mono text-gaspoll-700"
                  />
                  <button
                    onClick={() => copyUrl(status.webAppUrl!)}
                    className="shrink-0 rounded bg-gaspoll-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gaspoll-700"
                  >
                    Copy
                  </button>
                </div>
                <a
                  href={status.webAppUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-gaspoll-600 underline hover:text-gaspoll-800"
                >
                  Open in new tab →
                </a>
              </div>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                No web app URL was returned. Ensure your script has a <code>doGet()</code> or{' '}
                <code>doPost()</code> function and the deployment is configured as a web app in{' '}
                <code>appsscript.json</code>.
              </div>
            )}
          </div>
        )}

        {status.kind === 'error' && (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-xs text-rose-800">
            <div className="mb-1 font-semibold">Deployment failed</div>
            <div>{status.message}</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
        <button
          onClick={onClose}
          className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-white"
        >
          Cancel
        </button>
        {(status.kind === 'idle' || status.kind === 'error') && (
          <button
            onClick={deploy}
            disabled={scriptId === 'unknown' || !description.trim()}
            className="rounded bg-gaspoll-600 px-3 py-1 text-xs font-semibold text-white hover:bg-gaspoll-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Deploy
          </button>
        )}
        {status.kind === 'deployed' && (
          <button
            onClick={() => setStatus({ kind: 'idle' })}
            className="rounded border border-gaspoll-300 px-3 py-1 text-xs font-medium text-gaspoll-700 hover:bg-gaspoll-50"
          >
            Deploy another version
          </button>
        )}
      </footer>
    </div>
  );
}
