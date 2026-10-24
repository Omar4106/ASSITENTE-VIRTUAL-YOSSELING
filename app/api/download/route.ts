import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, sanitizeInput } from '@/lib/security';
import { BROWSER_UA_DESKTOP, type ExtractResult, type MediaFormat } from '@/lib/services/media/types';
import { tryRapidApi } from '@/lib/services/media/rapidapi';
import { tryCobaltInstances } from '@/lib/services/media/cobalt';

export const runtime = 'nodejs';

const SHORTENER_DOMAINS =
  /vt\.tiktok\.com|vm\.tiktok\.com|instagr\.am|fb\.watch|fb\.gg|youtu\.be|facebook\.com\/share|pin\.it|redd\.it/i;

const SOCIAL_URL_PATTERN =
  /^https?:\/\/(www\.)?(m\.)?(vt\.tiktok\.com|vm\.tiktok\.com|tiktok\.com|instagram\.com\/(reel|p|reels|tv)\/|instagr\.am|reel\.instagram\.com|facebook\.com(\/share\/(v|r|reel)\/|\/share|\/watch|\/reel\/|\/videos\/)?|fb\.watch|fb\.gg|fb\.com|youtu\.be|youtube\.com\/(watch|shorts|embed)|twitter\.com|x\.com|pinterest\.com|pin\.it|reddit\.com|redd\.it)/i;

const TIKWM_API = 'https://www.tikwm.com/api';

const BROWSER_HEADERS: Record<string, string> = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A-Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent': BROWSER_UA_DESKTOP,
};

interface TikwmResponse {
  code: number;
  msg?: string;
  data?: { play?: string; wmplay?: string; music?: string; title?: string };
}

function stripTrackingParams(url: string): string {
  try {
    const parsed = new URL(url);
    const trackingParams = [
      'exIn', 'is_from_webapp', 'fbclid', 'gclid',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'igshid', 'ref', 'ref_url', 'shared_info', 'si', 'feature',
    ];
    trackingParams.forEach((p) => parsed.searchParams.delete(p));
    if (parsed.searchParams.toString() === '')
      return parsed.origin + parsed.pathname + parsed.hash;
    return parsed.origin + parsed.pathname + '?' + parsed.searchParams.toString() + parsed.hash;
  } catch {
    const qIdx = url.indexOf('?');
    return qIdx === -1 ? url : url.slice(0, qIdx);
  }
}

/**
 * Follows redirects to expand shortened URLs (youtu.be, pin.it, fb.watch, etc.)
 * into their full canonical form before sending to extraction services.
 * Uses `redirect: 'follow'` to resolve the entire chain in one request,
 * with a manual fallback for servers that don't follow redirects cleanly.
 */
async function resolveShortenedUrl(url: string): Promise<string> {
  if (!SHORTENER_DOMAINS.test(url)) return url;

  // Attempt 1: let fetch follow all redirects automatically
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    const finalUrl = res.url || res.headers.get('location') || url;
    if (finalUrl && finalUrl !== url) return stripTrackingParams(finalUrl);
  } catch {
    // fall through to manual redirect chasing
  }

  // Attempt 2: manual redirect chasing for servers that don't auto-redirect
  let current = url;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      const location = res.headers.get('location');
      if (location) {
        current = location.startsWith('http') ? location : new URL(location, current).href;
        if (SOCIAL_URL_PATTERN.test(stripTrackingParams(current)))
          return stripTrackingParams(current);
        continue;
      }
      break;
    } catch {
      break;
    }
  }

  return stripTrackingParams(current);
}

async function tryTikwm(url: string, format: MediaFormat): Promise<ExtractResult | null> {
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
    const data = (await res.json()) as TikwmResponse;
    if (data.code !== 0 || !data.data) return null;
    if (format === 'mp3') {
      if (!data.data.music) return null;
      return { directUrl: data.data.music, filename: `yosseling_audio_${Date.now()}.mp3` };
    }
    const videoUrl = data.data.play ?? data.data.wmplay;
    if (!videoUrl) return null;
    return { directUrl: videoUrl, filename: `yosseling_video_${Date.now()}.mp4` };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`download:${clientIp}`, 10);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes de descarga. Espera un momento.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  let url: string;
  let format: MediaFormat;
  try {
    const body = await req.json();
    url = typeof body.url === 'string' ? body.url : '';
    format = body.format === 'mp3' ? 'mp3' : 'mp4';
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  url = sanitizeInput(url).trim();
  if (!url || !SOCIAL_URL_PATTERN.test(url)) {
    return NextResponse.json(
      { error: 'Enlace no válido. Solo se admiten enlaces públicos de TikTok, Instagram, Facebook, YouTube, Twitter/X, Pinterest y Reddit.' },
      { status: 400 },
    );
  }

  try {
    const cleanedUrl = stripTrackingParams(url);
    const resolvedUrl = await resolveShortenedUrl(cleanedUrl);

    // 1. RapidAPI (if key configured — highest priority)
    const rapidResult = await tryRapidApi(resolvedUrl, format);
    if (rapidResult)
      return NextResponse.json(
        { url: rapidResult.directUrl, filename: rapidResult.filename, format },
        { status: 200 },
      );

    // 2. Cobalt instances (with optional API key, then public mirrors)
    const cobaltResult = await tryCobaltInstances(resolvedUrl, format);
    if (cobaltResult)
      return NextResponse.json(
        { url: cobaltResult.directUrl, filename: cobaltResult.filename, format },
        { status: 200 },
      );

    // 3. TikWM for TikTok URLs
    const tikwmResult = await tryTikwm(resolvedUrl, format);
    if (tikwmResult)
      return NextResponse.json(
        { url: tikwmResult.directUrl, filename: tikwmResult.filename, format },
        { status: 200 },
      );

    return NextResponse.json(
      { error: 'No pude procesar este enlace. Asegúrate de que la publicación sea pública e inténtalo de nuevo.' },
      { status: 422 },
    );
  } catch (err) {
    console.error('[Yosseling Download] Unexpected error:', err);
    return NextResponse.json(
      { error: 'No pude procesar este enlace. Asegúrate de que la publicación sea pública e inténtalo de nuevo.' },
      { status: 500 },
    );
  }
}
