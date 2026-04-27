# GASPOLL — System Map

> **Live document.** Update this file in every PR that adds, removes, or moves a runtime module
> or build configuration. Reviewers should reject PRs whose code changes are not reflected here.

Last updated: **Phase 2 / Apps Script REST + Review mode** — adds OAuth via
`chrome.identity`, the `projects.getContent` / `updateContent` client, an AI-output
parser, a diff/Apply Review panel, and a Monaco MAIN-world RPC bridge for the
live-typing fallback.

---

## 1. Runtime topology

```
┌───────────────────────────── Chrome browser ─────────────────────────────┐
│                                                                          │
│  Tab: https://script.google.com/...                                      │
│  ┌──────────────────────────────────────┐                                │
│  │ src/content/inject.ts (ISOLATED)     │  ⇄ chrome.runtime.sendMessage  │
│  │ src/content/monaco-bridge.ts (MAIN)  │                                │
│  └──────────────────────────────────────┘                                │
│                                                                          │
│  Side panel  ──┐                                                         │
│   src/sidepanel/index.html                                               │
│   src/sidepanel/SidePanelApp.tsx                                         │
│     • useChatSession ─────────── chrome.runtime.connect({ name: CHAT }) ─┼──► background
│     • Header / MessageList / Composer / ConversationsDrawer              │
│     • IndexedDB (idb)        ──► gaspoll DB → conversations / messages   │
│                                                                          │
│  Options page  ──┐                                                       │
│   src/options/index.html                                                 │
│   src/options/OptionsApp.tsx                                             │
│     • settings / API keys (AES-GCM) / system prompt / license            │
│                                                                          │
│              ┌─────────────────────────────┐                             │
│              │ src/background/             │                             │
│              │   service-worker.ts         │                             │
│              │   • PING                    │                             │
│              │   • Port "gaspoll-chat":    │                             │
│              │       receives ChatRequest  │                             │
│              │       calls IProvider       │                             │
│              │       streams chunks back   │                             │
│              │   • providers/registry      │                             │
│              │       • openrouter.ts (SSE) │                             │
│              └─────────────────────────────┘                             │
└──────────────────────────────────────────────────────────────────────────┘
```

All chat traffic uses one long-lived `chrome.runtime.Port` named `PortName.CHAT`. Other
exchanges use `chrome.runtime.sendMessage` with the `MsgType` enum from
`src/shared/constants.ts`.

---

## 2. File inventory

### Build / config

| Path                                       | Purpose                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `package.json`                             | npm metadata + scripts (`dev`, `build`, `lint`, `typecheck`, `format`, `format:check`, `package`) |
| `vite.config.ts`                           | Vite config (`@crxjs/vite-plugin`, React, `@/*` alias to `src/*`)                                 |
| `manifest.config.ts`                       | MV3 manifest authored as a TS module                                                              |
| `tailwind.config.js` / `postcss.config.js` | Tailwind + Autoprefixer; `gaspoll-*` palette                                                      |
| `eslint.config.js`                         | Flat ESLint config (TS + React hooks + Prettier)                                                  |
| `.prettierrc.json` / `.prettierignore`     | Formatter config                                                                                  |
| `tsconfig*.json`                           | Project references; `paths: { "@/*": ["src/*"] }`                                                 |
| `.editorconfig`, `.gitignore`, `.npmrc`    | Misc dev configuration                                                                            |
| `.github/workflows/ci.yml`                 | CI: install → typecheck → lint → format check → build                                             |

### Source — shared

