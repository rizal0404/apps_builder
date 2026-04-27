/**
 * Lightweight AES-GCM helper for encrypting provider API keys at rest.
 *
 * Threat model (be honest):
 *   - Goal: prevent casual disk inspection (machine images, sync conflicts) from leaking keys.
 *   - NOT a defense against malicious code that already has chrome.storage.local access — any
 *     such code can also read our key handle. A passphrase-based unlock will land in Phase 5.
 *
 * The encryption key itself is generated once and persisted as a non-extractable raw byte
 * sequence in chrome.storage.local under {@link StorageKey.ENCRYPTION_KEY_HANDLE}.
 */

import { StorageKey } from './constants';

const ALGO = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function loadOrCreateKey(): Promise<CryptoKey> {
  const stored = (await chrome.storage.local.get(StorageKey.ENCRYPTION_KEY_HANDLE))[
    StorageKey.ENCRYPTION_KEY_HANDLE
  ] as string | undefined;

  if (stored) {
    const raw = b64ToBytes(stored);
    return crypto.subtle.importKey('raw', raw as BufferSource, ALGO, false, ['encrypt', 'decrypt']);
  }

  const key = await crypto.subtle.generateKey({ name: ALGO, length: KEY_LENGTH }, true, [
    'encrypt',
    'decrypt',
  ]);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  await chrome.storage.local.set({ [StorageKey.ENCRYPTION_KEY_HANDLE]: bytesToB64(raw) });

  // Re-import as non-extractable for the in-memory handle we hand out.
  return crypto.subtle.importKey('raw', raw as BufferSource, ALGO, false, ['encrypt', 'decrypt']);
}

let cachedKey: Promise<CryptoKey> | null = null;
function getKey(): Promise<CryptoKey> {
  cachedKey ??= loadOrCreateKey();
  return cachedKey;
}

export async function encryptString(plaintext: string): Promise<string> {
  if (!plaintext) return '';
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: ALGO, iv: iv as BufferSource },
      key,
      new TextEncoder().encode(plaintext) as BufferSource,
    ),
  );
  const blob = new Uint8Array(iv.length + ct.length);
  blob.set(iv, 0);
  blob.set(ct, iv.length);
  return bytesToB64(blob);
}

export async function decryptString(ciphertext: string): Promise<string> {
  if (!ciphertext) return '';
  const key = await getKey();
  const blob = b64ToBytes(ciphertext);
  const iv = blob.slice(0, IV_LENGTH);
  const ct = blob.slice(IV_LENGTH);
  const plain = await crypto.subtle.decrypt(
    { name: ALGO, iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
  return new TextDecoder().decode(plain);
}
