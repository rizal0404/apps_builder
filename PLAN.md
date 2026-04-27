# GASPOLL — Design Plan (v0)

> Branding: **GASPOLL** · Repo: `rizal0404/apps_builder` · Model: closed-source LTD
>
> This document captures the original product plan. The live module map lives in
> [`system_map.md`](./system_map.md) and is updated every PR.

---

## 1. Goal

Build a Chrome extension that:

1. Renders as a sidebar inside the Google Apps Script editor (`https://script.google.com/...`).
2. Accepts natural-language prompts and routes them to multi-provider AI
   (OpenRouter + Gemini for MVP; OpenAI / Claude / Opencode added later).
3. Writes generated code (`.gs`, `.html`, `appsscript.json`) **directly into the user's project**
   via the Apps Script REST API (Monaco DOM fallback if the API is not enabled).
4. Provides three working modes: **Chat / Review / Autonomous** — like OKEGAS / Lovable.

## 2. Reference: OKEGAS workflow & feature parity targets

Source: [okegas.app](https://okegas.app) (research only — we do not copy any code).

- **Workflow**: idea → AI writes code in editor → publish web app.
- **Modes**: Chat (manual), Review (1-click apply), Autonomous (multi-step loop).
- **Context**: reads entire project before each response; per-project chat history stored locally.
- **Database**: defaults to Google Sheets; Baserow optional.
- **Hosting**: deploys natively as Apps Script Web App, optionally wraps under `*.okegas.app`.
- **Monetization**: LTD with Free / Plus / Pro tiers; per-project token caps for Free / Plus.

## 3. Architecture (MV3)

See [`system_map.md`](./system_map.md) for the live diagram. Summary:

- **Content script (ISOLATED)** on `script.google.com/*`: mounts the in-page sidebar surface and
  bridges messages.
- **Content script (MAIN world)**: reaches `window.monaco`, exposes a postMessage RPC for
  `executeEdits` (used for live-typing and DOM fallback).
- **Side panel** (`chrome.sidePanel`): primary UI surface; React + Tailwind.
- **Background service worker**: provider router, OAuth via `chrome.identity`, Apps Script REST
  client, encrypted storage.
- **Options page**: API keys, default model, license activation, telemetry opt-in.

## 4. Code-injection strategy

1. **Primary — Apps Script REST API**
   `PUT https://script.googleapis.com/v1/projects/{scriptId}/content`
   - OAuth scope: `https://www.googleapis.com/auth/script.projects`.
   - Always `getContent` first → merge → `updateContent` (full project replace).
   - Requires the user to enable the Apps Script API once at
     [`script.google.com/home/usersettings`](https://script.google.com/home/usersettings).
2. **Fallback — Monaco DOM injection**
   - Use the MAIN-world bridge to call `editor.executeEdits()` for the open file.
   - Cosmetic streaming ("AI typing in real time") even when REST is the source of truth.

## 5. AI providers (MVP)

| Provider                  | Auth         | Endpoint                                       |
| ------------------------- | ------------ | ---------------------------------------------- |
| OpenRouter (default)      | user API key | `openrouter.ai/api/v1/chat/completions`        |
| Google Gemini (AI Studio) | user API key | `generativelanguage.googleapis.com/v1beta/...` |

Adapters live behind a single `IProvider` interface so adding OpenAI / Anthropic / Opencode later
is mechanical.

API keys are encrypted with AES-GCM in `chrome.storage.local`; service worker is the only surface
that decrypts and forwards them to provider endpoints.

## 6. Modes

- **Chat**: AI replies in the panel; user copies manually.
- **Review**: AI emits a patch; sidebar shows diff against `getContent`; user clicks Apply →
  `updateContent`.
- **Autonomous**: Tool-calling loop (`read_file`, `write_file`, `run_function`, `deploy_web_app`)
  with cancel + token meter; loop ends when the goal is satisfied or hits a configured cap.

## 7. License model (LTD)

- Format: `GSP-XXX-XXX-XXX-{FREE|PLUS|PRO}` (mirrors OKEGAS' `OKG-NBD-JSJ-5F8-FREE`).
- Free: BYOK (OpenRouter / Gemini), per-project token cap, Chat + Review.
- Plus: Autonomous mode, full design-skill / template library.
- Pro: custom domain wrap, password protection, Opencode local integration.
- Validation:
  - **Phase 5**: format check + signed envelope check offline; online activation against the
    license server is a separate repo.

## 8. Roadmap

| Phase | Deliverable                                                                      |
| ----- | -------------------------------------------------------------------------------- |
| 0     | Repo skeleton, manifest MV3, side panel hello, CI                                |
| 1     | Chat MVP with OpenRouter; encrypted API key storage; chat history per `scriptId` |
| 2     | Apps Script REST API integration; Review mode diff; Monaco MAIN bridge           |
| 3     | Gemini provider; prompt enhancer; design skills; template gallery (5 starters)   |
| 4     | Autonomous mode (tool calling + planner); publish web app                        |
| 5     | Live preview, license validator, telemetry, web-store submission                 |

## 9. Risks

See PLAN.md §9 of the original proposal — same content, abbreviated:

- Google may rotate Monaco internals → REST API is the primary path.
- Apps Script API requires manual enablement → guided onboarding + deep link.
- Chrome Web Store remote-code policy → all JS bundled; no `eval` / dynamic remote import.
- API key leakage → encrypted at rest; only forwarded from the SW to provider URLs.
- Autonomous-mode token cost → token meter + hard caps per project.

## 10. Out of scope (separate repos)

- Landing page (`okegas.app`-style).
- License / activation server.
- Member dashboard / billing (WooCommerce + Midtrans + PayPal).
