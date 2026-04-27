import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

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
  host_permissions: [
    'https://script.google.com/*',
    'https://script.googleapis.com/*',
    'https://openrouter.ai/*',
    'https://generativelanguage.googleapis.com/*',
  ],
  minimum_chrome_version: '116',
});
