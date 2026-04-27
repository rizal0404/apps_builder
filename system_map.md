# GASPOLL — System Map

> **Live document.** Update this file in every PR that adds, removes, or moves a runtime module
> or build configuration. Reviewers should reject PRs whose code changes are not reflected here.

Last updated: **Phase 0 / 2026-04-27** — initial repo skeleton.

---

## 1. Runtime topology

```
┌──────────────── Chrome browser ────────────────┐
│                                                │
│  Tab: https://script.google.com/...            │
│  ┌──────────────────────────────────┐          │
│  │ src/content/inject.ts (ISOLATED) │  ⇄ chrome.runtime
│  │ src/content/monaco-bridge.ts (MAIN)         │
│  └──────────────────────────────────┘          │
│                                                │
│  Side panel: src/sidepanel/index.html ──┐      │
│  Options:    src/options/index.html ────┤  ⇄ chrome.runtime
│                                          ▼     │
│              ┌─────────────────────────────┐   │
│              │ src/background/             │   │
│              │   service-worker.ts         │   │
│              └─────────────────────────────┘   │
└────────────────────────────────────────────────┘
```

All runtime surfaces talk to one another via `chrome.runtime.sendMessage` / `onMessage` using the
message types declared in `src/shared/constants.ts` (`MsgType`).

---

## 2. File inventory

### Build / config

| Path                                                          | Purpose                                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `package.json`                                                | npm metadata + scripts (`dev`, `build`, `lint`, `typecheck`, `package`) |
| `vite.config.ts`                                              | Vite config wired with `@crxjs/vite-plugin` and React plugin            |
| `manifest.config.ts`                                          | MV3 manifest authored as a TS module                                    |
| `tailwind.config.js` / `postcss.config.js`                    | Tailwind + Autoprefixer                                                 |
| `eslint.config.js`                                            | Flat ESLint config (TS + React hooks + Prettier)                        |
| `.prettierrc.json` / `.prettierignore`                        | Formatter config                                                        |
| `tsconfig.json` (+ `tsconfig.app.json`, `tsconfig.node.json`) | Project references                                                      |
| `.editorconfig`, `.gitignore`, `.npmrc`                       | Misc dev configuration                                                  |
| `.github/workflows/ci.yml`                                    | CI: install → typecheck → lint → build                                  |

### Source

| Path                                 | Surface            | Purpose                                                                             |
| ------------------------------------ | ------------------ | ----------------------------------------------------------------------------------- |
| `src/assets/icon-{16,32,48,128}.png` | static             | Extension icons (used by manifest + toolbar)                                        |
| `src/shared/constants.ts`            | shared             | App constants + `MsgType` enum for message passing                                  |
| `src/shared/license.ts`              | shared             | Validator for `GSP-XXX-XXX-XXX-{FREE\|PLUS\|PRO}` license keys                      |
| `src/background/service-worker.ts`   | background         | MV3 service worker; routes `chrome.runtime` messages, configures `chrome.sidePanel` |
| `src/content/inject.ts`              | content (ISOLATED) | Loaded on `script.google.com/*`; responds to `PING`                                 |
| `src/content/monaco-bridge.ts`       | content (MAIN)     | Same origin, MAIN world; future bridge to `window.monaco`                           |
| `src/sidepanel/index.html`           | side panel         | HTML host for the React side panel                                                  |
| `src/sidepanel/main.tsx`             | side panel         | React entry point                                                                   |
| `src/sidepanel/styles.css`           | side panel         | Tailwind entry stylesheet                                                           |
| `src/sidepanel/SidePanelApp.tsx`     | side panel         | Root component (Phase 0: hello + background ping)                                   |
| `src/options/index.html`             | options page       | HTML host for the options page                                                      |
| `src/options/main.tsx`               | options page       | React entry point                                                                   |
| `src/options/OptionsApp.tsx`         | options page       | Root component (Phase 0: roadmap placeholder)                                       |

### Documentation

| Path            | Purpose                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `README.md`     | Project overview + dev quickstart                                        |
| `PLAN.md`       | Full design plan (architecture, providers, roadmap, risks, monetization) |
| `system_map.md` | **This file.** Live map of modules.                                      |

---

## 3. Manifest permissions (Phase 0)

| Permission  | Why                                                                    |
| ----------- | ---------------------------------------------------------------------- |
| `storage`   | persistent settings + chat history (later phases)                      |
| `identity`  | OAuth via `chrome.identity.getAuthToken` for Apps Script API (Phase 2) |
| `sidePanel` | render the GASPOLL UI in Chrome's side panel                           |
| `tabs`      | inspect active tab to detect `scriptId` from URL                       |
| `scripting` | future programmatic content-script injection if needed                 |

Host permissions:

| Origin                                        | Why                                    |
| --------------------------------------------- | -------------------------------------- |
| `https://script.google.com/*`                 | inject content scripts into the editor |
| `https://script.googleapis.com/*`             | Apps Script REST API (Phase 2+)        |
| `https://openrouter.ai/*`                     | OpenRouter chat completions (Phase 1)  |
| `https://generativelanguage.googleapis.com/*` | Google Gemini (Phase 3)                |

---

## 4. Message types

Defined in [`src/shared/constants.ts`](./src/shared/constants.ts):

| `MsgType`                                        | Direction                          | Phase implemented |
| ------------------------------------------------ | ---------------------------------- | ----------------- |
| `PING`                                           | sidepanel/content → background     | 0                 |
| `GET_SCRIPT_CONTEXT`                             | sidepanel → content                | 2 (planned)       |
| `AI_CHAT` / `AI_CHAT_CHUNK` / `AI_CHAT_DONE`     | sidepanel → background → sidepanel | 1 (planned)       |
| `APPLY_PATCH`                                    | sidepanel → background             | 2 (planned)       |
| `GET_PROJECT_CONTENT` / `UPDATE_PROJECT_CONTENT` | sidepanel → background             | 2 (planned)       |

---

## 5. Update protocol

When you modify the codebase, update **every section above that the change touches**, in the same
PR, before requesting review. If the change is purely cosmetic and touches no listed module, add a
note in the changelog at the bottom.

### Changelog

- **Phase 0 (2026-04-27):** Repo initialized. Vite + crxjs + React + Tailwind skeleton; MV3
  manifest with side panel, options page, background SW, ISOLATED + MAIN content scripts; license
  key validator stub; CI workflow.
