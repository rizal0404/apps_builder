import { defineManifest } from '@crxjs/vite-plugin';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from './package.json' with { type: 'json' };

/**
 * Load .env at config time — Vite's built-in .env loading happens after
 * the config (and therefore this manifest module) has already been evaluated.
 */
function loadEnvFile(): void {
  if (process.env.GASPOLL_OAUTH_CLIENT_ID) return; // already set (e.g. CI)
  try {
    const dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(resolve(dir, '.env'), 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env not found — fall back to placeholder
  }
}
loadEnvFile();

/**
 * The OAuth client id used by `chrome.identity.getAuthToken` for Apps Script REST calls.
 * In production this is filled from the `GASPOLL_OAUTH_CLIENT_ID` env var at build time.
 * In dev it falls back to a placeholder; OAuth calls will fail until the user wires their
 * own OAuth client (see README §Apps Script OAuth setup).
 */
const OAUTH_CLIENT_ID =
  process.env.GASPOLL_OAUTH_CLIENT_ID ?? 'PLACEHOLDER.apps.googleusercontent.com';

export default defineManifest({
  manifest_version: 3,
  name: 'GASPOLL — AI App Builder for Google Apps Script',
  short_name: 'GASPOLL',
  description:
    'Chat with AI right inside the Google Apps Script editor. GASPOLL writes code directly into your project — no copy-paste.',
  version: pkg.version,
  icons: {
    16: 'src/assets/icon-16.png',
    32: 'src/assets/icon-32.png',
    48: 'src/assets/icon-48.png',
    128: 'src/assets/icon-128.png',
  },
  action: {
    default_title: 'Open GASPOLL',
    default_icon: {
      16: 'src/assets/icon-16.png',
      32: 'src/assets/icon-32.png',
      48: 'src/assets/icon-48.png',
      128: 'src/assets/icon-128.png',
    },
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://script.google.com/*'],
      js: ['src/content/inject.ts'],
      run_at: 'document_idle',
    },
    {
      matches: ['https://script.google.com/*'],
      js: ['src/content/monaco-bridge.ts'],
      world: 'MAIN',
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage', 'identity', 'sidePanel', 'tabs', 'scripting'],
  oauth2: {
    client_id: OAUTH_CLIENT_ID,
    scopes: [
      'https://www.googleapis.com/auth/script.projects',
      'https://www.googleapis.com/auth/script.deployments',
      'https://www.googleapis.com/auth/script.processes',
      'https://www.googleapis.com/auth/drive.scripts',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  },
  host_permissions: [
    'https://script.google.com/*',
    'https://script.googleapis.com/*',
    'https://openrouter.ai/*',
    'https://generativelanguage.googleapis.com/*',
  ],
  minimum_chrome_version: '116',
});
