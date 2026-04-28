import { DEFAULT_PROVIDER, ProviderId, StorageKey } from './constants';
import { decryptString, encryptString } from './crypto';
import { DEFAULT_SYSTEM_PROMPT, type Settings, type DatabaseConfig } from './types';

export const DEFAULT_SETTINGS: Settings = {
  defaultProvider: DEFAULT_PROVIDER,
  defaultModel: 'openrouter/auto',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  frontendStack: 'auto',
  designSkill: 'auto',
};

export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  provider: 'spreadsheet',
  spreadsheetUrl: '',
};

export async function getDatabaseConfig(): Promise<DatabaseConfig> {
  const raw = (await chrome.storage.local.get(StorageKey.DATABASE_CONFIG))[
    StorageKey.DATABASE_CONFIG
  ] as Partial<DatabaseConfig> | undefined;
  return { ...DEFAULT_DATABASE_CONFIG, ...raw };
}

export async function setDatabaseConfig(patch: Partial<DatabaseConfig>): Promise<DatabaseConfig> {
  const next = { ...(await getDatabaseConfig()), ...patch };
  await chrome.storage.local.set({ [StorageKey.DATABASE_CONFIG]: next });
  return next;
}

export async function getSettings(): Promise<Settings> {
  const raw = (await chrome.storage.local.get(StorageKey.SETTINGS))[StorageKey.SETTINGS] as
    | Partial<Settings>
    | undefined;
  return { ...DEFAULT_SETTINGS, ...raw };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [StorageKey.SETTINGS]: next });
  return next;
}

interface EncryptedKeyMap {
  [providerId: string]: string; // provider id -> AES-GCM ciphertext
}

async function readEncryptedKeyMap(): Promise<EncryptedKeyMap> {
  const raw = (await chrome.storage.local.get(StorageKey.ENCRYPTED_KEYS))[
    StorageKey.ENCRYPTED_KEYS
  ] as EncryptedKeyMap | undefined;
  return raw ?? {};
}

async function writeEncryptedKeyMap(map: EncryptedKeyMap): Promise<void> {
  await chrome.storage.local.set({ [StorageKey.ENCRYPTED_KEYS]: map });
}

export async function setApiKey(providerId: ProviderId, plaintext: string): Promise<void> {
  const map = await readEncryptedKeyMap();
  if (!plaintext) {
    delete map[providerId];
  } else {
    map[providerId] = await encryptString(plaintext);
  }
  await writeEncryptedKeyMap(map);
}

export async function getApiKey(providerId: ProviderId): Promise<string | null> {
  const map = await readEncryptedKeyMap();
  const ct = map[providerId];
  if (!ct) return null;
  try {
    return await decryptString(ct);
  } catch {
    // Corrupt ciphertext — drop it so the user can re-enter the key.
    delete map[providerId];
    await writeEncryptedKeyMap(map);
    return null;
  }
}

export async function listConfiguredProviders(): Promise<ProviderId[]> {
  const map = await readEncryptedKeyMap();
  return Object.keys(map) as ProviderId[];
}

export async function hasApiKey(providerId: ProviderId): Promise<boolean> {
  const map = await readEncryptedKeyMap();
  return providerId in map;
}
