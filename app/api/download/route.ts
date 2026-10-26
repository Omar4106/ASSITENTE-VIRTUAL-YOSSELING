import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, sanitizeInput } from '@/lib/security';
import { BROWSER_UA_DESKTOP, type MediaFormat } from '@/lib/services/media/types';
import { tryRapidApi } from '@/lib/services/media/rapidapi';
import { tryCobaltInstances } from '@/lib/services/media/cobalt';
import { tryBtchDownloader } from '@/lib/services/media/btch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHORTENER_DOMAINS =
  /vt\.tiktok\.com|vm\.tiktok\.com|instagr\.am|fb\.watch|fb\.gg|youtu\.be|facebook\.com\/share|t\.co|pin\.it|redd\.it/i;

const SOCIAL_URL_PATTERN =
  /^https?:\/\/(?:(?:www|m)\.)?(?:vt\.tiktok\.com|vm\.tiktok\.com|tiktok\.com|instagram\.com|instagr\.am|reel\.instagram\.com|facebook\.com|fb\.watch|fb\.gg|fb\.com|youtu\.be|youtube\.com|twitter\.com|x\.com|t\.co|pinterest\.com|pin\.it|reddit\.com|redd\.it)(?:\/[^\s]*)?(?:\?[^\s]*)?(?:#[^\s]*)?$/i;

const TIKWM_API = 'https://www.tikwm.com/api';

const BROWSER_HEADERS: Record<string, string> = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
  'User-Agent': BROWSER_UA_DESKTOP,
};

const MAX_HTML_BYTES = 256 * 1024;

interface TikwmResponse {
  code: number;
  data?: { play?: string; wmplay?: string; music?: string; title?: string };
}

interface DirectCobaltResponse {
  status?: string;
  url?: string;
  picker?: Array<{ url?: string }>;
}

function isSupportedSocialUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      SOCIAL_URL_PATTERN.test(parsed.href)
    );
  } catch {
    return false;
  }
}

function getHtmlAttribute(tag: string, attribute: string): string | null {
  const match = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function decodeHtmlUrl(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&#0*39;|&#x0*27;/gi, "'")
    .replace(/&quot;|&#0*34;|&#x0*22;/gi, '"')
    .trim();
}

function extractCanonicalUrl(html: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (getHtmlAttribute(tag, 'property')?.toLowerCase() === 'og:url') {
      const content = getHtmlAttribute(tag, 'content');
      if (content) return decodeHtmlUrl(content);
    }
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = getHtmlAttribute(tag, 'rel');
    const href = getHtmlAttribute(tag, 'href');
    if (rel?.toLowerCase().split(/\s+/).includes('canonical') && href) {
      return decodeHtmlUrl(href);
    }
  }

  return null;
}

async function readHtmlPrefix(response: Response): Promise<string> {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = '';
  let bytesRead = 0;

  try {
    while (bytesRead < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = MAX_HTML_BYTES - bytesRead;
      const chunk = value.subarray(0, remaining);
      bytesRead += chunk.byteLength;
      result += decoder.decode(chunk, { stream: bytesRead < MAX_HTML_BYTES });
      if (chunk.byteLength < value.byteLength) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }

  return result;
}

function stripTrackingParams(url: string): string {
  try {
    const parsed = new URL(url);
    if (/(^|\.)((x|twitter)\.com)$/i.test(parsed.hostname)) {
      parsed.search = '';
      parsed.hash = '';
      return parsed.origin + parsed.pathname;
    }
    [
      'exIn', 'is_from_webapp', 'fbclid', 'gclid',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'igshid', 'ref', 'ref_src', 'ref_url', 'shared_info', 'si', 'feature',
      's', 't', 'cxt', 'mx', 'cn', 'lang',
    ].forEach((p) => parsed.searchParams.delete(p));
    if (parsed.searchParams.toString() === '')
      return parsed.origin + parsed.pathname + parsed.hash;
    return parsed.origin + parsed.pathname + '?' + parsed.searchParams.toString() + parsed.hash;
  } catch {
    const qIdx = url.indexOf('?');
    return qIdx === -1 ? url : url.slice(0, qIdx);
  }
}

function normalizeTwitterUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)(twitter|x)\.com$/i.test(parsed.hostname)) return url;
    parsed.search = '';
    parsed.hash = '';
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return url;
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
  if (!isSupportedSocialUrl(url) || !SHORTENER_DOMAINS.test(url)) return url;

  let current = url;
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(8000),
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) break;
        const destination = new URL(location, current).href;
        if (!isSupportedSocialUrl(destination)) break;
        current = destination;
        if (!SHORTENER_DOMAINS.test(current)) break;
        continue;
      }

      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.toLowerCase().includes('text/html')) {
        const html = await readHtmlPrefix(res);
        const canonical = extractCanonicalUrl(html);
        if (canonical) {
          const canonicalUrl = new URL(canonical, current).href;
          if (isSupportedSocialUrl(canonicalUrl)) current = canonicalUrl;
        }
      } else {
        await res.body?.cancel().catch(() => undefined);
      }

      if (!SHORTENER_DOMAINS.test(current)) {
        break;
      }
    } catch {
      break;
    }
  }

  return stripTrackingParams(current);
}

async function tryDirectCobalt(url: string, format: MediaFormat) {
  try {
    const res = await fetch('https://co.wuk.sh/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': BROWSER_UA_DESKTOP,
        'Origin': 'https://co.wuk.sh',
        'Referer': 'https://co.wuk.sh/',
      },
      body: JSON.stringify({
        url,
        vQuality: '720',
        isAudioOnly: format === 'mp3',
        filenameStyle: 'nerdy',
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as DirectCobaltResponse;

    if (data.status === 'error' || (!data.url && !data.picker)) {
      return null;
    }

    const directUrl = data.url ?? data.picker?.find((item) => item.url)?.url;
    if (!directUrl || !isHttpsUrl(directUrl)) return null;

    const ext = format === 'mp3' ? 'mp3' : 'mp4';
    return {
      directUrl,
      filename: `yosseling_media_${Date.now()}.${ext}`,
    };
  } catch {
    return null;
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
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
  const rateLimit = checkRateLimit(`download:${clientIp}`, 30);
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
    const cleanedUrl = normalizeYouTubeUrl(normalizeTwitterUrl(stripTrackingParams(url)));
    const resolvedUrl = normalizeTwitterUrl(stripTrackingParams(await resolveShortenedUrl(cleanedUrl)));

    // 1. Fallback directo a Cobalt API (Prioritario y robusto para FB, IG, X)
    const directCobaltResult = await tryDirectCobalt(resolvedUrl, format);
    if (directCobaltResult) {
      const proxyUrl = buildProxyUrl(req, directCobaltResult.directUrl, directCobaltResult.filename, format);
      return NextResponse.json(
        {
          success: true,
          downloadUrl: proxyUrl,
          directUrl: directCobaltResult.directUrl,
          filename: directCobaltResult.filename,
          format,
          provider: 'direct-cobalt',
        },
        { status: 200 },
      );
    }

    // 2. btch-downloader
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

    // 3. Cobalt mirrors
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

    // 4. RapidAPI
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

    // 5. TikWM for TikTok
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