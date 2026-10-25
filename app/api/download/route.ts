import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, sanitizeInput } from '@/lib/security';
import { BROWSER_UA_DESKTOP, type MediaFormat } from '@/lib/services/media/types';
import { tryRapidApi } from '@/lib/services/media/rapidapi';
import { tryCobaltInstances } from '@/lib/services/media/cobalt';
import { tryBtchDownloader } from '@/lib/services/media/btch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHORTENER_DOMAINS =
  /vt\.tiktok\.com|vm\.tiktok\.com|instagr\.am|fb\.watch|fb\.gg|youtu\.be|facebook\.com\/share|pin\.it|redd\.it/i;

const SOCIAL_URL_PATTERN =
  /^https?:\/\/(www\.)?(m\.)?(vt\.tiktok\.com|vm\.tiktok\.com|tiktok\.com|instagram\.com\/(reel|p|reels|tv)\/|instagr\.am|reel\.instagram\.com|facebook\.com(\/share\/(v|r|reel)\/|\/share|\/watch|\/reel\/|\/videos\/)?|fb\.watch|fb\.gg|fb\.com|youtu\.be|youtube\.com\/(watch|shorts|embed)|twitter\.com|x\.com|pinterest\.com|pin\.it|reddit\.com|redd\.it)/i;

const TIKWM_API = 'https://www.tikwm.com/api';

const BROWSER_HEADERS: Record<string, string> = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
  'User-Agent': BROWSER_UA_DESKTOP,
};

interface TikwmResponse {
  code: number;
  data?: { play?: string; wmplay?: string; music?: string; title?: string };
}

function stripTrackingParams(url: string): string {
  try {
    const parsed = new URL(url);
    [
      'exIn', 'is_from_webapp', 'fbclid', 'gclid',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'igshid', 'ref', 'ref_url', 'shared_info', 'si', 'feature',
    ].forEach((p) => parsed.searchParams.delete(p));
    if (parsed.searchParams.toString() === '')
      return parsed.origin + parsed.pathname + parsed.hash;
    return parsed.origin + parsed.pathname + '?' + parsed.searchParams.toString() + parsed.hash;
  } catch {
    const qIdx = url.indexOf('?');
    return qIdx === -1 ? url : url.slice(0, qIdx);
  }
}

function normalizeYouTubeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') {
      const videoId = parsed.pathname.slice(1).split('/')[0];
      if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return url;
  } catch {
    return url;
  }
}

async function resolveShortenedUrl(url: string): Promise<string> {
  if (!SHORTENER_DOMAINS.test(url)) return url;

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
    // fall through
  }

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

async function tryTikwm(url: string, format: MediaFormat) {
  if (!/tiktok\.com/i.test(url)) return null;
  try {
    const params = new URLSearchParams({ url, hd: '1' });
    const res = await fetch(`${TIKWM_API}/?${params.toString()}`, {
      method: 'GET',
      headers: { 'User-Agent': BROWSER_UA_DESKTOP },
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

function buildProxyUrl(req: NextRequest, directUrl: string, filename: string, format: MediaFormat): string {
  const origin = req.nextUrl.origin;
  const params = new URLSearchParams({
    u: directUrl,
    f: filename,
    fmt: format,
  });
  return `${origin}/api/media-proxy?${params.toString()}`;
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`download:${clientIp}`, 10);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Demasiadas solicitudes de descarga. Espera un momento.' },
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
    return NextResponse.json({ success: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  url = sanitizeInput(url).trim();
  if (!url || !SOCIAL_URL_PATTERN.test(url)) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Enlace no válido. Solo se admiten enlaces públicos de TikTok, Instagram, Facebook, YouTube, Twitter/X, Pinterest y Reddit.',
      },
      { status: 400 },
    );
  }

  try {
    const cleanedUrl = normalizeYouTubeUrl(stripTrackingParams(url));
    const resolvedUrl = await resolveShortenedUrl(cleanedUrl);

    // 1. btch-downloader — lightweight JSON extractors for YT/IG/TT/X/FB
    const btchResult = await tryBtchDownloader(resolvedUrl, format);
    if (btchResult) {
      const proxyUrl = buildProxyUrl(req, btchResult.directUrl, btchResult.filename, format);
      return NextResponse.json(
        {
          success: true,
          downloadUrl: proxyUrl,
          directUrl: btchResult.directUrl,
          filename: btchResult.filename,
          format,
          provider: 'btch',
        },
        { status: 200 },
      );
    }

    // 2. Cobalt mirrors (optional COBALT_API_KEY)
    const cobaltResult = await tryCobaltInstances(resolvedUrl, format);
    if (cobaltResult) {
      const proxyUrl = buildProxyUrl(req, cobaltResult.directUrl, cobaltResult.filename, format);
      return NextResponse.json(
        {
          success: true,
          downloadUrl: proxyUrl,
          directUrl: cobaltResult.directUrl,
          filename: cobaltResult.filename,
          format,
          provider: 'cobalt',
        },
        { status: 200 },
      );
    }

    // 3. RapidAPI (optional RAPIDAPI_KEY)
    const rapidResult = await tryRapidApi(resolvedUrl, format);
    if (rapidResult) {
      const proxyUrl = buildProxyUrl(req, rapidResult.directUrl, rapidResult.filename, format);
      return NextResponse.json(
        {
          success: true,
          downloadUrl: proxyUrl,
          directUrl: rapidResult.directUrl,
          filename: rapidResult.filename,
          format,
          provider: 'rapidapi',
        },
        { status: 200 },
      );
    }

    // 4. TikWM for TikTok
    const tikwmResult = await tryTikwm(resolvedUrl, format);
    if (tikwmResult) {
      const proxyUrl = buildProxyUrl(req, tikwmResult.directUrl, tikwmResult.filename, format);
      return NextResponse.json(
        {
          success: true,
          downloadUrl: proxyUrl,
          directUrl: tikwmResult.directUrl,
          filename: tikwmResult.filename,
          format,
          provider: 'tikwm',
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          'No pude extraer un enlace de descarga nativo. Asegúrate de que la publicación sea pública e inténtalo de nuevo.',
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[Yosseling Download] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'No pude procesar este enlace en este momento. Intenta con otro enlace.' },
      { status: 200 },
    );
  }
}
