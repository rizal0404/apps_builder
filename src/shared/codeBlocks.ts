/**
 * Extract Apps Script files from an AI assistant message.
 *
 * The system prompt instructs the model to emit fenced code blocks where the info
 * string contains the language id followed by the file name, e.g.:
 *
 *   ```js Code.gs
 *   function doGet() { ... }
 *   ```
 *
 *   ```html Index.html
 *   <!doctype html>...
 *   ```
 *
 *   ```json appsscript.json
 *   { "timeZone": "Asia/Jakarta" }
 *   ```
 *
 * We accept a few language aliases so the model can be sloppy:
 *   - `js`, `javascript`, `gs`        → SERVER_JS
 *   - `html`                          → HTML
 *   - `json`, `manifest`              → JSON
 *
 * Files lacking an explicit name are skipped to avoid clobbering anything by mistake.
 */

import type { AppsScriptFile, AppsScriptFileType } from './appsScriptApi';

const FENCE_RE = /^```([^\n`]*)\n([\s\S]*?)\n```/gm;

export interface ExtractedFile extends AppsScriptFile {
  /** Inferred from the file extension in the fence header. */
  type: AppsScriptFileType;
}

const LANG_ALIASES: Record<string, AppsScriptFileType> = {
  js: 'SERVER_JS',
  javascript: 'SERVER_JS',
  gs: 'SERVER_JS',
  ts: 'SERVER_JS', // model sometimes emits ts; we still treat as SERVER_JS
  html: 'HTML',
  htm: 'HTML',
  json: 'JSON',
  manifest: 'JSON',
};

function inferTypeFromName(name: string): AppsScriptFileType | null {
  if (/\.gs$/i.test(name) || /\.js$/i.test(name)) return 'SERVER_JS';
  if (/\.html?$/i.test(name)) return 'HTML';
  if (/\.json$/i.test(name) || /^appsscript$/i.test(name)) return 'JSON';
  return null;
}

function parseInfoString(info: string): { lang: string; name: string } | null {
  const trimmed = info.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { lang: parts[0]!.toLowerCase(), name: '' };
  }
  return { lang: parts[0]!.toLowerCase(), name: parts.slice(1).join(' ').trim() };
}

function stripExtension(name: string): string {
  return name.replace(/\.(gs|js|html?|json)$/i, '');
}

export function extractFiles(messageContent: string): ExtractedFile[] {
  if (!messageContent) return [];
  const out: ExtractedFile[] = [];
  for (const match of messageContent.matchAll(FENCE_RE)) {
    const info = parseInfoString(match[1] ?? '');
    if (!info || !info.name) continue;
    const langType = LANG_ALIASES[info.lang];
    const nameType = inferTypeFromName(info.name);
    const type = langType ?? nameType;
    if (!type) continue;
    let name = info.name;
    if (type === 'SERVER_JS' || type === 'HTML' || type === 'JSON') {
      name = stripExtension(name);
    }
    if (!name) continue;
    out.push({ name, type, source: match[2] ?? '' });
  }
  return dedupe(out);
}

/** When the same file name appears multiple times, keep the last occurrence. */
function dedupe(files: ExtractedFile[]): ExtractedFile[] {
  const map = new Map<string, ExtractedFile>();
  for (const f of files) map.set(`${f.type}:${f.name}`, f);
  return [...map.values()];
}
