import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/security';
import { BROWSER_UA_DESKTOP } from '@/lib/services/media/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeFilename(name: string, fallbackExt: string): string {
  const cleaned = name.replace(/[^\w.\-àáäâèéëêìíïîòóöôùúüûñç]/gi, '_').slice(0, 120);
  if (cleaned.includes('.')) return cleaned;
  return `${cleaned || 'yosseling_media'}.${fallbackExt}`;
}

function isBlockedHost(hostname: string): boolean {
  return /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1|metadata\.google)/i.test(hostname);
}

/**
 * Same-origin proxy that streams remote media with Content-Disposition: attachment
 * so the browser forces a native download (no player iframe, no CORS blocks).
 */
export async function GET(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`media-proxy:${clientIp}`, 20);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Demasiadas descargas. Espera un momento.' },
      { status: 429 },
    );
  }

  const target = req.nextUrl.searchParams.get('u') ?? '';
  const filenameParam = req.nextUrl.searchParams.get('f') ?? 'yosseling_media.mp4';
  const format = (req.nextUrl.searchParams.get('fmt') ?? 'mp4').toLowerCase();

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ success: false, error: 'URL inválida.' }, { status: 400 });
  }

  if (parsed.protocol !== 'https:' || isBlockedHost(parsed.hostname)) {
    return NextResponse.json({ success: false, error: 'Origen no permitido.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.href, {
      headers: {
        'User-Agent': BROWSER_UA_DESKTOP,
        Accept: '*/*',
        Referer: parsed.origin + '/',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(120000),
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { success: false, error: 'No se pudo obtener el archivo de medios.' },
        { status: 502 },
      );
    }

    const ext = format === 'mp3' ? 'mp3' : 'mp4';
    const filename = safeFilename(filenameParam, ext);
    const contentType =
      upstream.headers.get('content-type') ??
      (ext === 'mp3' ? 'audio/mpeg' : 'video/mp4');

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Cache-Control', 'no-store');
    const len = upstream.headers.get('content-length');
    if (len) headers.set('Content-Length', len);

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (err) {
    console.error('[MediaProxy]', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { success: false, error: 'Error al descargar el archivo.' },
      { status: 502 },
    );
  }
}
