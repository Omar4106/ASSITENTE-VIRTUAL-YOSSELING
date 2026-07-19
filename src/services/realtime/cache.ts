/**
 * Realtime Service — In-memory TTL cache.
 * Lightweight, no external deps. Evicts expired entries lazily.
 */
import type { CacheEntry, RealtimeResult } from './types';

const store = new Map<string, CacheEntry>();

export function getCached<T = RealtimeResult>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as unknown as T;
}

export function setCached<T = RealtimeResult>(
  key: string,
  value: T,
  ttlMs: number,
): void {
  store.set(key, {
    key,
    value: value as unknown as RealtimeResult,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearCache(): void {
  store.clear();
}

export function pruneExpired(): number {
  let pruned = 0;
  const now = Date.now();
  store.forEach((v, k) => {
    if (now > v.expiresAt) {
      store.delete(k);
      pruned++;
    }
  });
  return pruned;
}

export function cacheKey(domain: string, query: string): string {
  return `${domain}::${query.trim().toLowerCase()}`;
}
