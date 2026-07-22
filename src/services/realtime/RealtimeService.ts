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
      console.log(`[Realtime] Selected Provider: ${p.id} (${p.name})`);
      console.log(`[Realtime] Searching... "${v.normalized.query}"`);
      try {
        const r = await p.search(v.normalized);
        const sanitized = sanitizeResult(r);
        console.log(`[Realtime] Search completed — ${sanitized.sources.length} source(s) from ${p.id}`);
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
    if (!intent.needsRealtime || !intent.domain) {
      console.log('[Realtime] No realtime data found');
      return null;
    }

    console.log(`[Realtime] Intent detected — domain=${intent.domain} confidence=${intent.confidence} keywords=[${intent.matchedKeywords.join(', ')}]`);

    const domain = intent.domain;
    let result: RealtimeResult | null = null;

    try {
      result = await this.runWithCache(domain, intent.query, async () => {
        switch (domain) {
          case 'search':
            return this.runSearchChain('search', { query: intent.query, maxResults: 6 });
          case 'news': {
            if (this.news.isConfigured()) {
              console.log(`[Realtime] Selected Provider: ${this.news.id} (${this.news.name})`);
              console.log(`[Realtime] Searching... "${intent.query}"`);
              try {
                const r = sanitizeResult(await this.news.news({ query: intent.query, maxResults: 6 }));
                console.log(`[Realtime] Search completed — ${r.sources.length} source(s) from ${this.news.id}`);
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
              console.log(`[Realtime] Selected Provider: ${this.weather.id} (${this.weather.name})`);
              console.log(`[Realtime] Searching... "${loc}"`);
              try {
                const r = sanitizeResult(await this.weather.weather(req));
                console.log(`[Realtime] Search completed — ${r.sources.length} source(s) from ${this.weather.id}`);
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
            console.log(`[Realtime] Selected Provider: ${this.crypto.id} (${this.crypto.name})`);
            console.log(`[Realtime] Searching... "${symbol}"`);
            try {
              const r = sanitizeResult(await this.crypto.crypto(req));
              console.log(`[Realtime] Search completed — ${r.sources.length} source(s) from ${this.crypto.id}`);
              if (isResultUsable(r)) return r;
            } catch (e) {
              console.warn('[RealtimeService] crypto failed, falling back to search:', e);
            }
            return this.runSearchChain('crypto', { query: `precio ${symbol} hoy`, maxResults: 4, freshness: 'day' });
          }
          case 'stocks': {
            const symbol = extractStockSymbol(intent.query) ?? intent.query;
            const req: StocksRequest = { symbol };
            console.log(`[Realtime] Selected Provider: ${this.stocks.id} (${this.stocks.name})`);
            console.log(`[Realtime] Searching... "${symbol}"`);
            try {
              const r = sanitizeResult(await this.stocks.stocks(req));
              console.log(`[Realtime] Search completed — ${r.sources.length} source(s)`);
              if (isResultUsable(r)) return r;
            } catch (e) {
              console.warn('[RealtimeService] stocks failed, falling back to search:', e);
            }
            return this.runSearchChain('stocks', { query: `${symbol} stock price cotización bolsa`, maxResults: 5, freshness: 'day' });
          }
          case 'sports': {
            const req: SportsRequest = { query: intent.query };
            console.log(`[Realtime] Selected Provider: ${this.sports.id} (${this.sports.name})`);
            console.log(`[Realtime] Searching... "${intent.query}"`);
            try {
              const r = sanitizeResult(await this.sports.sports(req));
              console.log(`[Realtime] Search completed — ${r.sources.length} source(s)`);
              if (isResultUsable(r)) return r;
            } catch (e) {
              console.warn('[RealtimeService] sports failed, falling back to search:', e);
            }
            return this.runSearchChain('sports', { query: `${intent.query} resultado marcador hoy`, maxResults: 6, freshness: 'day' });
          }
          case 'traffic': {
            const { origin, destination } = extractRoute(intent.query);
            const req: TrafficRequest = { origin, destination };
            console.log(`[Realtime] Selected Provider: ${this.traffic.id} (${this.traffic.name})`);
            console.log(`[Realtime] Searching... "${origin} → ${destination}"`);
            try {
              const r = sanitizeResult(await this.traffic.traffic(req));
              console.log(`[Realtime] Search completed — ${r.sources.length} source(s)`);
              if (isResultUsable(r)) return r;
            } catch (e) {
              console.warn('[RealtimeService] traffic failed, falling back to search:', e);
            }
            return this.runSearchChain('traffic', { query: `tráfico ruta ${origin} a ${destination} estado`, maxResults: 5, freshness: 'day' });
          }
          case 'flights': {
            const req: FlightsRequest = { query: intent.query };
            console.log(`[Realtime] Selected Provider: ${this.flights.id} (${this.flights.name})`);
            console.log(`[Realtime] Searching... "${intent.query}"`);
            try {
              const r = sanitizeResult(await this.flights.flights(req));
              console.log(`[Realtime] Search completed — ${r.sources.length} source(s)`);
              if (isResultUsable(r)) return r;
            } catch (e) {
              console.warn('[RealtimeService] flights failed, falling back to search:', e);
            }
            return this.runSearchChain('flights', { query: `${intent.query} vuelo estado salida llegada`, maxResults: 6, freshness: 'day' });
          }
          case 'location': {
            const req: LocationRequest = { query: intent.query };
            console.log(`[Realtime] Selected Provider: ${this.location.id} (${this.location.name})`);
            console.log(`[Realtime] Searching... "${intent.query}"`);
            try {
              const r = sanitizeResult(await this.location.location(req));
              console.log(`[Realtime] Search completed — ${r.sources.length} source(s)`);
              if (isResultUsable(r)) return r;
            } catch (e) {
              console.warn('[RealtimeService] location failed, falling back to search:', e);
            }
            return this.runSearchChain('location', { query: `${intent.query} ubicación dirección mapa horario`, maxResults: 6 });
          }
          case 'scheduler': {
            console.log(`[Realtime] Selected Provider: ${this.scheduler.id} (${this.scheduler.name})`);
            console.log(`[Realtime] Searching... "${intent.query}"`);
            try {
              const r = sanitizeResult(await this.scheduler.search({ query: intent.query, maxResults: 6, freshness: 'month' }));
              console.log(`[Realtime] Search completed — ${r.sources.length} source(s)`);
              if (isResultUsable(r)) return r;
            } catch (e) {
              console.warn('[RealtimeService] scheduler failed, falling back to search:', e);
            }
            return this.runSearchChain('scheduler', { query: intent.query, maxResults: 6, freshness: 'month' });
          }
          default:
            return null;
        }
      });
    } catch (e) {
      console.error('[Realtime] ERROR', e);
      return null;
    }

    if (!result || !isResultUsable(result)) {
      console.log('[Realtime] No realtime data found');
      return null;
    }

    console.log(`[Realtime] Sources found: ${result.sources.length}`);
    const ctx = buildRealtimeContext(intent.query, domain, [result]);
    console.log('[Realtime] Context injected into AI');
    return ctx;
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
