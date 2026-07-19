/**
 * Sports provider — delegates to search providers with a sports-tuned query.
 */
import type { ISearchProvider, ISportsProvider } from '../interfaces';
import type { RealtimeResult, SportsRequest } from '../types';
import { nowIso } from '../utils';

export function createSportsProvider(
  searchChain: ISearchProvider[],
): ISportsProvider {
  return {
    id: 'sports',
    name: 'Sports (via search)',
    domain: 'sports',

    isConfigured() {
      return searchChain.some(p => p.isConfigured());
    },

    async sports(req: SportsRequest): Promise<RealtimeResult> {
      const leaguePart = req.league ? `${req.league} ` : '';
      const query = `${leaguePart}${req.query} resultado marcador hoy`;
      for (const p of searchChain) {
        if (!p.isConfigured()) continue;
        try {
          const r = await p.search({
            query,
            maxResults: req.maxResults ?? 6,
            freshness: 'day',
          });
          return { ...r, domain: 'sports', query: req.query, fetchedAt: nowIso() };
        } catch {
          // try next
        }
      }
      return {
        query: req.query,
        domain: 'sports',
        fetchedAt: nowIso(),
        confidence: 'low',
        sources: [],
        summary: 'No se pudo obtener información deportiva reciente.',
      };
    },
  };
}
