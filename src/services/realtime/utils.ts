/**
 * Realtime Service — Shared utilities.
 */
import type { RealtimeSource } from './types';

export function isNonEmpty(s: string | undefined | null): s is string {
  return Boolean(s && s.trim().length > 0);
}

export function safeUrl(url: string | undefined | null): string | null {
  if (!isNonEmpty(url)) return null;
  try {
    const u = new URL(url as string);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function dedupeSources(sources: RealtimeSource[]): RealtimeSource[] {
  const seen = new Set<string>();
  const out: RealtimeSource[] = [];
  for (const s of sources) {
    const url = safeUrl(s.url);
    if (!url) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!isNonEmpty(s.title)) continue;
    out.push({ ...s, url });
  }
  return out;
}

export function limitSources(sources: RealtimeSource[], max: number): RealtimeSource[] {
  return sources.slice(0, max);
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); },
    );
  });
}

export function confidenceFromCount(n: number): 'high' | 'medium' | 'low' {
  if (n >= 4) return 'high';
  if (n >= 2) return 'medium';
  return 'low';
}
