/**
 * Google Custom Search JSON API.
 */
import { getEnvVar } from '@/lib/env';
import type { ISearchProvider } from '../interfaces';
import type { RealtimeResult, SearchRequest } from '../types';
import { REALTIME_CONFIG } from '../config';
import { confidenceFromCount, dedupeSources, isNonEmpty, limitSources, nowIso, safeUrl, truncate, withTimeout } from '../utils';

interface GoogleItem {
  title: string;
  link: string;
  snippet?: string;
}

interface GoogleResponse {
  items?: GoogleItem[];
}

export const googleProvider: ISearchProvider = {
  id: 'google',
  name: 'Google Custom Search',
  domain: 'search',

  isConfigured() {
    return Boolean(getEnvVar('GOOGLE_SEARCH_API_KEY')) && Boolean(getEnvVar('GOOGLE_CSE_ID'));
  },

  async search(req: SearchRequest): Promise<RealtimeResult> {
    const apiKey = getEnvVar('GOOGLE_SEARCH_API_KEY');
    const cseId = getEnvVar('GOOGLE_CSE_ID');
    if (!apiKey || !cseId) throw new Error('GOOGLE_SEARCH_API_KEY/GOOGLE_CSE_ID not configured');

    const params = new URLSearchParams({
      q: req.query,
      key: apiKey,
      cx: cseId,
      num: String(req.maxResults ?? REALTIME_CONFIG.maxResultsPerProvider),
    });

    const res = await withTimeout(fetch(
      `https://www.googleapis.com/customsearch/v1?${params}`,
    ), REALTIME_CONFIG.requestTimeoutMs);

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`google: ${res.status} ${truncate(err, 200)}`);
    }

    const data = (await res.json()) as GoogleResponse;
    const raw = (data.items ?? [])
      .filter(r => isNonEmpty(r.title) && safeUrl(r.link))
      .map(r => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
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
