/**
 * Location/maps provider — delegates to search providers with a location-tuned query.
 */
import type { ILocationProvider, ISearchProvider } from '../interfaces';
import type { LocationRequest, RealtimeResult } from '../types';
import { nowIso } from '../utils';

export function createLocationProvider(
  searchChain: ISearchProvider[],
): ILocationProvider {
  return {
    id: 'location',
    name: 'Location (via search)',
    domain: 'location',

    isConfigured() {
      return searchChain.some(p => p.isConfigured());
    },

    async location(req: LocationRequest): Promise<RealtimeResult> {
      const query = `${req.query} ubicación dirección mapa horario`;
      for (const p of searchChain) {
        if (!p.isConfigured()) continue;
        try {
          const r = await p.search({ query, maxResults: 6 });
          return { ...r, domain: 'location', query: req.query, fetchedAt: nowIso() };
        } catch {
          // try next
        }
      }
      return {
        query: req.query,
        domain: 'location',
        fetchedAt: nowIso(),
        confidence: 'low',
        sources: [],
        summary: 'No se pudo obtener información de ubicación.',
      };
    },
  };
}
