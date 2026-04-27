export const APP_NAME = 'GASPOLL';
export const APP_TAGLINE = 'AI App Builder for Google Apps Script';

export const APPS_SCRIPT_HOST = 'https://script.google.com';

/** chrome.runtime message types exchanged between content / sidepanel / background. */
export const enum MsgType {
  PING = 'gaspoll:ping',
  GET_SCRIPT_CONTEXT = 'gaspoll:get-script-context',
  AI_CHAT_CHUNK = 'gaspoll:ai-chat-chunk',
  AI_CHAT_DONE = 'gaspoll:ai-chat-done',
  AI_CHAT_ERROR = 'gaspoll:ai-chat-error',
  APPLY_PATCH = 'gaspoll:apply-patch',
  GET_PROJECT_CONTENT = 'gaspoll:get-project-content',
  UPDATE_PROJECT_CONTENT = 'gaspoll:update-project-content',
  BUILD_PATCH = 'gaspoll:build-patch',
  ENHANCE_PROMPT = 'gaspoll:enhance-prompt',
  /** Phase 4 — Autonomous planner events */
  PLANNER_PROGRESS = 'gaspoll:planner-progress',
  PLANNER_TOOL_CALL = 'gaspoll:planner-tool-call',
  PLANNER_TOOL_RESULT = 'gaspoll:planner-tool-result',
  PLANNER_DONE = 'gaspoll:planner-done',
  PLANNER_ERROR = 'gaspoll:planner-error',
  /** Phase 4 — Deploy */
  CREATE_VERSION = 'gaspoll:create-version',
  CREATE_DEPLOYMENT = 'gaspoll:create-deployment',
  RUN_FUNCTION = 'gaspoll:run-function',
}

/** chrome.runtime.connect port names. */
export const enum PortName {
  CHAT = 'gaspoll-chat',
  PLANNER = 'gaspoll-planner',
}

/** Persistent storage keys (chrome.storage.local). */
export const enum StorageKey {
  SETTINGS = 'gaspoll.settings.v1',
  ENCRYPTED_KEYS = 'gaspoll.keys.v1',
  ENCRYPTION_KEY_HANDLE = 'gaspoll.crypto.v1',
  LICENSE = 'gaspoll.license.v1',
}

/** IndexedDB name + stores. */
export const DB_NAME = 'gaspoll';
export const DB_VERSION = 1;
export const enum DbStore {
  CONVERSATIONS = 'conversations',
  MESSAGES = 'messages',
}

/** License key prefix — see PLAN.md §10. Format: GSP-XXX-XXX-XXX-{FREE|PLUS|PRO} */
export const LICENSE_PREFIX = 'GSP';
export const LICENSE_TIERS = ['FREE', 'PLUS', 'PRO'] as const;
export type LicenseTier = (typeof LICENSE_TIERS)[number];

/** Provider IDs supported by GASPOLL. Phase 1 only ships OpenRouter; more land in Phase 3+. */
export const enum ProviderId {
  OPENROUTER = 'openrouter',
  GEMINI = 'gemini',
}

export const DEFAULT_PROVIDER: ProviderId = ProviderId.OPENROUTER;

/** A small curated default model list per provider. Users can type any model id manually. */
export const DEFAULT_MODELS: Record<ProviderId, string[]> = {
  [ProviderId.OPENROUTER]: [
    'openrouter/auto',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o-mini',
    'google/gemini-2.5-flash',
    'deepseek/deepseek-chat',
    'qwen/qwen-2.5-coder-32b-instruct',
  ],
  [ProviderId.GEMINI]: ['gemini-2.5-flash', 'gemini-2.5-pro'],
};
