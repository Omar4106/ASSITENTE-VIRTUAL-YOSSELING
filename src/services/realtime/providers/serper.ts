/**
 * Serper.dev — Google search results via API.
 */
import { getEnvVar } from '@/lib/env';
import type { ISearchProvider } from '../interfaces';
import type { RealtimeResult, SearchRequest } from '../types';
import { REALTIME_CONFIG } from '../config';
import { confidenceFromCount, dedupeSources, isNonEmpty, limitSources, nowIso, safeUrl, truncate, withTimeout } from '../utils';

interface SerperOrganic {
  title: string;
  link: string;
  snippet?: string;
}

interface SerperResponse {
  organic?: SerperOrganic[];
  knowledgeGraph?: { title?: string; description?: string };
}

export const serperProvider: ISearchProvider = {
  id: 'serper',
  name: 'Serper',
  domain: 'search',

  isConfigured() {
    return Boolean(getEnvVar('SERPER_API_KEY'));
  },

  async search(req: SearchRequest): Promise<RealtimeResult> {
    const apiKey = getEnvVar('SERPER_API_KEY');
    if (!apiKey) throw new Error('SERPER_API_KEY not configured');

    const body = {
      q: req.query,
      num: req.maxResults ?? REALTIME_CONFIG.maxResultsPerProvider,
      ...(req.freshness ? { tbs: `qdr:${req.freshness.charAt(0)}` } : {}),
    };

    const res = await withTimeout(fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify(body),
    }), REALTIME_CONFIG.requestTimeoutMs);

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`serper: ${res.status} ${truncate(err, 200)}`);
    }

    const data = (await res.json()) as SerperResponse;
    const raw = (data.organic ?? [])
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
      summary: data.knowledgeGraph?.description,
      raw: data,
    };
  },
};
