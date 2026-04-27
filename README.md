# GASPOLL — AI App Builder for Google Apps Script

> Chat with AI right inside the Google Apps Script editor. GASPOLL writes code directly into your project — **no copy-paste**.

GASPOLL is a Chrome extension (Manifest V3) that brings a Lovable-style AI app builder into
[`script.google.com`](https://script.google.com). Describe what you want and GASPOLL generates the
`Code.gs`, HTML, and `appsscript.json` files and writes them straight into your project via the
Apps Script REST API (with a Monaco fallback).

This repository hosts the extension only. Landing page, license server, and member dashboard live in separate repos.

---

## Status

This is a **closed-source commercial project** (LTD model — see [PLAN.md](./PLAN.md) §10).

Current phase: **Phase 3 — Gemini provider + prompt enhancer + template gallery**.

| Phase | Scope                                                                                                                                      | Status      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| 0     | Repo, build pipeline, manifest MV3, side-panel skeleton, CI                                                                                | shipped     |
| 1     | Chat MVP with OpenRouter; encrypted API key storage; chat history per scriptId                                                             | shipped     |
| 2     | Apps Script REST API integration (`projects.getContent` / `updateContent`); Review mode + diff/Apply UI; Monaco MAIN-world bridge fallback | shipped     |
| 3     | Gemini provider; prompt enhancer; starter template gallery                                                                                 | in progress |
| 4     | Autonomous mode (tool-calling planner) + publish web app                                                                                   | planned     |
| 5     | Polish: live preview, license validator, telemetry, web-store submission                                                                   | planned     |

See [`system_map.md`](./system_map.md) for the live map of files and modules.

## Tech stack

| Layer         | Choice                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------- |
| Language      | TypeScript 5                                                                                  |
| Build         | Vite 6 + [`@crxjs/vite-plugin`](https://github.com/crxjs/chrome-extension-tools)              |
| UI            | React 18 + Tailwind CSS                                                                       |
| Lint / format | ESLint 9 (flat config) + Prettier                                                             |
| Manifest      | MV3 with `side_panel`, `content_scripts` (ISOLATED + MAIN world), `background` service worker |

## Local development

```bash
pnpm install
pnpm dev          # vite dev server with HMR
pnpm build        # production build → dist/
pnpm package      # build + zip → gaspoll-extension.zip
pnpm typecheck
pnpm lint
pnpm format
```

To load the extension in Chrome:

1. `pnpm build`
2. Go to `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked**, choose the `dist/` folder.
4. Pin GASPOLL in the toolbar; click the icon to open the side panel.
5. Open any Apps Script project at `https://script.google.com/...` — the content script
   announces itself in the page console (`[GASPOLL] content script loaded on …`).

## Configuration

1. Build & load the extension (see steps above).
2. Open Chrome's GASPOLL options page (chrome://extensions → GASPOLL → Details → "Extension
   options").
3. Paste your OpenRouter API key in the **API key** field, choose a default model
   (e.g. `openrouter/auto`), tweak the system prompt, and click **Save settings**.
4. Open the side panel — you can now chat. Conversations are scoped to the active Apps
   Script project (`scriptId`) and persisted in IndexedDB.

### Apps Script OAuth setup (required for Review-mode "Apply")

The **Apply to project** button calls the Apps Script REST API
(`projects.getContent` / `updateContent`) using `chrome.identity.getAuthToken`. To use it
in a dev / unpacked build:

1. In **Google Cloud Console**, create a new project (or reuse one).
2. Enable the **Apps Script API**
   (https://console.cloud.google.com/apis/library/script.googleapis.com).
3. Configure the **OAuth consent screen** (External, Testing mode is fine for personal use).
   Add your Google account as a Test user.
4. Create an **OAuth client ID** of type **Chrome App**. Paste your unpacked extension's id
   (visible at `chrome://extensions` once you load the unpacked build).
5. Build with the client id wired in:
   ```bash
   GASPOLL_OAUTH_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com pnpm build
   ```
   The id ends up in `manifest.json` under `oauth2.client_id`.
6. The very first time you click **Apply** in Review mode, Chrome pops the consent screen.
   Approve it; subsequent calls reuse the cached token.
7. The user must also enable the Apps Script API for their account at
   https://script.google.com/home/usersettings (one-time per Google account).

## Prompt enhancer (Phase 3)

The composer has an **✨ Enhance** button next to Send. Type a short idea (e.g. "mail
merge from a sheet"), click Enhance, and GASPOLL rewrites it into a precise, Apps
Script-flavoured prompt before you send. The rewrite uses your currently selected
provider + model, with a dedicated enhancer system prompt (see
[`src/shared/promptEnhancer.ts`](./src/shared/promptEnhancer.ts)).

## Templates (Phase 3)

The empty state of a fresh chat shows a **Starter templates** gallery. Each card seeds
the composer with a detailed prompt (and, where it makes sense, a set of bootstrap
files you can apply directly via Review mode). Current templates:

- **Web App: Hello world** — minimal HtmlService web app (with bootstrap files).
- **Sheet: onEdit audit log**.
- **Mail merge from a sheet**.
- **Form responses → Slack**.
- **Custom function: `=GASPOLL_ASK`** that calls OpenRouter via `UrlFetchApp`.

The full registry lives in [`src/shared/templates.ts`](./src/shared/templates.ts) — add
new ones there.

## Review mode (Phase 2)

When the assistant replies with fenced code blocks tagged with file names — e.g.:

````markdown
```js Code.gs
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index');
}
```

```html Index.html
<!doctype html>
<h1>Hello GASPOLL</h1>
```

```json appsscript.json
{ "timeZone": "Asia/Jakarta", "runtimeVersion": "V8" }
```
````

…the message bubble grows a **Review N files** button. Clicking it opens a side-panel diff
view comparing the proposal against the current `getContent` snapshot, with NEW/EDIT/NOOP
badges per file. Hit **Apply to project** to push the merged set through `updateContent`.

## Repository layout

```
.
├── manifest.config.ts        # MV3 manifest (consumed by @crxjs/vite-plugin)
├── vite.config.ts
├── tailwind.config.js
├── eslint.config.js
├── tsconfig*.json
├── src/
│   ├── assets/               # extension icons (16/32/48/128)
│   ├── background/
│   │   └── service-worker.ts # message router + chat streaming port
│   ├── content/
│   │   ├── inject.ts         # content script (ISOLATED world) — RPC bridge
│   │   └── monaco-bridge.ts  # content script (MAIN world) — reaches window.monaco
│   ├── providers/
│   │   ├── types.ts          # IProvider interface
│   │   ├── sse.ts            # Server-Sent Events parser
│   │   ├── openrouter.ts     # OpenRouter adapter (streaming)
│   │   └── registry.ts       # provider lookup
│   ├── shared/
│   │   ├── constants.ts      # MsgType, StorageKey, ProviderId, DEFAULT_MODELS, …
│   │   ├── types.ts          # ChatMessage / Conversation / Settings
│   │   ├── id.ts             # 128-bit random ids
│   │   ├── scriptId.ts       # detect Apps Script id from a tab URL
│   │   ├── crypto.ts         # AES-GCM encrypt/decrypt for API keys
│   │   ├── storage.ts        # chrome.storage.local facade
│   │   ├── db.ts             # IndexedDB wrapper for chat history
│   │   ├── oauth.ts          # chrome.identity.getAuthToken wrapper
│   │   ├── appsScriptApi.ts  # projects.getContent / updateContent client
│   │   ├── codeBlocks.ts     # parse fenced AI output → ExtractedFile[]
│   │   ├── diff.ts           # tiny LCS line-diff for Review mode
│   │   ├── patch.ts          # build / apply ProjectPatch
│   │   └── license.ts        # GSP-XXX-XXX-XXX-{FREE|PLUS|PRO} key validator
│   ├── sidepanel/            # React side-panel UI (default UI surface)
│   └── options/              # React options page
├── PLAN.md                   # full design plan (kept under version control)
├── system_map.md             # live system map (refreshed every PR)
└── README.md
```

## License key format

GASPOLL uses LTD-style license keys, e.g. `GSP-NBD-JSJ-5F8-PRO`. The pattern is:

```
GSP-[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}-(FREE|PLUS|PRO)
```

Validation logic lives in [`src/shared/license.ts`](./src/shared/license.ts).
The actual license server (online activation, rate-limit) is out of scope for the extension repo.

## Disclaimer

GASPOLL is **not affiliated with Google LLC**. "Google Apps Script" is a trademark of Google LLC.
