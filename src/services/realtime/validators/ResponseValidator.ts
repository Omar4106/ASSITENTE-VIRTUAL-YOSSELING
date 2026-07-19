/**
 * Response validator — sanitizes RealtimeResult objects before they are
 * surfaced to the model or the user.
 */
import type { RealtimeResult, RealtimeSource } from '../types';
import { dedupeSources, isNonEmpty, limitSources, safeUrl, truncate } from '../utils';

export function sanitizeResult(result: RealtimeResult): RealtimeResult {
  const cleanedSources: RealtimeSource[] = [];
  for (const s of result.sources) {
    const url = safeUrl(s.url);
    if (!url || !isNonEmpty(s.title)) continue;
    cleanedSources.push({
      title: truncate(s.title.trim(), 200),
      url,
      snippet: isNonEmpty(s.snippet) ? truncate(s.snippet!, 600) : undefined,
      content: isNonEmpty(s.content) ? truncate(s.content!, 2000) : undefined,
      publishedAt: s.publishedAt,
    });
  }
  return {
    ...result,
    sources: limitSources(dedupeSources(cleanedSources), 5),
    summary: isNonEmpty(result.summary) ? truncate(result.summary!, 800) : undefined,
  };
}

export function isResultUsable(result: RealtimeResult | null): result is RealtimeResult {
  if (!result) return false;
  return result.sources.length > 0 || isNonEmpty(result.summary);
}