| Path                          | Purpose                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/shared/constants.ts`     | App constants, `MsgType`, `PortName`, `StorageKey`, IDB names, license + provider enums, `DEFAULT_MODELS`     |
| `src/shared/types.ts`         | `ChatMessage`, `Conversation`, `Settings`, `ChatRequest`, `DEFAULT_SYSTEM_PROMPT`                             |
| `src/shared/id.ts`            | `generateId(prefix?)` — 128-bit random hex id                                                                 |
| `src/shared/scriptId.ts`      | Parses Apps Script id from `script.google.com` URLs; `getActiveScriptId()`                                    |
| `src/shared/crypto.ts`        | AES-GCM `encryptString` / `decryptString` with key persisted in `chrome.storage.local`                        |
| `src/shared/storage.ts`       | Settings & encrypted-key facade (`getSettings`, `setApiKey`, `getApiKey`, …)                                  |
| `src/shared/db.ts`            | `idb`-backed `gaspoll` DB with `conversations` + `messages` stores                                            |
| `src/shared/oauth.ts`         | `chrome.identity.getAuthToken` wrapper + cache busting on 401                                                 |
| `src/shared/appsScriptApi.ts` | `getProjectContent` / `updateProjectContent` REST client; surfaces `apps_script_api_disabled`                 |
| `src/shared/codeBlocks.ts`    | Parses fenced AI code blocks (`js Code.gs`, `html Index.html`, `json appsscript.json`) into `ExtractedFile[]` |
| `src/shared/diff.ts`          | LCS-based line diff used by the Review panel                                                                  |
| `src/shared/patch.ts`         | `buildPatch(scriptId, proposed)` + `applyPatch(patch)`                                                        |
| `src/shared/license.ts`       | `GSP-XXX-XXX-XXX-{FREE\|PLUS\|PRO}` validator (`parseLicense`, `isValidLicenseFormat`)                        |

### Source — providers

| Path                          | Purpose                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `src/providers/types.ts`      | `IProvider` interface + request/result shapes                     |
| `src/providers/sse.ts`        | Minimal Server-Sent Events parser (async generator)               |
| `src/providers/openrouter.ts` | OpenRouter chat completions adapter with streaming                |
| `src/providers/registry.ts`   | `getProvider(id)` lookup; throws when a provider is not yet wired |

### Source — background / content

| Path                               | Purpose                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/background/service-worker.ts` | Routes `PING`, `GET_PROJECT_CONTENT`, `BUILD_PATCH`, `APPLY_PATCH`, `UPDATE_PROJECT_CONTENT`; owns `PortName.CHAT` streaming session with `safePost` against disconnected ports |
| `src/content/inject.ts`            | ISOLATED-world content script; PING + RPC bridge to the MAIN-world Monaco helper                                                                                                |
| `src/content/monaco-bridge.ts`     | MAIN-world Monaco helper (`ping`, `getActiveModelText`, `replaceActiveModelText`) used as a live-typing fallback                                                                |

### Source — side panel

| Path                                               | Purpose                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/sidepanel/index.html`                         | HTML host                                                                          |
| `src/sidepanel/main.tsx`                           | React entry                                                                        |
| `src/sidepanel/styles.css`                         | Tailwind entry                                                                     |
| `src/sidepanel/SidePanelApp.tsx`                   | Root component: conversation lifecycle, scriptId binding, settings sync            |
| `src/sidepanel/useChatSession.ts`                  | Hook — opens chat port, dispatches reducer for streaming, persists messages to IDB |
| `src/sidepanel/api.ts`                             | Promisified `chrome.runtime.sendMessage` helpers for the REST/Review flows         |
| `src/sidepanel/components/Header.tsx`              | Top bar (drawer toggle, brand, scriptId pill, new-chat, settings)                  |
| `src/sidepanel/components/MessageList.tsx`         | Scrollable transcript with empty state + per-bubble “Review N files” affordance    |
| `src/sidepanel/components/Composer.tsx`            | Provider/model picker + textarea + send/stop                                       |
| `src/sidepanel/components/ConversationsDrawer.tsx` | Sidebar list of conversations for the current scriptId                             |
| `src/sidepanel/components/DiffView.tsx`            | Renders a `DiffResult` as a side-by-side gutter table                              |
| `src/sidepanel/components/ReviewPanel.tsx`         | Modal-style overlay: file list → diff → Apply (or Apps Script API hint)            |

### Source — options

| Path                         | Purpose                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `src/options/index.html`     | HTML host                                                                         |
| `src/options/main.tsx`       | React entry                                                                       |
| `src/options/OptionsApp.tsx` | Settings form: provider, API key (AES-GCM), default model, system prompt, license |

### Documentation

| Path            | Purpose                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `README.md`     | Project overview + dev quickstart                                        |
| `PLAN.md`       | Full design plan (architecture, providers, roadmap, risks, monetization) |
| `system_map.md` | **This file.** Live map of modules.                                      |

---

### OAuth

`manifest.config.ts` injects `oauth2.client_id` from `process.env.GASPOLL_OAUTH_CLIENT_ID`
(falls back to a placeholder for dev). Scopes:

- `https://www.googleapis.com/auth/script.projects` (read/write Apps Script project files)
- `https://www.googleapis.com/auth/drive.scripts` (Drive scope required for the API)
- `https://www.googleapis.com/auth/userinfo.email`

## 3. Manifest permissions

