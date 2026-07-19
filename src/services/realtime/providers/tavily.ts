/**
 * Tavily search provider — AI-optimized web search.
 *
 * Official API reference: https://docs.tavily.com/documentation/api-reference/endpoint/search
 * Endpoint: POST https://api.tavily.com/search
 * Auth: Bearer <TAVILY_API_KEY>  (also accepts api_key field in body)
 *
 * Tavily is the PRIMARY search provider for the Realtime Service.
 * If Tavily returns usable results, no other provider is consulted.
 */
import { getEnvVar } from '@/lib/env';
import type { ISearchProvider } from '../interfaces';
import type { RealtimeResult, RealtimeSource, SearchRequest } from '../types';
import { REALTIME_CONFIG } from '../config';
import {
  confidenceFromCount, dedupeSources, isNonEmpty, limitSources,
  nowIso, safeUrl, truncate, withTimeout,
} from '../utils';

interface TavilyRawResult {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string | null;
  score?: number;
  published_date?: string;
}

interface TavilyResponse {
  results?: TavilyRawResult[];
  answer?: string;
  query?: string;
  response_time?: number;
}

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

/** Map a raw Tavily result into the internal RealtimeSource shape. */
function mapTavilyResult(r: TavilyRawResult): RealtimeSource | null {
  const url = safeUrl(r.url);
  if (!url || !isNonEmpty(r.title)) return null;
  const snippet = isNonEmpty(r.content) ? truncate(r.content!, 600) : undefined;
  const content = isNonEmpty(r.raw_content) ? truncate(r.raw_content!, 2000) : undefined;
  return {
    title: truncate(r.title!.trim(), 200),
    url,
    snippet,
    content: content ?? snippet,
    publishedAt: r.published_date,
  };
}

async function callTavily(req: SearchRequest, attempt: number): Promise<Response> {
  const apiKey = getEnvVar('TAVILY_API_KEY');
  if (!apiKey) throw new Error('TAVILY_API_KEY not configured');

  const body = {
    query: req.query,
    max_results: req.maxResults ?? REALTIME_CONFIG.maxResultsPerProvider,
    search_depth: 'advanced',
    include_answer: true,
    include_raw_content: false,
    ...(req.freshness ? { time_range: req.freshness } : {}),
  };

  console.log(`[Realtime] Sending request... (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);

  return withTimeout(
    fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }),
    REALTIME_CONFIG.requestTimeoutMs,
  );
}

export const tavilyProvider: ISearchProvider = {
  id: 'tavily',
  name: 'Tavily',
  domain: 'search',

  isConfigured() {
    return Boolean(getEnvVar('TAVILY_API_KEY'));
  },

  async search(req: SearchRequest): Promise<RealtimeResult> {
    console.log('[Realtime] Provider: Tavily');
    console.log(`[Realtime] Query: "${req.query}"`);

    const apiKey = getEnvVar('TAVILY_API_KEY');
    if (!apiKey) {
      console.log('[Realtime] Tavily Error: TAVILY_API_KEY not configured');
      throw new Error('TAVILY_API_KEY not configured');
    }

    let lastError: Error | null = null;
    let response: Response | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        response = await callTavily(req, attempt);
        console.log(`[Realtime] HTTP Status: ${response.status} ${response.statusText}`);

        if (response.ok) break;

        const errText = await response.text().catch(() => '');
        lastError = new Error(`tavily: ${response.status} ${truncate(errText, 200)}`);

        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === MAX_RETRIES) {
          console.log('[Realtime] Tavily Error:', lastError.message);
          throw lastError;
        }
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        const isTimeout = lastError.message === 'timeout';
        if (attempt === MAX_RETRIES || !isTimeout) {
          console.log('[Realtime] Tavily Error:', lastError.message);
          throw lastError;
        }
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }

    if (!response || !response.ok) {
      throw lastError ?? new Error('tavily: unknown failure');
    }

    const data = (await response.json()) as TavilyResponse;
    const rawSources = (data.results ?? [])
      .map(mapTavilyResult)
      .filter((s): s is RealtimeSource => s !== null);

    const sources = limitSources(dedupeSources(rawSources), REALTIME_CONFIG.maxSourcesInPrompt);

    console.log(`[Realtime] Results: ${sources.length} source(s) from Tavily`);
    if (data.answer) {
      console.log(`[Realtime] Answer: ${truncate(data.answer, 200)}`);
    }
    if (sources.length === 0) {
      console.log('[Realtime] Tavily returned 0 usable results');
    } else {
      sources.forEach((s, i) => {
        console.log(`[Realtime]   [${i + 1}] ${s.title} — ${s.url}`);
      });
      console.log('[Realtime] Context injected successfully');
    }

    return {
      query: req.query,
      domain: 'search',
      fetchedAt: nowIso(),
      confidence: confidenceFromCount(sources.length),
      sources,
      summary: isNonEmpty(data.answer) ? truncate(data.answer!, 800) : undefined,
      raw: data,
    };
  },
};
