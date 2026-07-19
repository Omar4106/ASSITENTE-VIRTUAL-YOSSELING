/**
 * Weather provider — OpenWeather-style API via WEATHER_API_KEY.
 * Falls back to search providers when not configured.
 */
import { getEnvVar } from '@/lib/env';
import type { IWeatherProvider } from '../interfaces';
import type { RealtimeResult, WeatherRequest } from '../types';
import { confidenceFromCount, dedupeSources, limitSources, nowIso, truncate, withTimeout } from '../utils';

interface OWMResponse {
  name?: string;
  weather?: Array<{ main?: string; description?: string }>;
  main?: { temp?: number; humidity?: number; feels_like?: number };
  wind?: { speed?: number };
  dt?: number;
  cod?: number | string;
  message?: string;
}

export const weatherProvider: IWeatherProvider = {
  id: 'weather',
  name: 'OpenWeather',
  domain: 'weather',

  isConfigured() {
    return Boolean(getEnvVar('WEATHER_API_KEY'));
  },

  async weather(req: WeatherRequest): Promise<RealtimeResult> {
    const apiKey = getEnvVar('WEATHER_API_KEY');
    if (!apiKey) throw new Error('WEATHER_API_KEY not configured');

    const params = new URLSearchParams({
      q: req.location,
      appid: apiKey,
      units: req.units ?? 'metric',
      lang: 'es',
    });

    const res = await withTimeout(fetch(
      `https://api.openweathermap.org/data/2.5/weather?${params}`,
    ), 8000);

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`weather: ${res.status} ${truncate(err, 200)}`);
    }

    const data = (await res.json()) as OWMResponse;
    const desc = data.weather?.[0]?.description ?? '';
    const temp = data.main?.temp;
    const feels = data.main?.feels_like;
    const humidity = data.main?.humidity;
    const wind = data.wind?.speed;

    const summary = [
      data.name ?? req.location,
      desc,
      temp !== undefined ? `${temp}°C` : null,
      feels !== undefined ? `(sensación ${feels}°C)` : null,
      humidity !== undefined ? `humedad ${humidity}%` : null,
      wind !== undefined ? `viento ${wind} m/s` : null,
    ].filter(Boolean).join(' · ');

    const sources = limitSources(dedupeSources([{
      title: `OpenWeather — ${data.name ?? req.location}`,
      url: `https://openweathermap.org/find?q=${encodeURIComponent(req.location)}`,
      snippet: summary,
      publishedAt: data.dt ? new Date(data.dt * 1000).toISOString() : undefined,
    }]), 1);

    return {
      query: req.location,
      domain: 'weather',
      fetchedAt: nowIso(),
      confidence: temp !== undefined ? 'high' : 'low',
      sources,
      summary,
      raw: data,
    };
  },
};
