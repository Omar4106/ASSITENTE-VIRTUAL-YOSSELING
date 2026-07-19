/**
 * Brave Search API.
 */
import { getEnvVar } from '@/lib/env';
import type { ISearchProvider } from '../interfaces';
import type { RealtimeResult, SearchRequest } from '../types';
import { REALTIME_CONFIG } from '../config';
import { confidenceFromCount, dedupeSources, isNonEmpty, limitSources, nowIso, safeUrl, truncate, withTimeout } from '../utils';

interface BraveResult {
  title: string;
  url: string;
  description?: string;
}

interface BraveResponse {
  web?: { results?: BraveResult[] };
}

export const braveProvider: ISearchProvider = {
  id: 'brave',
  name: 'Brave Search',
  domain: 'search',

  isConfigured() {
    return Boolean(getEnvVar('BRAVE_API_KEY'));
  },

  async search(req: SearchRequest): Promise<RealtimeResult> {
    const apiKey = getEnvVar('BRAVE_API_KEY');
    if (!apiKey) throw new Error('BRAVE_API_KEY not configured');

    const params = new URLSearchParams({
      q: req.query,
      count: String(req.maxResults ?? REALTIME_CONFIG.maxResultsPerProvider),
    });
    if (req.freshness) params.set('freshness', req.freshness);

    const res = await withTimeout(fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    }), REALTIME_CONFIG.requestTimeoutMs);

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`brave: ${res.status} ${truncate(err, 200)}`);
    }

    const data = (await res.json()) as BraveResponse;
    const raw = (data.web?.results ?? [])
      .filter(r => isNonEmpty(r.title) && safeUrl(r.url))
      .map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
      }));

    const sources = limitSources(dedupeSources(raw), REALTIME_CONFIG.maxSourcesInPrompt);

    return {
      query: req.query,
      domain: 'search',
      fetchedAt: nowIso(),
      confidence: confidenceFromCount(sources.length),
      sources,
      raw: data,
    };
  },
};
