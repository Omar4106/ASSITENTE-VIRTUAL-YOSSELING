/**
 * Realtime Service — Provider interfaces.
 * Every provider implements these contracts so swapping is safe.
 */
import type {
  CryptoRequest, FlightsRequest, LocationRequest, NewsRequest,
  RealtimeDomain, RealtimeResult, SearchRequest, SportsRequest,
  StocksRequest, TrafficRequest, WeatherRequest,
} from './types';

export interface ISearchProvider {
  id: string;
  name: string;
  domain: RealtimeDomain;
  isConfigured(): boolean;
  search(req: SearchRequest): Promise<RealtimeResult>;
}

export interface INewsProvider {
  id: string;
  name: string;
  domain: RealtimeDomain;
  isConfigured(): boolean;
  news(req: NewsRequest): Promise<RealtimeResult>;
}

export interface IWeatherProvider {
  id: string;
  name: string;
  domain: RealtimeDomain;
  isConfigured(): boolean;
  weather(req: WeatherRequest): Promise<RealtimeResult>;
}

export interface ICryptoProvider {
  id: string;
  name: string;
  domain: RealtimeDomain;
  isConfigured(): boolean;
  crypto(req: CryptoRequest): Promise<RealtimeResult>;
}

export interface IStocksProvider {
  id: string;
  name: string;
  domain: RealtimeDomain;
  isConfigured(): boolean;
  stocks(req: StocksRequest): Promise<RealtimeResult>;
}

export interface ISportsProvider {
  id: string;
  name: string;
  domain: RealtimeDomain;
  isConfigured(): boolean;
  sports(req: SportsRequest): Promise<RealtimeResult>;
}

export interface ITrafficProvider {
  id: string;
  name: string;
  domain: RealtimeDomain;
  isConfigured(): boolean;
  traffic(req: TrafficRequest): Promise<RealtimeResult>;
}

export interface IFlightsProvider {
  id: string;
  name: string;
  domain: RealtimeDomain;
  isConfigured(): boolean;
  flights(req: FlightsRequest): Promise<RealtimeResult>;
}

export interface ILocationProvider {
  id: string;
  name: string;
  domain: RealtimeDomain;
  isConfigured(): boolean;
  location(req: LocationRequest): Promise<RealtimeResult>;
}

export type AnyRealtimeProvider =
  | ISearchProvider | INewsProvider | IWeatherProvider | ICryptoProvider
  | IStocksProvider | ISportsProvider | ITrafficProvider | IFlightsProvider
  | ILocationProvider;
