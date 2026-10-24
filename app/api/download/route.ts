import { NextRequest, NextResponse } from 'next/server';
import { getEnvVar } from '@/lib/env';
import { checkRateLimit, getClientIp, sanitizeInput } from '@/lib/security';

export const runtime = 'nodejs';

// ── Extraction endpoints ───────────────────────────────────────────────────
const COBALT_INSTANCES = [
  'https://api.cobalt.tools/api/json',
  'https://co.wuk.sh/api/json',
  'https://cobalt-api.kwippy.com/api/json',
];

const RAPIDAPI_ENDPOINT = 'https://ytstream-download-and-search.p.rapidapi.com/api/ytdl/v1/download';
const COBALT_API_KEY_ENV = 'COBALT_API_KEY';
const RAPIDAPI_KEY_ENV = 'RAPIDAPI_KEY';

const TIKWM_API = 'https://www.tikwm.com/api';

const BROWSER_UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const BROWSER_UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

function apiHeaders(): Record<string, string> {
  const ua = Math.random() > 0.5 ? BROWSER_UA_DESKTOP : BROWSER_UA_MOBILE;
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': ua,
    'Origin': 'https://yosseling.ai',
    'Referer': 'https://yosseling.ai/',
  };
}

const BROWSER_HEADERS: Record<string, string> = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent': BROWSER_UA_DESKTOP,
};

const SHORTENER_DOMAINS = /vt\.tiktok\.com|vm\.tiktok\.com|instagr\.am|fb\.watch|fb\.gg|youtu\.be|facebook\.com\/share/i;

const SOCIAL_URL_PATTERN = /^https?:\/\/(www\.)?(m\.)?(vt\.tiktok\.com|vm\.tiktok\.com|tiktok\.com|instagram\.com\/(reel|p|reels|tv)\/|instagr\.am|reel\.instagram\.com|facebook\.com(\/share\/(v|r|reel)\/|\/share|\/watch|\/reel\/|\/videos\/)?|fb\.watch|fb\.gg|fb\.com|youtu\.be|youtube\.com\/(watch|shorts|embed))/i;

interface ExtractResult { directUrl: string; filename: string; }

interface CobaltResponse {
  status: string;
  error?: { code: string };
  url?: string;
  audio?: string;
  filename?: string;
  audioFilename?: string;
}

interface TikwmResponse {
  code: number;
  msg?: string;
  data?: { play?: string; wmplay?: string; music?: string; title?: string; };
}

function stripTrackingParams(url: string): string {
  try {
    const parsed = new URL(url);
    const trackingParams = ['exIn', 'is_from_webapp', 'fbclid', 'gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'igshid', 'ref', 'ref_url', 'shared_info', 'si', 'feature'];
    trackingParams.forEach(p => parsed.searchParams.delete(p));
    if (parsed.searchParams.toString() === '') return parsed.origin + parsed.pathname + parsed.hash;
    return parsed.origin + parsed.pathname + '?' + parsed.searchParams.toString() + parsed.hash;
  } catch {
    const qIdx = url.indexOf('?');
    return qIdx === -1 ? url : url.slice(0, qIdx);
  }
}

async function resolveShortenedUrl(url: string): Promise<string> {
  if (!SHORTENER_DOMAINS.test(url)) return url;
  let current = url;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(current, { method: 'GET', redirect: 'manual', headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) });
      const location = res.headers.get('location');
      if (location) {
        current = location.startsWith('http') ? location : new URL(location, current).href;
        if (SOCIAL_URL_PATTERN.test(stripTrackingParams(current))) return stripTrackingParams(current);
        continue;
      }
      break;
    } catch { break; }
  }
  return stripTrackingParams(current);
}

function buildCobaltBody(url: string, format: 'mp4' | 'mp3'): Record<string, unknown> {
  const body: Record<string, unknown> = { url, videoQuality: '720', downloadMode: 'auto' };
  if (format === 'mp3') { body.audioFormat = 'mp3'; body.isAudioOnly = true; }
  return body;
}

function parseCobaltData(data: CobaltResponse, format: 'mp4' | 'mp3'): ExtractResult | null {
  if (data.status === 'error') return null;
  const directUrl = format === 'mp3' ? (data.audio ?? data.url) : data.url;
  if (!directUrl) return null;
  const filename = format === 'mp3'
    ? (data.audioFilename ?? `yosseling_audio_${Date.now()}.mp3`)
    : (data.filename ?? `yosseling_video_${Date.now()}.mp4`);
  return { directUrl, filename };
}

