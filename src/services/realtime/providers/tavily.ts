/**
 * Tavily search provider — AI-optimized web search.
 */
import { getEnvVar } from '@/lib/env';
import type { ISearchProvider } from '../interfaces';
import type { RealtimeResult, SearchRequest } from '../types';
import { REALTIME_CONFIG } from '../config';
import { confidenceFromCount, dedupeSources, isNonEmpty, limitSources, nowIso, safeUrl, truncate, withTimeout } from '../utils';

interface TavilyResult {
  title: string;
  url: string;
  content?: string;
  score?: number;
}

interface TavilyResponse {
  results?: TavilyResult[];
  answer?: string;
}

export const tavilyProvider: ISearchProvider = {
  id: 'tavily',
  name: 'Tavily',
  domain: 'search',

  isConfigured() {
    return Boolean(getEnvVar('TAVILY_API_KEY'));
  },

  async search(req: SearchRequest): Promise<RealtimeResult> {
    const apiKey = getEnvVar('TAVILY_API_KEY');
    if (!apiKey) throw new Error('TAVILY_API_KEY not configured');

    const body = {
      query: req.query,
      max_results: req.maxResults ?? REALTIME_CONFIG.maxResultsPerProvider,
      search_depth: 'advanced',
      include_answer: true,
      ...(req.freshness ? { time_range: req.freshness } : {}),
    };

    const res = await withTimeout(fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }), REALTIME_CONFIG.requestTimeoutMs);

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`tavily: ${res.status} ${truncate(err, 200)}`);
    }

    const data = (await res.json()) as TavilyResponse;
    const raw = (data.results ?? [])
      .filter(r => isNonEmpty(r.title) && safeUrl(r.url))
      .map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.content ? truncate(r.content, 500) : undefined,
        content: r.content,
      }));

    const sources = limitSources(dedupeSources(raw), REALTIME_CONFIG.maxSourcesInPrompt);

    return {
      query: req.query,
      domain: 'search',
      fetchedAt: nowIso(),
      confidence: confidenceFromCount(sources.length),
      sources,
      summary: data.answer,
      raw: data,
    };
  },
};
