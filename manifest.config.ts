import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

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