| Permission  | Why                                                                    |
| ----------- | ---------------------------------------------------------------------- |
| `storage`   | settings, encrypted API keys, license envelope                         |
| `identity`  | OAuth via `chrome.identity.getAuthToken` for Apps Script API (Phase 2) |
| `sidePanel` | render the GASPOLL UI in Chrome's side panel                           |
| `tabs`      | inspect active tab to detect `scriptId` from URL                       |
| `scripting` | future programmatic content-script injection if needed                 |

Host permissions:

| Origin                                        | Why                                               |
| --------------------------------------------- | ------------------------------------------------- |
| `https://script.google.com/*`                 | inject content scripts into the editor            |
| `https://script.googleapis.com/*`             | Apps Script REST API (Phase 2+)                   |
| `https://openrouter.ai/*`                     | OpenRouter chat completions (Phase 1, **active**) |
| `https://generativelanguage.googleapis.com/*` | Google Gemini (Phase 3)                           |

---

## 4. Message types

| `MsgType`                                        | Direction                                                                  | Phase implemented |
| ------------------------------------------------ | -------------------------------------------------------------------------- | ----------------- |
| `PING`                                           | sidepanel/content → background / content                                   | 0                 |
| `GET_SCRIPT_CONTEXT`                             | sidepanel → content (Monaco ping)                                          | **2 ✓**           |
| `AI_CHAT_CHUNK`                                  | background → sidepanel (streaming, via Port)                               | **1 ✓**           |
| `AI_CHAT_DONE`                                   | background → sidepanel (Port)                                              | **1 ✓**           |
| `AI_CHAT_ERROR`                                  | background → sidepanel (Port)                                              | **1 ✓**           |
| `BUILD_PATCH`                                    | sidepanel → background (build a `ProjectPatch` from `ExtractedFile[]`)     | **2 ✓**           |
| `APPLY_PATCH`                                    | sidepanel → background (REST) **or** sidepanel → content (Monaco fallback) | **2 ✓**           |
| `GET_PROJECT_CONTENT` / `UPDATE_PROJECT_CONTENT` | sidepanel → background                                                     | **2 ✓**           |

`PortName.CHAT` is the long-lived port name used by `useChatSession` to ship `ChatRequest`
messages and `{ type: 'cancel' }` instructions to the background worker.

---

## 5. Storage layout

| Where                             | Key                    | Shape                                                        |
| --------------------------------- | ---------------------- | ------------------------------------------------------------ |
| `chrome.storage.local`            | `gaspoll.settings.v1`  | `Settings` (defaultProvider, defaultModel, systemPrompt)     |
| `chrome.storage.local`            | `gaspoll.keys.v1`      | `{ [providerId]: ciphertext_base64 }` (AES-GCM)              |
| `chrome.storage.local`            | `gaspoll.crypto.v1`    | base64 raw AES-GCM key handle (generated on first run)       |
| `chrome.storage.local`            | `gaspoll.license.v1`   | normalized license key string (Phase 5 will sign / activate) |
| IndexedDB `gaspoll/conversations` | `id`                   | `Conversation` (indexed by `scriptId`, `updatedAt`)          |
| IndexedDB `gaspoll/messages`      | `[conversationId, id]` | `ChatMessage` (indexed by `conversationId`)                  |

---

## 6. Update protocol

When you modify the codebase, update **every section above that the change touches**, in the
same PR, before requesting review. If the change is purely cosmetic and touches no listed
module, add a note in the changelog at the bottom.

### Changelog

- **Phase 2 (this PR):** OAuth via `chrome.identity.getAuthToken`, Apps Script REST client
  (`getProjectContent` / `updateProjectContent`), fenced-block parser → `ExtractedFile[]`,
  LCS line-diff, `buildPatch` / `applyPatch`, Review-mode UI (`ReviewPanel` + `DiffView`),
  background routes for `GET_PROJECT_CONTENT` / `BUILD_PATCH` / `APPLY_PATCH` /
  `UPDATE_PROJECT_CONTENT`, Monaco MAIN-world RPC (`ping`, `getActiveModelText`,
  `replaceActiveModelText`) wired through the ISOLATED content script.
- **Phase 1:** OpenRouter SSE provider, AES-GCM encrypted API-key storage,
  IndexedDB chat history (`conversations`, `messages`), `useChatSession` hook over
  `PortName.CHAT`, side-panel UI (Header / MessageList / Composer / Drawer), real options
  page (provider, key, model, system prompt, license), `scriptId` parser, `idb` dependency.
- **Phase 0:** Repo initialized. Vite + crxjs + React + Tailwind skeleton; MV3 manifest with
  side panel, options page, background SW, ISOLATED + MAIN content scripts; license key
  validator stub; CI workflow.
