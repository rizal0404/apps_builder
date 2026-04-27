export const APP_NAME = 'GASPOLL';
export const APP_TAGLINE = 'AI App Builder for Google Apps Script';

export const APPS_SCRIPT_HOST = 'https://script.google.com';

/** chrome.runtime message types exchanged between content / sidepanel / background. */
export const enum MsgType {
  PING = 'gaspoll:ping',
  GET_SCRIPT_CONTEXT = 'gaspoll:get-script-context',
  AI_CHAT = 'gaspoll:ai-chat',
  AI_CHAT_CHUNK = 'gaspoll:ai-chat-chunk',
  AI_CHAT_DONE = 'gaspoll:ai-chat-done',
  APPLY_PATCH = 'gaspoll:apply-patch',
  GET_PROJECT_CONTENT = 'gaspoll:get-project-content',
  UPDATE_PROJECT_CONTENT = 'gaspoll:update-project-content',
}

/** License key prefix — see PLAN.md §10. Format: GSP-XXX-XXX-XXX-{FREE|PLUS|PRO} */
export const LICENSE_PREFIX = 'GSP';
export const LICENSE_TIERS = ['FREE', 'PLUS', 'PRO'] as const;
export type LicenseTier = (typeof LICENSE_TIERS)[number];
