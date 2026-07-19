/**
 * Scheduler provider — for software releases, docs, versions, etc.
 * Delegates to search providers with a freshness-tuned query.
 */
import type { ISearchProvider } from '../interfaces';
import type { RealtimeResult, SearchRequest } from '../types';
import { nowIso } from '../utils';

export interface ISchedulerProviderLike {
  id: string;
  name: string;
  domain: 'scheduler';
  isConfigured(): boolean;
  search(req: SearchRequest): Promise<RealtimeResult>;
}

export function createSchedulerProvider(
  searchChain: ISearchProvider[],
): ISchedulerProviderLike {
  return {
    id: 'scheduler',
    name: 'Scheduler (via search)',
    domain: 'scheduler',

    isConfigured() {
      return searchChain.some(p => p.isConfigured());
    },

    async search(req: SearchRequest): Promise<RealtimeResult> {
      for (const p of searchChain) {
        if (!p.isConfigured()) continue;
        try {
          const r = await p.search({
            ...req,
            maxResults: req.maxResults ?? 6,
            freshness: req.freshness ?? 'month',
          });
          return { ...r, domain: 'scheduler', query: req.query, fetchedAt: nowIso() };
        } catch {
          // try next
        }
      }
      return {
        query: req.query,
        domain: 'scheduler',
        fetchedAt: nowIso(),
        confidence: 'low',
        sources: [],
        summary: 'No se pudo obtener información reciente sobre versiones o lanzamientos.',
      };
    },
  };
}
