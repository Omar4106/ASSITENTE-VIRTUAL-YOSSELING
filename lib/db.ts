'use client';

import { openDB, type IDBPDatabase } from 'idb';
import type { Chat, MemoryItem, AppSettings } from '@/types';

const DB_NAME = 'yosseling-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains('chats')) {
            const s = db.createObjectStore('chats', { keyPath: 'id' });
            s.createIndex('updatedAt', 'updatedAt');
            s.createIndex('isPinned', 'isPinned');
          }
          if (!db.objectStoreNames.contains('memory')) {
            const m = db.createObjectStore('memory', { keyPath: 'id' });
            m.createIndex('category', 'category');
          }
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'id' });
          }
        }
        // v2: extra indexes for enhanced MemoryItem
        if (oldVersion < 2 && db.objectStoreNames.contains('memory')) {
          const tx = db.transaction('memory', 'versionchange');
          const store = tx.objectStore('memory');
          if (!store.indexNames.contains('importance')) store.createIndex('importance', 'importance');
          if (!store.indexNames.contains('type')) store.createIndex('type', 'type');
        }
      },
    });
  }
  return dbPromise;
}

// ── Chats ──────────────────────────────────────────────────
export async function saveChat(chat: Chat) {
  (await getDB()).put('chats', chat);
}
export async function getAllChats(): Promise<Chat[]> {
  const chats = await (await getDB()).getAll('chats');
  return chats.sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function deleteChat(id: string) {
  (await getDB()).delete('chats', id);
}
export async function clearAllChats() {
  (await getDB()).clear('chats');
}

// ── Memory ─────────────────────────────────────────────────
export async function saveMemoryItem(item: MemoryItem) {
  (await getDB()).put('memory', item);
}
export async function getAllMemory(): Promise<MemoryItem[]> {
  const items = await (await getDB()).getAll('memory');
  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function deleteMemoryItem(id: string) {
  (await getDB()).delete('memory', id);
}
export async function clearAllMemory() {
  (await getDB()).clear('memory');
}

// ── Settings ───────────────────────────────────────────────
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'es',
  fontSize: 'medium',
  primaryColor: '#7C3AED',
  defaultModel: 'llama-3.3-70b-versatile',
  defaultProvider: 'groq',
  userName: 'Usuario',
  voice: { enabled: true, voiceName: '', rate: 1.0, pitch: 1.0, volume: 1.0, language: 'es' },
  autoSave: true,
  streamingEnabled: true,
  showTokenCount: true,
  showResponseTime: true,
  memoryEnabled: true,
  memoryAutoSave: true,
  personality: 'amigable',
};

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem('yosseling-settings');
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { return DEFAULT_SETTINGS; }
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('yosseling-settings', JSON.stringify(settings));
}
