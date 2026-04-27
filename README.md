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

Current phase: **Phase 0 — repo skeleton**.

| Phase | Scope                                                                                              | Status      |
| ----- | -------------------------------------------------------------------------------------------------- | ----------- |
| 0     | Repo, build pipeline, manifest MV3, side-panel skeleton, CI                                        | in progress |
| 1     | Chat MVP with OpenRouter; encrypted API key storage; chat history per scriptId                     | planned     |
| 2     | Apps Script REST API integration (`projects.getContent` / `updateContent`); Monaco bridge fallback | planned     |
| 3     | Gemini provider; prompt enhancer; design skills; template gallery                                  | planned     |
| 4     | Autonomous mode (tool-calling planner) + publish web app                                           | planned     |
| 5     | Polish: live preview, license validator, telemetry, web-store submission                           | planned     |

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

## Repository layout (Phase 0)

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
│   │   └── service-worker.ts # message router stub
│   ├── content/
│   │   ├── inject.ts         # content script (ISOLATED world)
│   │   └── monaco-bridge.ts  # content script (MAIN world) — reaches window.monaco
│   ├── shared/
│   │   ├── constants.ts
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
