'use client';

import { openDB, type IDBPDatabase } from 'idb';
import type { Chat, MemoryItem, AppSettings } from '@/types';

const DB_NAME = 'yosseling-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB is unavailable in this environment'));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
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
          const store = transaction.objectStore('memory');
          if (!store.indexNames.contains('importance')) store.createIndex('importance', 'importance');
          if (!store.indexNames.contains('type')) store.createIndex('type', 'type');
        }
      },
    });
  }
  const current = dbPromise;
  return current.catch((error: unknown) => {
    if (dbPromise === current) dbPromise = null;
    throw error;
  });
}

// ── Chats ──────────────────────────────────────────────────
export async function saveChat(chat: Chat) {
  (await getDB()).put('chats', chat);
}
export async function getAllChats(): Promise<Chat[]> {
  try {
    const load = (await getDB()).getAll('chats') as Promise<Chat[]>;
    const timeout = new Promise<Chat[]>((resolve) => {
      globalThis.setTimeout(() => resolve([]), 2000);
    });
    const chats = await Promise.race([load, timeout]);
    return chats.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
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
  try {
    const load = (await getDB()).getAll('memory') as Promise<MemoryItem[]>;
    const timeout = new Promise<MemoryItem[]>((resolve) => {
      globalThis.setTimeout(() => resolve([]), 2000);
    });
    const items = await Promise.race([load, timeout]);
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
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
  userNickname: '',
  userAvatar: null,
  animatedBackground: true,
  voice: { enabled: true, voiceName: '', rate: 1.0, pitch: 1.0, volume: 1.0, language: 'es' },
  autoSave: true,
  streamingEnabled: true,
  showTokenCount: true,
  showResponseTime: true,
  memoryEnabled: true,
  memoryAutoSave: true,
  personality: 'amigable',
  adaptiveProfile: {
    tonePreference: null,
    frequentTopics: [],
    responseStyle: 'balanced',
    languageFormality: 'casual',
    interactionCount: 0,
    lastUpdated: 0,
  },
  pendingOfflineInstall: false,
  runtimeMode: 'cloud',
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
  try {
    localStorage.setItem('yosseling-settings', JSON.stringify(settings));
  } catch {
    // Storage can be blocked in restricted WebViews; keep the in-memory settings usable.
  }
}
