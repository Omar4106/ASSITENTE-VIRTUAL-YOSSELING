/**
 * Realtime Service — public entry point.
 *
 * Usage:
 *   import { realtimeService } from '@/src/services/realtime';
 *   const ctx = await realtimeService.fetch(userMessage);
 *   if (ctx) systemPrompt += '\n\n' + ctx.prompt;
 */
export { realtimeService } from './RealtimeService';
export type { RealtimeService } from './RealtimeService';

export type {
  RealtimeDomain, RealtimeSource, RealtimeResult, RealtimeContext,
  IntentDetectionResult, SearchRequest, NewsRequest, WeatherRequest,
  CryptoRequest, StocksRequest, SportsRequest, TrafficRequest,
  FlightsRequest, LocationRequest,
} from './types';

export {
  REALTIME_CONFIG, SEARCH_FALLBACK_CHAIN, DOMAIN_FALLBACK,
  CACHE_TTL_MS, PROVIDER_ENV_KEYS, REALTIME_PROMPT_PREAMBLE,
} from './config';

export { detectIntent } from './detector/IntentDetector';
export { formatSourcesForPrompt } from './detector/SourceFormatter';
export { buildRealtimeContext, buildRealtimePrompt } from './detector/PromptBuilder';

export { isCacheValid, shouldBypassCache } from './validators/CacheValidator';
export { validateSearchRequest } from './validators/SearchValidator';
export { isResultUsable, sanitizeResult } from './validators/ResponseValidator';

export { getCached, setCached, clearCache, cacheKey } from './cache';
