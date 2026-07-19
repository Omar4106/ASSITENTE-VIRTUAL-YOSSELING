/**
 * Stocks provider — uses search providers when no dedicated API is configured.
 * Exposes a stocks() method that builds a market-tuned query and delegates
 * to the configured search fallback chain.
 */
import type { IStocksProvider, ISearchProvider } from '../interfaces';
import type { RealtimeResult, StocksRequest } from '../types';
import { nowIso } from '../utils';

export function createStocksProvider(
  searchChain: ISearchProvider[],
): IStocksProvider {
  return {
    id: 'stocks',
    name: 'Stocks (via search)',
    domain: 'stocks',

    isConfigured() {
      return searchChain.some(p => p.isConfigured());
    },

    async stocks(req: StocksRequest): Promise<RealtimeResult> {
      const query = `${req.symbol} stock price cotización bolsa`;
      for (const p of searchChain) {
        if (!p.isConfigured()) continue;
        try {
          const r = await p.search({ query, maxResults: 5, freshness: 'day' });
          return {
            ...r,
            domain: 'stocks',
            query: req.symbol,
            fetchedAt: nowIso(),
          };
        } catch {
          // try next
        }
      }
      return {
        query: req.symbol,
        domain: 'stocks',
        fetchedAt: nowIso(),
        confidence: 'low',
        sources: [],
        summary: 'No se pudo obtener cotización en tiempo real.',
      };
    },
  };
}
