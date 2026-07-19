/**
 * Realtime Service — Type definitions.
 * Single source of truth for all realtime-related types.
 */

export type RealtimeDomain =
  | 'search'
  | 'news'
  | 'weather'
  | 'crypto'
  | 'stocks'
  | 'sports'
  | 'traffic'
  | 'flights'
  | 'location'
  | 'scheduler';

export type SearchProviderId =
  | 'tavily'
  | 'serper'
  | 'brave'
  | 'bing'
  | 'google'
  | 'duckduckgo';

export type ProviderId = SearchProviderId | RealtimeDomain;

export interface RealtimeSource {
  title: string;
  url: string;
  snippet?: string;
  content?: string;
  publishedAt?: string;
  favicon?: string;
}

export interface RealtimeResult {
  query: string;
  domain: RealtimeDomain;
  fetchedAt: string;
  confidence: 'high' | 'medium' | 'low';
  sources: RealtimeSource[];
  summary?: string;
  raw?: unknown;
}

export interface RealtimeContext {
  originalQuery: string;
  detectedDomain: RealtimeDomain;
  detectedAt: string;
  results: RealtimeResult[];
  prompt: string;
}

export interface CacheEntry<T = RealtimeResult> {
  key: string;
  value: T;
  expiresAt: number;
  createdAt: number;
}

export interface RealtimeProviderConfig {
  id: ProviderId;
  name: string;
  envKey: string;
  apiBaseUrl?: string;
  priority: number;
  ttlMs: number;
}

export interface IntentDetectionResult {
  needsRealtime: boolean;
  domain: RealtimeDomain | null;
  query: string;
  matchedKeywords: string[];
  confidence: number;
}

export interface SearchRequest {
  query: string;
  maxResults?: number;
  freshness?: 'day' | 'week' | 'month' | 'year';
}

export interface NewsRequest extends SearchRequest {
  country?: string;
  category?: string;
}

export interface WeatherRequest {
  location: string;
  units?: 'metric' | 'imperial';
}

export interface CryptoRequest {
  symbol: string;
  currency?: string;
}

export interface StocksRequest {
  symbol: string;
}

export interface SportsRequest extends SearchRequest {
  league?: string;
}

export interface TrafficRequest {
  origin: string;
  destination: string;
}

export interface FlightsRequest extends SearchRequest {
  from?: string;
  to?: string;
  date?: string;
}

export interface LocationRequest {
  query: string;
}
