/**
 * Realtime Service — Configuration.
 * Provider priorities, fallback chains, TTLs, and limits.
 */
import type { RealtimeDomain, SearchProviderId } from './types';

export const REALTIME_CONFIG = {
  maxResultsPerProvider: 8,
  maxSourcesInPrompt: 5,
  requestTimeoutMs: 8000,
  fallbackDepth: 5,
  enableCache: true,
} as const;

export const SEARCH_FALLBACK_CHAIN: SearchProviderId[] = [
  'tavily', 'brave', 'serper', 'bing', 'google', 'duckduckgo',
];

export const DOMAIN_FALLBACK: Record<RealtimeDomain, SearchProviderId[]> = {
  search:     SEARCH_FALLBACK_CHAIN,
  news:       ['tavily', 'serper', 'brave', 'google', 'duckduckgo'],
  weather:    ['tavily', 'brave', 'serper', 'duckduckgo'],
  crypto:     SEARCH_FALLBACK_CHAIN,
  stocks:     SEARCH_FALLBACK_CHAIN,
  sports:     SEARCH_FALLBACK_CHAIN,
  traffic:    ['tavily', 'brave', 'serper', 'duckduckgo'],
  flights:    SEARCH_FALLBACK_CHAIN,
  location:   ['tavily', 'brave', 'serper', 'google', 'duckduckgo'],
  scheduler:   SEARCH_FALLBACK_CHAIN,
};

export const CACHE_TTL_MS: Record<RealtimeDomain, number> = {
  search:     5 * 60 * 1000,
  news:       2 * 60 * 1000,
  weather:    5 * 60 * 1000,
  crypto:     30 * 1000,
  stocks:     60 * 1000,
  sports:     2 * 60 * 1000,
  traffic:    5 * 60 * 1000,
  flights:    10 * 60 * 1000,
  location:   24 * 60 * 60 * 1000,
  scheduler:  30 * 60 * 1000,
};

export const PROVIDER_ENV_KEYS: Record<string, string> = {
  tavily:    'TAVILY_API_KEY',
  serper:    'SERPER_API_KEY',
  brave:     'BRAVE_API_KEY',
  bing:      'BING_SEARCH_API_KEY',
  google:    'GOOGLE_SEARCH_API_KEY',
  duckduckgo: '',
  news:      'NEWS_API_KEY',
  weather:   'WEATHER_API_KEY',
  crypto:    '',
  stocks:    '',
  sports:    '',
  traffic:   '',
  flights:   '',
  location:  '',
  scheduler: '',
};

export const REALTIME_PROMPT_PREAMBLE = `Dispones de resultados obtenidos desde fuentes externas y recientes.
Utiliza esta información como prioridad para responder.
Si las fuentes presentan diferencias, indícalo claramente.
No inventes información.
Si algún dato no está presente en las fuentes, dilo explícitamente.
Resume la respuesta de forma clara, profesional y fácil de entender.`;
