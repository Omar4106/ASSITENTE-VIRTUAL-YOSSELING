/**
 * Cache validator — decides whether a cached entry is still usable.
 */
import type { CacheEntry, RealtimeResult } from '../types';

export function isCacheValid(entry: CacheEntry | null): entry is CacheEntry {
  if (!entry) return false;
  return Date.now() <= entry.expiresAt;
}

export function shouldBypassCache(result: RealtimeResult | null): boolean {
  if (!result) return true;
  return result.sources.length === 0 && result.confidence === 'low';
}
