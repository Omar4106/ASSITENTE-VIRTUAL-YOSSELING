import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, sanitizeInput } from '@/lib/security';

export const runtime = 'nodejs';

const COBALT_API = 'https://api.cobalt.tools';
const TIKWM_API = 'https://www.tikwm.com/api';

const SHORTENER_DOMAINS = /vt\.tiktok\.com|vm\.tiktok\.com|instagr\.am|fb\.watch|fb\.gg|youtu\.be|facebook\.com\/share/i;
const SOCIAL_URL_PATTERN = /^https?:\/\/(www\.)?(m\.)?(vt\.tiktok\.com|vm\.tiktok\.com|tiktok\.com|instagram\.com\/(reel|p|reels|tv)\/|instagr\.am|reel\.instagram\.com|facebook\.com(\/share\/(v|r|reel)\/|\/share|\/watch|\/reel\/|\/videos\/)?|fb\.watch|fb\.gg|fb\.com|youtu\.be|youtube\.com\/(watch|shorts|embed))/i;

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
  data?: {
    play?: string;
    wmplay?: string;
    music?: string;
    title?: string;
  };
}

function stripTrackingParams(url: string): string {
  try {
    const parsed = new URL(url);
    const trackingParams = ['exIn', 'is_from_webapp', 'fbclid', 'gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'igshid', 'ref', 'ref_url', 'shared_info', 'si', 'feature'];
    trackingParams.forEach(p => parsed.searchParams.delete(p));
    if (parsed.searchParams.toString() === '') {
      return parsed.origin + parsed.pathname + parsed.hash;
    }
    return parsed.origin + parsed.pathname + '?' + parsed.searchParams.toString() + parsed.hash;
  } catch {
    const qIdx = url.indexOf('?');
    if (qIdx === -1) return url;
    return url.slice(0, qIdx);
  }
}

async function resolveShortenedUrl(url: string): Promise<string> {
  if (!SHORTENER_DOMAINS.test(url)) return url;
  let current = url;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      const location = res.headers.get('location');
      if (location) {
        current = location.startsWith('http') ? location : new URL(location, current).href;
        if (SOCIAL_URL_PATTERN.test(stripTrackingParams(current))) {
          return stripTrackingParams(current);
        }
        continue;
      }
      break;
    } catch {
      break;
    }
  }
  return stripTrackingParams(current);
}

async function tryCobalt(url: string, format: 'mp4' | 'mp3'): Promise<{ directUrl: string; filename: string } | null> {
  try {
    const cobaltBody: Record<string, unknown> = { url };
    if (format === 'mp3') {
      cobaltBody.audioFormat = 'mp3';
      cobaltBody.isAudioOnly = true;
    }

    const res = await fetch(`${COBALT_API}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(cobaltBody),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;

    const data = await res.json() as CobaltResponse;
    if (data.status === 'error' || (!data.url && !data.audio)) return null;

    const directUrl = format === 'mp3' ? (data.audio ?? data.url) : data.url;
    if (!directUrl) return null;

    const filename = format === 'mp3'
      ? (data.audioFilename ?? `yosseling_audio_${Date.now()}.mp3`)
      : (data.filename ?? `yosseling_video_${Date.now()}.mp4`);

    return { directUrl, filename };
  } catch {
    return null;
  }
}

async function tryTikwm(url: string, format: 'mp4' | 'mp3'): Promise<{ directUrl: string; filename: string } | null> {
  if (!/tiktok\.com/i.test(url)) return null;
  try {
    const params = new URLSearchParams({ url });
    const res = await fetch(`${TIKWM_API}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;

    const data = await res.json() as TikwmResponse;
    if (data.code !== 0 || !data.data) return null;

    if (format === 'mp3') {
      const musicUrl = data.data.music;
      if (!musicUrl) return null;
      return { directUrl: musicUrl, filename: `yosseling_audio_${Date.now()}.mp3` };
    }

    const videoUrl = data.data.play ?? data.data.wmplay;
    if (!videoUrl) return null;
    return { directUrl: videoUrl, filename: `yosseling_video_${Date.now()}.mp4` };
  } catch {
    return null;
  }
}

interface CobaltYtdlResponse {
  status: string;
  url?: string;
  audio?: string;
  filename?: string;
  audioFilename?: string;
}

async function tryCobaltYoutube(url: string, format: 'mp4' | 'mp3'): Promise<{ directUrl: string; filename: string } | null> {
  if (!/youtu\.be|youtube\.com/i.test(url)) return null;
  try {
    const cobaltBody: Record<string, unknown> = { url, youtubeVideoCodec: 'h264' };
    if (format === 'mp3') {
      cobaltBody.audioFormat = 'mp3';
      cobaltBody.isAudioOnly = true;
    }

    const res = await fetch(`${COBALT_API}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(cobaltBody),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return null;

    const data = await res.json() as CobaltYtdlResponse;
    if (data.status === 'error' || (!data.url && !data.audio)) return null;

    const directUrl = format === 'mp3' ? (data.audio ?? data.url) : data.url;
    if (!directUrl) return null;

    const filename = format === 'mp3'
      ? (data.audioFilename ?? `yosseling_audio_${Date.now()}.mp3`)
      : (data.filename ?? `yosseling_video_${Date.now()}.mp4`);

    return { directUrl, filename };
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
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
    );
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

    if (/youtu\.be|youtube\.com/i.test(resolvedUrl)) {
      const ytResult = await tryCobaltYoutube(resolvedUrl, format);
      if (ytResult) {
        return NextResponse.json({ url: ytResult.directUrl, filename: ytResult.filename, format }, { status: 200 });
      }
    }

    const cobaltResult = await tryCobalt(resolvedUrl, format);
    if (cobaltResult) {
      return NextResponse.json({ url: cobaltResult.directUrl, filename: cobaltResult.filename, format }, { status: 200 });
    }

    const tikwmResult = await tryTikwm(resolvedUrl, format);
    if (tikwmResult) {
      return NextResponse.json({ url: tikwmResult.directUrl, filename: tikwmResult.filename, format }, { status: 200 });
    }

    return NextResponse.json({ error: 'No pude procesar este enlace. Asegúrate de que la publicación sea pública e inténtalo de nuevo.' }, { status: 422 });
  } catch (err) {
    console.error('[Yosseling Download] Unexpected error:', err);
    return NextResponse.json({ error: 'No pude procesar este enlace. Asegúrate de que la publicación sea pública e inténtalo de nuevo.' }, { status: 500 });
  }
}
