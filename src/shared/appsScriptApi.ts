/**
 * Thin client for the Google Apps Script REST API.
 * Docs: https://developers.google.com/apps-script/api/reference/rest
 *
 * We use:
 *   - GET    /v1/projects/{scriptId}/content        (download all files)
 *   - PUT    /v1/projects/{scriptId}/content        (replace files)
 *   - POST   /v1/projects/{scriptId}/versions       (create a version — Phase 4)
 *   - POST   /v1/projects/{scriptId}/deployments    (create a deployment — Phase 4)
 *   - POST   /v1/projects/{scriptId}:run            (execute a function — Phase 4)
 *
 * Errors:
 *   - On HTTP 401, callers should drop the cached token and retry once.
 *   - On HTTP 403 with `apps_script_api_disabled`, surface the deep link to
 *     https://script.google.com/home/usersettings so the user can enable the API.
 *
 * Note on `scripts.run` (Phase 4):
 *   The target script must be deployed as an API executable (not a web app)
 *   for `scripts.run` to work. The user needs to:
 *     1. Open the Apps Script editor → Deploy → "API Executable" → deploy.
 *     2. Ensure the script's Cloud project matches the extension's OAuth client.
 *   If the script is not deployed as an API executable the API returns 404.
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

export interface ScriptVersion {
  versionNumber: number;
  description: string;
  createTime: string;
}

export interface Deployment {
  deploymentId: string;
  deploymentConfig: {
    scriptId: string;
    versionNumber: number;
    description: string;
  };
  updateTime: string;
  entryPoints?: Array<{
    entryPointType: string;
    webApp?: { url: string; entryPointConfig: { access: string; executeAs: string } };
  }>;
}

export interface RunResult {
  done: boolean;
  response?: {
    '@type': string;
    result?: unknown;
  };
  error?: {
    message: string;
    code: number;
    details?: unknown[];
  };
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

async function request(
  method: 'GET' | 'PUT' | 'POST',
  path: string,
  body?: unknown,
): Promise<Response> {
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

/** Extract a human-readable error detail from a Google API JSON error response. */
function extractErrorDetail(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; status?: string; code?: number };
    };
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    // Not JSON — use raw body (truncated)
  }
  return body.length > 200 ? body.slice(0, 200) + '…' : body;
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
      `getContent failed (${res.status}): ${extractErrorDetail(text)}`,
      res.status,
      text,
    );
  }
  return JSON.parse(text) as ProjectContent;
}

// ───────────────────────── Manifest sanitiser ──────────────────────────────────

/**
 * Known-good enum values accepted by the Apps Script API for appsscript.json.
 * AI models sometimes hallucinate shorthand aliases (e.g. "DEPLOYER" instead of
 * "USER_DEPLOYING") — this map lets us silently fix them before the request
 * reaches the API.
 */
const EXECUTE_AS_ALIASES: Record<string, string> = {
  DEPLOYER: 'USER_DEPLOYING',
  OWNER: 'USER_DEPLOYING',
  ME: 'USER_DEPLOYING',
  USER: 'USER_ACCESSING',
  VIEWER: 'USER_ACCESSING',
};

const VALID_EXECUTE_AS = new Set([
  'USER_DEPLOYING',
  'USER_ACCESSING',
  'SERVICE_ACCOUNT',
  'UNKNOWN_EXECUTE_AS',
]);

const VALID_ACCESS = new Set([
  'ANYONE',
  'ANYONE_ANONYMOUS',
  'MYSELF',
  'DOMAIN',
]);

/**
 * Known-invalid OAuth scopes that AI models frequently hallucinate.
 * These either don't exist or are not real Google OAuth2 scopes.
 * PropertiesService, CacheService, LockService, etc. don't need explicit scopes.
 */
const INVALID_OAUTH_SCOPES = new Set([
  'https://www.googleapis.com/auth/script.properties',
  'https://www.googleapis.com/auth/script.cache',
  'https://www.googleapis.com/auth/script.lock',
  'https://www.googleapis.com/auth/script.triggers',
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.storage',
  'https://www.googleapis.com/auth/properties',
]);

/**
 * AI models often hallucinate Advanced Service `serviceId` values by appending
 * "api" (e.g. "sheetsapi" instead of "sheets"). This map corrects them.
 */
const SERVICE_ID_FIXES: Record<string, string> = {
  sheetsapi: 'sheets',
  driveapi: 'drive',
  gmailapi: 'gmail',
  calendarapi: 'calendar',
  docsapi: 'docs',
  slidesapi: 'slides',
  youtubeapi: 'youtube',
  analyticsapi: 'analytics',
  bigqueryapi: 'bigquery',
  adminapi: 'admin',
};

/**
 * Sanitise an `appsscript.json` source string so that known-invalid manifest
 * values are silently corrected before the file is pushed to the API.
 */
