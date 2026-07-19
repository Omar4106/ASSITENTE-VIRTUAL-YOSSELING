/**
 * Traffic provider — delegates to search providers with a traffic-tuned query.
 */
import type { ISearchProvider, ITrafficProvider } from '../interfaces';
import type { RealtimeResult, TrafficRequest } from '../types';
import { nowIso } from '../utils';

export function createTrafficProvider(
  searchChain: ISearchProvider[],
): ITrafficProvider {
  return {
    id: 'traffic',
    name: 'Traffic (via search)',
    domain: 'traffic',

    isConfigured() {
      return searchChain.some(p => p.isConfigured());
    },

    async traffic(req: TrafficRequest): Promise<RealtimeResult> {
      const query = `tráfico ruta ${req.origin} a ${req.destination} estado`;
      for (const p of searchChain) {
        if (!p.isConfigured()) continue;
        try {
          const r = await p.search({ query, maxResults: 5, freshness: 'day' });
          return { ...r, domain: 'traffic', query: `${req.origin} → ${req.destination}`, fetchedAt: nowIso() };
        } catch {
          // try next
        }
      }
      return {
        query: `${req.origin} → ${req.destination}`,
        domain: 'traffic',
        fetchedAt: nowIso(),
        confidence: 'low',
        sources: [],
        summary: 'No se pudo obtener información de tráfico en tiempo real.',
      };
    },
  };
}
