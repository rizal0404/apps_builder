/**
 * IndexedDB-backed chat history. One conversation per (scriptId, conversationId) tuple,
 * messages stored in a separate object store indexed by conversationId.
 *
 * Why IndexedDB over chrome.storage.local: chat transcripts can grow large, the storage.local
 * quota is ~10 MB unless we ask for `unlimitedStorage`, and IDB is the standard for
 * append-heavy structured data.
 */

import { type IDBPDatabase, openDB } from 'idb';
import { DB_NAME, DB_VERSION, DbStore } from './constants';
import type { ChatMessage, Conversation } from './types';

interface GaspollSchema {
  [DbStore.CONVERSATIONS]: {
    key: string;
    value: Conversation;
    indexes: { byScriptId: string; byUpdatedAt: number };
  };
  [DbStore.MESSAGES]: {
    key: string; // `${conversationId}:${messageId}`
    value: ChatMessage & { conversationId: string };
    indexes: { byConversationId: string };
  };
}

let dbPromise: Promise<IDBPDatabase<GaspollSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<GaspollSchema>> {
  dbPromise ??= openDB<GaspollSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(DbStore.CONVERSATIONS)) {
        const store = db.createObjectStore(DbStore.CONVERSATIONS, { keyPath: 'id' });
        store.createIndex('byScriptId', 'scriptId');
        store.createIndex('byUpdatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(DbStore.MESSAGES)) {
        const store = db.createObjectStore(DbStore.MESSAGES, {
          keyPath: ['conversationId', 'id'],
        });
        store.createIndex('byConversationId', 'conversationId');
      }
    },
  });
  return dbPromise;
}

export async function saveConversation(c: Conversation): Promise<void> {
  const db = await getDb();
  await db.put(DbStore.CONVERSATIONS, c);
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const db = await getDb();
  return db.get(DbStore.CONVERSATIONS, id);
}

export async function listConversationsForScript(scriptId: string): Promise<Conversation[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex(DbStore.CONVERSATIONS, 'byScriptId', scriptId);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([DbStore.CONVERSATIONS, DbStore.MESSAGES], 'readwrite');
  await tx.objectStore(DbStore.CONVERSATIONS).delete(id);
  const msgIdx = tx.objectStore(DbStore.MESSAGES).index('byConversationId');
  let cursor = await msgIdx.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function appendMessage(conversationId: string, msg: ChatMessage): Promise<void> {
  const db = await getDb();
  await db.put(DbStore.MESSAGES, { ...msg, conversationId });
}

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex(DbStore.MESSAGES, 'byConversationId', conversationId);
  return all.map(({ conversationId: _cid, ...m }) => m).sort((a, b) => a.createdAt - b.createdAt);
}
