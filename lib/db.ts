'use client';

import { openDB, type IDBPDatabase } from 'idb';
import type { Chat, MemoryItem, AppSettings } from '@/types';

const DB_NAME = 'yosseling-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('chats')) {
          const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
          chatStore.createIndex('updatedAt', 'updatedAt');
          chatStore.createIndex('isPinned', 'isPinned');
        }
        if (!db.objectStoreNames.contains('memory')) {
          const memStore = db.createObjectStore('memory', { keyPath: 'id' });
          memStore.createIndex('category', 'category');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// Chats
export async function saveChat(chat: Chat): Promise<void> {
  const db = await getDB();
  await db.put('chats', chat);
}

export async function getChat(id: string): Promise<Chat | undefined> {
  const db = await getDB();
  return db.get('chats', id);
}

export async function getAllChats(): Promise<Chat[]> {
  const db = await getDB();
  const chats = await db.getAll('chats');
  return chats.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteChat(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('chats', id);
}

export async function clearAllChats(): Promise<void> {
  const db = await getDB();
  await db.clear('chats');
}

// Memory
export async function saveMemoryItem(item: MemoryItem): Promise<void> {
  const db = await getDB();
  await db.put('memory', item);
}

export async function getAllMemory(): Promise<MemoryItem[]> {
  const db = await getDB();
  const items = await db.getAll('memory');
  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteMemoryItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('memory', id);
}

export async function clearAllMemory(): Promise<void> {
  const db = await getDB();
  await db.clear('memory');
}

// Settings (localStorage fallback for speed)
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'es',
  fontSize: 'medium',
  primaryColor: '#7C3AED',
  defaultModel: 'llama-3.3-70b-versatile',
  defaultProvider: 'groq',
  userName: 'Usuario',
  voice: {
    enabled: true,
    voiceName: '',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    language: 'es',
  },
  autoSave: true,
  streamingEnabled: true,
  showTokenCount: true,
  showResponseTime: true,
};

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem('yosseling-settings');
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('yosseling-settings', JSON.stringify(settings));
}