async function tryCobaltInstances(url: string, format: 'mp4' | 'mp3'): Promise<ExtractResult | null> {
  const cobaltKey = getEnvVar(COBALT_API_KEY_ENV);
  const body = buildCobaltBody(url, format);

  for (const endpoint of COBALT_INSTANCES) {
    try {
      const headers = apiHeaders();
      if (cobaltKey) headers['Authorization'] = `ApiKey ${cobaltKey}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) { console.error(`[Download] Cobalt ${endpoint} returned ${res.status}`); continue; }
      const data = await res.json() as CobaltResponse;
      const result = parseCobaltData(data, format);
      if (result) { console.log(`[Download] Cobalt ${endpoint} succeeded`); return result; }
      console.error(`[Download] Cobalt ${endpoint} returned status=${data.status}`);
    } catch (err) {
      console.error(`[Download] Cobalt ${endpoint} failed:`, err instanceof Error ? err.message : String(err));
    }
  }
  return null;
}

async function tryRapidApi(url: string, format: 'mp4' | 'mp3'): Promise<ExtractResult | null> {
  const rapidKey = getEnvVar(RAPIDAPI_KEY_ENV);
  if (!rapidKey) return null;
  try {
    const res = await fetch(`${RAPIDAPI_ENDPOINT}?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: { ...apiHeaders(), 'X-RapidAPI-Key': rapidKey, 'X-RapidAPI-Host': 'ytstream-download-and-search.p.rapidapi.com' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) { console.error(`[Download] RapidAPI returned ${res.status}`); return null; }
    const data = await res.json() as { url?: string; title?: string };
    if (!data.url) return null;
    const filename = format === 'mp3' ? `yosseling_audio_${Date.now()}.mp3` : `yosseling_video_${Date.now()}.mp4`;
    console.log('[Download] RapidAPI succeeded');
    return { directUrl: data.url, filename };
  } catch (err) {
    console.error('[Download] RapidAPI failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function tryTikwm(url: string, format: 'mp4' | 'mp3'): Promise<ExtractResult | null> {
  if (!/tiktok\.com/i.test(url)) return null;
  try {
    const params = new URLSearchParams({ url });
    const res = await fetch(`${TIKWM_API}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': BROWSER_UA_DESKTOP },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json() as TikwmResponse;
    if (data.code !== 0 || !data.data) return null;
    if (format === 'mp3') {
      if (!data.data.music) return null;
      return { directUrl: data.data.music, filename: `yosseling_audio_${Date.now()}.mp3` };
    }
    const videoUrl = data.data.play ?? data.data.wmplay;
    if (!videoUrl) return null;
    return { directUrl: videoUrl, filename: `yosseling_video_${Date.now()}.mp4` };
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`download:${clientIp}`, 10);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes de descarga. Espera un momento.' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } });
  }

  let url: string;
  let format: 'mp4' | 'mp3';
  try {
    const body = await req.json();
    url = typeof body.url === 'string' ? body.url : '';
    format = body.format === 'mp3' ? 'mp3' : 'mp4';
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  url = sanitizeInput(url).trim();
  if (!url || !SOCIAL_URL_PATTERN.test(url)) {
    return NextResponse.json({ error: 'Enlace no válido. Solo se admiten enlaces públicos de TikTok, Instagram, Facebook y YouTube.' }, { status: 400 });
  }

  try {
    const cleanedUrl = stripTrackingParams(url);
    const resolvedUrl = await resolveShortenedUrl(cleanedUrl);

    // 1. RapidAPI (if key configured — highest priority)
    const rapidResult = await tryRapidApi(resolvedUrl, format);
    if (rapidResult) return NextResponse.json({ url: rapidResult.directUrl, filename: rapidResult.filename, format }, { status: 200 });

    // 2. Cobalt instances (with optional API key, then public mirrors)
    const cobaltResult = await tryCobaltInstances(resolvedUrl, format);
    if (cobaltResult) return NextResponse.json({ url: cobaltResult.directUrl, filename: cobaltResult.filename, format }, { status: 200 });

    // 3. TikWM for TikTok URLs
    const tikwmResult = await tryTikwm(resolvedUrl, format);
    if (tikwmResult) return NextResponse.json({ url: tikwmResult.directUrl, filename: tikwmResult.filename, format }, { status: 200 });

    return NextResponse.json({ error: 'No pude procesar este enlace. Asegúrate de que la publicación sea pública e inténtalo de nuevo.' }, { status: 422 });
  } catch (err) {
    console.error('[Yosseling Download] Unexpected error:', err);
    return NextResponse.json({ error: 'No pude procesar este enlace. Asegúrate de que la publicación sea pública e inténtalo de nuevo.' }, { status: 500 });
  }
}
