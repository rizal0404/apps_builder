/**
 * Detect the Apps Script project id from a `script.google.com` editor URL.
 * Returns `'unknown'` when the side panel is opened on any other page so we still have a
 * stable conversation key.
 */

export const UNKNOWN_SCRIPT_ID = 'unknown';

const PATTERNS: RegExp[] = [
  /^https:\/\/script\.google\.com\/home\/projects\/([^/]+)/,
  /^https:\/\/script\.google\.com\/u\/\d+\/home\/projects\/([^/]+)/,
  /^https:\/\/script\.google\.com\/macros\/d\/([^/]+)/,
];

export function parseScriptIdFromUrl(url: string | undefined | null): string {
  if (!url) return UNKNOWN_SCRIPT_ID;
  for (const re of PATTERNS) {
    const m = re.exec(url);
    if (m?.[1]) return m[1];
  }
  return UNKNOWN_SCRIPT_ID;
}

export async function getActiveScriptId(): Promise<string> {
  if (!chrome?.tabs?.query) return UNKNOWN_SCRIPT_ID;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return parseScriptIdFromUrl(tab?.url);
}