function sanitizeManifestSource(source: string): string {
  try {
    const manifest = JSON.parse(source) as Record<string, unknown>;
    let changed = false;

    // ── Fix webapp enum values ────────────────────────────────────────────
    const webapp = manifest.webapp as
      | { access?: string; executeAs?: string }
      | undefined;

    if (webapp) {
      // Fix executeAs
      if (webapp.executeAs) {
        const upper = webapp.executeAs.toUpperCase();
        if (!VALID_EXECUTE_AS.has(upper)) {
          webapp.executeAs = EXECUTE_AS_ALIASES[upper] ?? 'USER_DEPLOYING';
          changed = true;
        } else if (webapp.executeAs !== upper) {
          webapp.executeAs = upper;
          changed = true;
        }
      }

      // Fix access
      if (webapp.access) {
        const upper = webapp.access.toUpperCase();
        if (!VALID_ACCESS.has(upper)) {
          webapp.access = 'ANYONE_ANONYMOUS';
          changed = true;
        } else if (webapp.access !== upper) {
          webapp.access = upper;
          changed = true;
        }
      }
    }

    // ── Strip invalid OAuth scopes ────────────────────────────────────────
    if (Array.isArray(manifest.oauthScopes)) {
      const original = manifest.oauthScopes as string[];
      const filtered = original.filter((s) => !INVALID_OAUTH_SCOPES.has(s));
      if (filtered.length !== original.length) {
        manifest.oauthScopes = filtered.length > 0 ? filtered : undefined;
        changed = true;
      }
    }

    // ── Fix Advanced Services serviceIds ──────────────────────────────────
    const deps = manifest.dependencies as
      | { enabledAdvancedServices?: Array<{ serviceId?: string; userSymbol?: string; version?: string }> }
      | undefined;

    if (deps?.enabledAdvancedServices) {
      for (const svc of deps.enabledAdvancedServices) {
        if (svc.serviceId) {
          const lower = svc.serviceId.toLowerCase();
          const fix = SERVICE_ID_FIXES[lower];
          if (fix) {
            svc.serviceId = fix;
            changed = true;
          }
        }
      }
    }

    return changed ? JSON.stringify(manifest, null, 2) : source;
  } catch {
    // Not valid JSON — let the API return its own error for structural issues.
    return source;
  }
}

export async function updateProjectContent(
  scriptId: string,
  files: AppsScriptFile[],
): Promise<ProjectContent> {
  // The API's "files" payload only carries name/type/source on writes.
  // Sanitise the appsscript.json manifest to fix common AI-generated mistakes.
  const slim = files.map(({ name, type, source }) => ({
    name,
    type,
    source: type === 'JSON' && name === 'appsscript' ? sanitizeManifestSource(source) : source,
  }));
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
      `updateContent failed (${res.status}): ${extractErrorDetail(text)}`,
      res.status,
      text,
    );
  }
  return JSON.parse(text) as ProjectContent;
}

// ───────────────────────── Phase 4: Versions, Deployments, Run ─────────────────────────

/**
 * Create a new immutable version of the script project.
 * https://developers.google.com/apps-script/api/reference/rest/v1/projects.versions/create
 */
export async function createVersion(
  scriptId: string,
  description: string,
): Promise<ScriptVersion> {
  const res = await request('POST', `/projects/${encodeURIComponent(scriptId)}/versions`, {
    description,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new AppsScriptApiError(
      `createVersion failed (${res.status}): ${extractErrorDetail(text)}`,
      res.status,
      text,
    );
  }
  return JSON.parse(text) as ScriptVersion;
}

/**
 * Create a deployment (web app or API executable).
 * https://developers.google.com/apps-script/api/reference/rest/v1/projects.deployments/create
 */
export async function createDeployment(
  scriptId: string,
  versionNumber: number,
  description: string,
): Promise<Deployment> {
  const res = await request('POST', `/projects/${encodeURIComponent(scriptId)}/deployments`, {
    versionNumber,
    description,
    manifestFileName: 'appsscript',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new AppsScriptApiError(
      `createDeployment failed (${res.status}): ${extractErrorDetail(text)}`,
      res.status,
      text,
    );
  }
  return JSON.parse(text) as Deployment;
}

/**
 * Execute a function in the script project via the `scripts.run` API.
 * The script must be deployed as an API executable (not a web app) for this to work.
 * https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run
 */
export async function runFunction(
  scriptId: string,
  functionName: string,
  parameters?: unknown[],
): Promise<RunResult> {
  const res = await request('POST', `/scripts/${encodeURIComponent(scriptId)}:run`, {
    function: functionName,
    ...(parameters?.length ? { parameters } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new AppsScriptApiError(
      `runFunction failed (${res.status}): ${extractErrorDetail(text)}`,
      res.status,
      text,
    );
  }
  return JSON.parse(text) as RunResult;
}

