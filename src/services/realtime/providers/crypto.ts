/**
 * Crypto provider — CoinGecko public API (no key required).
 */
import type { ICryptoProvider } from '../interfaces';
import type { CryptoRequest, RealtimeResult } from '../types';
import { confidenceFromCount, dedupeSources, limitSources, nowIso, truncate, withTimeout } from '../utils';

interface CoinGeckoResponse {
  [symbol: string]: { usd?: number; eur?: number; last_updated?: string };
}

export const cryptoProvider: ICryptoProvider = {
  id: 'crypto',
  name: 'CoinGecko',
  domain: 'crypto',

  isConfigured() {
    return true;
  },

  async crypto(req: CryptoRequest): Promise<RealtimeResult> {
    const currency = (req.currency ?? 'usd').toLowerCase();
    const symbol = req.symbol.toLowerCase().replace(/[^a-z0-9]/g, '');
    const ids = symbol || 'bitcoin,ethereum';

    const params = new URLSearchParams({
      ids,
      vs_currencies: currency,
      include_last_updated_at: 'true',
    });

    const res = await withTimeout(fetch(
      `https://api.coingecko.com/api/v3/simple/price?${params}`,
      { headers: { Accept: 'application/json' } },
    ), 8000);

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`crypto: ${res.status} ${truncate(err, 200)}`);
    }

    const data = (await res.json()) as CoinGeckoResponse;
    const sources = limitSources(dedupeSources(
      Object.entries(data).map(([id, prices]) => ({
        title: `${id} price`,
        url: `https://www.coingecko.com/en/coins/${id}`,
        snippet: prices.usd !== undefined ? `1 ${id} = ${prices.usd} ${currency.toUpperCase()}` : '',
        publishedAt: prices.last_updated,
      })),
    ), 3);

    const summary = sources.length
      ? sources.map(s => s.snippet).filter(Boolean).join(' · ')
      : 'No se encontró el símbolo solicitado.';

    return {
      query: req.symbol,
      domain: 'crypto',
      fetchedAt: nowIso(),
      confidence: sources.length ? 'high' : 'low',
      sources,
      summary,
      raw: data,
    };
  },
};
