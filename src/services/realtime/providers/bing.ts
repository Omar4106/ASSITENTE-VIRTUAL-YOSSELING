/**
 * Bing Web Search API.
 */
import { getEnvVar } from '@/lib/env';
import type { ISearchProvider } from '../interfaces';
import type { RealtimeResult, SearchRequest } from '../types';
import { REALTIME_CONFIG } from '../config';
import { confidenceFromCount, dedupeSources, isNonEmpty, limitSources, nowIso, safeUrl, truncate, withTimeout } from '../utils';

interface BingWebPage {
  name: string;
  url: string;
  snippet?: string;
  datePublished?: string;
}

interface BingResponse {
  webPages?: { value?: BingWebPage[] };
}

export const bingProvider: ISearchProvider = {
  id: 'bing',
  name: 'Bing Search',
  domain: 'search',

  isConfigured() {
    return Boolean(getEnvVar('BING_SEARCH_API_KEY'));
  },

  async search(req: SearchRequest): Promise<RealtimeResult> {
    const apiKey = getEnvVar('BING_SEARCH_API_KEY');
    if (!apiKey) throw new Error('BING_SEARCH_API_KEY not configured');

    const params = new URLSearchParams({
      q: req.query,
      count: String(req.maxResults ?? REALTIME_CONFIG.maxResultsPerProvider),
      setLang: 'es',
    });

    const res = await withTimeout(fetch(
      `https://api.bing.microsoft.com/v7.0/search?${params}`,
      { headers: { 'Ocp-Apim-Subscription-Key': apiKey } },
    ), REALTIME_CONFIG.requestTimeoutMs);

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`bing: ${res.status} ${truncate(err, 200)}`);
    }

    const data = (await res.json()) as BingResponse;
    const raw = (data.webPages?.value ?? [])
      .filter(r => isNonEmpty(r.name) && safeUrl(r.url))
      .map(r => ({
        title: r.name,
        url: r.url,
        snippet: r.snippet,
        publishedAt: r.datePublished,
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
