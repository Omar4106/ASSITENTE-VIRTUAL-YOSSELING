/**
 * Flights provider — delegates to search providers with a flights-tuned query.
 */
import type { IFlightsProvider, ISearchProvider } from '../interfaces';
import type { FlightsRequest, RealtimeResult } from '../types';
import { nowIso } from '../utils';

export function createFlightsProvider(
  searchChain: ISearchProvider[],
): IFlightsProvider {
  return {
    id: 'flights',
    name: 'Flights (via search)',
    domain: 'flights',

    isConfigured() {
      return searchChain.some(p => p.isConfigured());
    },

    async flights(req: FlightsRequest): Promise<RealtimeResult> {
      const route = req.from && req.to ? `${req.from} ${req.to} ` : '';
      const datePart = req.date ? `${req.date} ` : '';
      const query = `${route}${datePart}vuelo estado salida llegada`;
      for (const p of searchChain) {
        if (!p.isConfigured()) continue;
        try {
          const r = await p.search({
            query,
            maxResults: req.maxResults ?? 6,
            freshness: 'day',
          });
          return { ...r, domain: 'flights', query, fetchedAt: nowIso() };
        } catch {
          // try next
        }
      }
      return {
        query,
        domain: 'flights',
        fetchedAt: nowIso(),
        confidence: 'low',
        sources: [],
        summary: 'No se pudo obtener información de vuelos en tiempo real.',
      };
    },
  };
}
