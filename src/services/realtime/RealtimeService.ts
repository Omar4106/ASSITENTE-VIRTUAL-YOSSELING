/**
 * RealtimeService — central orchestrator.
 *
 * Responsibilities:
 *  - Detect whether a user message needs realtime info (IntentDetector).
 *  - Route the request to the appropriate domain provider.
 *  - Apply fallback across search providers when a primary fails.
 *  - Cache results with per-domain TTLs.
 *  - Validate and sanitize responses.
 *  - Build the final prompt context for the AI router.
 *
 * The AI Router never contacts the internet directly — it always goes
 * through this service.
 */
import { CACHE_TTL_MS, DOMAIN_FALLBACK, REALTIME_CONFIG } from './config';
import { cacheKey, getCached, setCached } from './cache';
import { detectIntent } from './detector/IntentDetector';
import { buildRealtimeContext } from './detector/PromptBuilder';
import { sanitizeResult } from './validators/ResponseValidator';
import { validateSearchRequest } from './validators/SearchValidator';
import type {
  CryptoRequest, FlightsRequest,
  IntentDetectionResult, LocationRequest, NewsRequest,
  RealtimeContext, RealtimeDomain, RealtimeResult, SearchRequest, SportsRequest,
  StocksRequest, TrafficRequest, WeatherRequest,
} from './types';
import type { AnyRealtimeProvider, INewsProvider, IWeatherProvider, ISearchProvider } from './interfaces';
import { isResultUsable } from './validators/ResponseValidator';
import { braveProvider } from './providers/brave';
import { bingProvider } from './providers/bing';
import { cryptoProvider } from './providers/crypto';
import { duckduckgoProvider } from './providers/duckduckgo';
import { googleProvider } from './providers/google';
import { newsProvider } from './providers/news';
import { serperProvider } from './providers/serper';
import { tavilyProvider } from './providers/tavily';
import { weatherProvider } from './providers/weather';
import { createFlightsProvider } from './providers/flights';
import { createLocationProvider } from './providers/location';
import { createSchedulerProvider, type ISchedulerProviderLike } from './providers/scheduler';
import { createSportsProvider } from './providers/sports';
import { createStocksProvider } from './providers/stocks';
import { createTrafficProvider } from './providers/traffic';

class RealtimeService {
  private searchProviders: ISearchProvider[];
  private news: INewsProvider;
  private weather: IWeatherProvider;
  private crypto = cryptoProvider;
  private stocks: ReturnType<typeof createStocksProvider>;
  private sports: ReturnType<typeof createSportsProvider>;
  private traffic: ReturnType<typeof createTrafficProvider>;
  private flights: ReturnType<typeof createFlightsProvider>;
  private location: ReturnType<typeof createLocationProvider>;
  private scheduler: ISchedulerProviderLike;

  constructor() {
    this.searchProviders = [
      tavilyProvider, serperProvider, braveProvider,
      bingProvider, googleProvider, duckduckgoProvider,
    ];
    this.news = newsProvider;
    this.weather = weatherProvider;
    this.stocks = createStocksProvider(this.searchProviders);
    this.sports = createSportsProvider(this.searchProviders);
    this.traffic = createTrafficProvider(this.searchProviders);
    this.flights = createFlightsProvider(this.searchProviders);
    this.location = createLocationProvider(this.searchProviders);
    this.scheduler = createSchedulerProvider(this.searchProviders);
  }

  detect(message: string): IntentDetectionResult {
    return detectIntent(message);
  }

  isConfigured(): boolean {
    return this.searchProviders.some(p => p.isConfigured())
      || this.news.isConfigured()
      || this.weather.isConfigured()
      || this.crypto.isConfigured();
  }

  /** Run a search across the configured fallback chain for a domain. */
  private async runSearchChain(
    domain: RealtimeDomain,
    req: SearchRequest,
  ): Promise<RealtimeResult | null> {
    const chain = DOMAIN_FALLBACK[domain] ?? DOMAIN_FALLBACK.search;
    const providers = chain
      .map(id => this.searchProviders.find(p => p.id === id))
      .filter((p): p is ISearchProvider => Boolean(p));

    const v = validateSearchRequest(req);
    if (!v.ok || !v.normalized) return null;

    for (const p of providers) {
      if (!p.isConfigured()) continue;
      try {
        const r = await p.search(v.normalized);
        const sanitized = sanitizeResult(r);
        if (isResultUsable(sanitized)) return sanitized;
      } catch (e) {
        console.warn(`[RealtimeService] ${p.id} failed for "${req.query}":`, e);
        // continue to next provider
      }
    }
    return null;
  }

