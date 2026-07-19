/**
 * News provider — uses NEWS_API_KEY if available, otherwise falls back to
 * search providers with a news-tuned query.
 */
import { getEnvVar } from '@/lib/env';
import type { INewsProvider } from '../interfaces';
import type { NewsRequest, RealtimeResult } from '../types';
import { REALTIME_CONFIG } from '../config';
import { confidenceFromCount, dedupeSources, isNonEmpty, limitSources, nowIso, safeUrl, truncate, withTimeout } from '../utils';

interface NewsApiArticle {
  title: string;
  url: string;
  description?: string;
  content?: string;
  publishedAt?: string;
}

interface NewsApiResponse {
  articles?: NewsApiArticle[];
  status?: string;
}

export const newsProvider: INewsProvider = {
  id: 'news',
  name: 'News API',
  domain: 'news',

  isConfigured() {
    return Boolean(getEnvVar('NEWS_API_KEY'));
  },

  async news(req: NewsRequest): Promise<RealtimeResult> {
    const apiKey = getEnvVar('NEWS_API_KEY');
    if (!apiKey) throw new Error('NEWS_API_KEY not configured');

    const params = new URLSearchParams({
      q: req.query,
      language: 'es',
      sortBy: 'publishedAt',
      pageSize: String(req.maxResults ?? REALTIME_CONFIG.maxResultsPerProvider),
    });
    if (req.country) params.set('country', req.country);
    if (req.category) params.set('category', req.category);

    const res = await withTimeout(fetch(
      `https://newsapi.org/v2/everything?${params}`,
      { headers: { 'X-Api-Key': apiKey } },
    ), REALTIME_CONFIG.requestTimeoutMs);

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`news: ${res.status} ${truncate(err, 200)}`);
    }

    const data = (await res.json()) as NewsApiResponse;
    const raw = (data.articles ?? [])
      .filter(a => isNonEmpty(a.title) && safeUrl(a.url))
      .map(a => ({
        title: a.title,
        url: a.url,
        snippet: a.description,
        content: a.content,
        publishedAt: a.publishedAt,
      }));

    const sources = limitSources(dedupeSources(raw), REALTIME_CONFIG.maxSourcesInPrompt);

    return {
      query: req.query,
      domain: 'news',
      fetchedAt: nowIso(),
      confidence: confidenceFromCount(sources.length),
      sources,
      raw: data,
    };
  },
};
