/**
 * Wrapper around `chrome.identity.getAuthToken`.
 *
 * The OAuth client id and scopes are declared in `manifest.config.ts`. For unpacked
 * dev builds, users must:
 *   1. Create an OAuth client in Google Cloud Console (type: "Chrome App"),
 *      pasting their unpacked extension id.
 *   2. Set `GASPOLL_OAUTH_CLIENT_ID=<...>.apps.googleusercontent.com` and rebuild.
 *   3. Make sure the Apps Script API is enabled at
 *      https://script.google.com/home/usersettings.
 */

export class OAuthError extends Error {
  constructor(
    message: string,
    /** Set when chrome.runtime.lastError contained a specific cause we want to surface. */
    public readonly cause?: string,
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

function lastErrorMessage(): string | undefined {
  return chrome.runtime.lastError?.message;
}

interface AuthTokenResultV2 {
  token?: string;
  grantedScopes?: string[];
}

/**
 * Returns a fresh OAuth access token. If `interactive` is true, prompts the user when
 * silent acquisition fails. The token is cached by Chrome itself; we don't persist it.
 */
export async function getAuthToken(interactive = true): Promise<string> {
  if (!chrome.identity?.getAuthToken) {
    throw new OAuthError('chrome.identity is unavailable in this context');
  }
  return new Promise<string>((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (result) => {
      const err = lastErrorMessage();
      if (err) {
        reject(new OAuthError(`Failed to acquire OAuth token: ${err}`, err));
        return;
      }
      // Chrome returns a string in MV2 and an object in MV3.
      const token =
        typeof result === 'string'
          ? result
          : ((result as AuthTokenResultV2 | undefined)?.token ?? '');
      if (!token) {
        reject(new OAuthError('Empty OAuth token'));
        return;
      }
      resolve(token);
    });
  });
}

/**
 * Drop a cached token (e.g. after a 401) so the next call requests a fresh one.
 */
export async function removeCachedAuthToken(token: string): Promise<void> {
  if (!chrome.identity?.removeCachedAuthToken) return;
  return new Promise<void>((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}