  private async runWithCache(
    domain: RealtimeDomain,
    key: string,
    fn: () => Promise<RealtimeResult | null>,
  ): Promise<RealtimeResult | null> {
    if (!REALTIME_CONFIG.enableCache) return fn();
    const cached = getCached(cacheKey(domain, key));
    if (cached) return cached;
    const result = await fn();
    if (result) setCached(cacheKey(domain, key), result, CACHE_TTL_MS[domain] ?? CACHE_TTL_MS.search);
    return result;
  }

  async fetch(message: string): Promise<RealtimeContext | null> {
    const intent = this.detect(message);
    if (!intent.needsRealtime || !intent.domain) return null;

    const domain = intent.domain;
    let result: RealtimeResult | null = null;

    try {
      result = await this.runWithCache(domain, intent.query, async () => {
        switch (domain) {
          case 'search':
            return this.runSearchChain('search', { query: intent.query, maxResults: 6 });
          case 'news': {
            if (this.news.isConfigured()) {
              try {
                const r = sanitizeResult(await this.news.news({ query: intent.query, maxResults: 6 }));
                if (isResultUsable(r)) return r;
              } catch (e) {
                console.warn('[RealtimeService] news failed, falling back to search:', e);
              }
            }
            return this.runSearchChain('news', { query: `noticias ${intent.query}`, maxResults: 6, freshness: 'day' });
          }
          case 'weather': {
            const loc = extractLocation(intent.query) ?? intent.query;
            const req: WeatherRequest = { location: loc };
            if (this.weather.isConfigured()) {
              try {
                const r = sanitizeResult(await this.weather.weather(req));
                if (isResultUsable(r)) return r;
              } catch (e) {
                console.warn('[RealtimeService] weather failed, falling back to search:', e);
              }
            }
            return this.runSearchChain('weather', { query: `clima ${loc} hoy`, maxResults: 4 });
          }
          case 'crypto': {
            const symbol = extractCryptoSymbol(intent.query) ?? 'bitcoin';
            const req: CryptoRequest = { symbol };
            try {
              const r = sanitizeResult(await this.crypto.crypto(req));
              if (isResultUsable(r)) return r;
            } catch (e) {
              console.warn('[RealtimeService] crypto failed, falling back to search:', e);
            }
            return this.runSearchChain('crypto', { query: `precio ${symbol} hoy`, maxResults: 4, freshness: 'day' });
          }
          case 'stocks': {
            const symbol = extractStockSymbol(intent.query) ?? intent.query;
            const req: StocksRequest = { symbol };
            return sanitizeResult(await this.stocks.stocks(req));
          }
          case 'sports': {
            const req: SportsRequest = { query: intent.query };
            return sanitizeResult(await this.sports.sports(req));
          }
          case 'traffic': {
            const { origin, destination } = extractRoute(intent.query);
            const req: TrafficRequest = { origin, destination };
            return sanitizeResult(await this.traffic.traffic(req));
          }
          case 'flights': {
            const req: FlightsRequest = { query: intent.query };
            return sanitizeResult(await this.flights.flights(req));
          }
          case 'location': {
            const req: LocationRequest = { query: intent.query };
            return sanitizeResult(await this.location.location(req));
          }
          case 'scheduler': {
            return sanitizeResult(await this.scheduler.search({ query: intent.query, maxResults: 6, freshness: 'month' }));
          }
          default:
            return null;
        }
      });
    } catch (e) {
      console.error('[RealtimeService] fetch error:', e);
      return null;
    }

    if (!result || !isResultUsable(result)) return null;

    return buildRealtimeContext(intent.query, domain, [result]);
  }

  /** Convenience accessor for tests / debugging. */
  getProviders(): AnyRealtimeProvider[] {
    return [
      ...this.searchProviders,
      this.news,
      this.weather,
      this.crypto,
      this.stocks,
      this.sports,
      this.traffic,
      this.flights,
      this.location,
      this.scheduler,
    ];
  }
}

// ── Small extraction helpers ────────────────────────────────────────────────

function extractLocation(text: string): string | null {
  const m = text.match(/(?:en|de|para)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]{2,40})/u);
  return m ? m[1].trim() : null;
}

function extractCryptoSymbol(text: string): string | null {
  const m = text.match(/\b(bitcoin|btc|ethereum|eth|litecoin|dogecoin|cardano|solana|usdt|binance coin)\b/i);
  return m ? m[1].toLowerCase() : null;
}

function extractStockSymbol(text: string): string | null {
  const m = text.match(/\b([A-Z]{1,5})\s+(?:stock|acción|accion|cotización|cotizacion)\b/);
  return m ? m[1] : null;
}

function extractRoute(text: string): { origin: string; destination: string } {
  const m = text.match(/(?:de|desde)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{2,40})\s+(?:a|hasta)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{2,40})/u);
  if (m) return { origin: m[1].trim(), destination: m[2].trim() };
  return { origin: '', destination: text };
}

// Singleton — shared across requests.
export const realtimeService = new RealtimeService();
export type { RealtimeService };
