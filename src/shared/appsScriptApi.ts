/**
 * Thin client for the Google Apps Script REST API.
 * Docs: https://developers.google.com/apps-script/api/reference/rest
 *
 * We only use:
 *   - GET    /v1/projects/{scriptId}/content        (download all files)
 *   - PUT    /v1/projects/{scriptId}/content        (replace files)
 *
 * Errors:
 *   - On HTTP 401, callers should drop the cached token and retry once.
 *   - On HTTP 403 with `apps_script_api_disabled`, surface the deep link to
 *     https://script.google.com/home/usersettings so the user can enable the API.
 */

import { getAuthToken, removeCachedAuthToken } from './oauth';

const BASE = 'https://script.googleapis.com/v1';

export type AppsScriptFileType = 'SERVER_JS' | 'HTML' | 'JSON';

export interface AppsScriptFile {
  name: string;
  type: AppsScriptFileType;
  source: string;
  /** Optional fields the API echoes; we never write them ourselves. */
  lastModifyUser?: { name?: string; email?: string };
  createTime?: string;
  updateTime?: string;
  functionSet?: { values?: Array<{ name: string }> };
}

export interface ProjectContent {
  scriptId: string;
  files: AppsScriptFile[];
}

export class AppsScriptApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = 'AppsScriptApiError';
  }
}

async function request(method: 'GET' | 'PUT', path: string, body?: unknown): Promise<Response> {
  let token = await getAuthToken(true);
  let res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    await removeCachedAuthToken(token);
    token = await getAuthToken(true);
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  return res;
}

function isApiDisabledError(text: string): boolean {
  return /Apps Script API has not been used|apps_script_api_disabled/i.test(text);
}

export async function getProjectContent(scriptId: string): Promise<ProjectContent> {
  const res = await request('GET', `/projects/${encodeURIComponent(scriptId)}/content`);
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 403 && isApiDisabledError(text)) {
      throw new AppsScriptApiError(
        'Apps Script API is not enabled. Open https://script.google.com/home/usersettings and toggle it on.',
        res.status,
        text,
      );
    }
    throw new AppsScriptApiError(
      `getContent failed: ${res.status} ${res.statusText}`,
      res.status,
      text,
    );
  }
  return JSON.parse(text) as ProjectContent;
}

export async function updateProjectContent(
  scriptId: string,
  files: AppsScriptFile[],
): Promise<ProjectContent> {
  // The API's "files" payload only carries name/type/source on writes.
  const slim = files.map(({ name, type, source }) => ({ name, type, source }));
  const res = await request('PUT', `/projects/${encodeURIComponent(scriptId)}/content`, {
    files: slim,
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 403 && isApiDisabledError(text)) {
      throw new AppsScriptApiError(
        'Apps Script API is not enabled. Open https://script.google.com/home/usersettings and toggle it on.',
        res.status,
        text,
      );
    }
    throw new AppsScriptApiError(
      `updateContent failed: ${res.status} ${res.statusText}`,
      res.status,
      text,
    );
  }
  return JSON.parse(text) as ProjectContent;
}
