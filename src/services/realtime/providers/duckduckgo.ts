/**
 * DuckDuckGo — no API key required (Instant Answer + fallback HTML lite endpoint).
 * This is a best-effort provider used as a last-resort fallback.
 */
import type { ISearchProvider } from '../interfaces';
import type { RealtimeResult, SearchRequest } from '../types';
import { REALTIME_CONFIG } from '../config';
import { confidenceFromCount, dedupeSources, isNonEmpty, limitSources, nowIso, safeUrl, truncate, withTimeout } from '../utils';

interface DDGRelated {
  text: string;
  firstURL?: string;
}

interface DDGTopicGroup {
  Topics?: DDGRelated[];
}

type DDGRelatedEntry = DDGRelated | DDGTopicGroup;

function isDDGRelated(e: DDGRelatedEntry): e is DDGRelated {
  return typeof (e as DDGRelated).text === 'string';
}

interface DDGResponse {
  RelatedTopics?: DDGRelatedEntry[];
  AbstractText?: string;
  AbstractURL?: string;
  Heading?: string;
}

export const duckduckgoProvider: ISearchProvider = {
  id: 'duckduckgo',
  name: 'DuckDuckGo',
  domain: 'search',

  isConfigured() {
    return true;
  },

  async search(req: SearchRequest): Promise<RealtimeResult> {
    const params = new URLSearchParams({
      q: req.query,
      format: 'json',
      no_html: '1',
      skip_disambig: '1',
    });

    const res = await withTimeout(fetch(
      `https://api.duckduckgo.com/?${params}`,
      { headers: { 'Accept': 'application/json' } },
    ), REALTIME_CONFIG.requestTimeoutMs);

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`duckduckgo: ${res.status} ${truncate(err, 200)}`);
    }

    const data = (await res.json()) as DDGResponse;
    const sources: { title: string; url: string; snippet?: string }[] = [];

    if (isNonEmpty(data.Heading) && safeUrl(data.AbstractURL ?? '')) {
      sources.push({
        title: data.Heading,
        url: data.AbstractURL!,
        snippet: data.AbstractText,
      });
    }

    for (const t of data.RelatedTopics ?? []) {
      if (isDDGRelated(t) && isNonEmpty(t.text) && safeUrl(t.firstURL)) {
        sources.push({
          title: truncate(t.text.split(' — ')[0] ?? t.text, 100),
          url: t.firstURL!,
          snippet: t.text,
        });
      }
    }

    const final = limitSources(dedupeSources(sources), REALTIME_CONFIG.maxSourcesInPrompt);

    return {
      query: req.query,
      domain: 'search',
      fetchedAt: nowIso(),
      confidence: confidenceFromCount(final.length),
      sources: final,
      raw: data,
    };
  },
};
