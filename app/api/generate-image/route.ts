import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, getImageRateLimit, imagePromptSchema } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ── Provider URLs ────────────────────────────────────────────────
const PUTER_API_URL = 'https://api.puter.com/drivers/call';
const PUTER_IMAGE_MODEL = 'gemini-nano-banana-2.1';

// ── Utility ──────────────────────────────────────────────────────
function bytesToDataUrl(bytes: ArrayBuffer, mime = 'image/jpeg'): string {
  const buffer = Buffer.from(bytes);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

// ── Puter API REST (Primary) ─────────────────────────────────────
async function generateWithPuter(prompt: string): Promise<{ imageUrl: string | null; error?: string }> {
  const authToken = process.env.PUTER_AUTH_TOKEN;
  if (!authToken) {
    return { imageUrl: null, error: 'PUTER_AUTH_TOKEN no está configurado.' };
  }

  try {
    const res = await fetch(PUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        interface: 'puter-image-generation',
        driver: 'ai-image',
        method: 'generate',
        args: {
          prompt,
          provider: 'gemini',
          model: PUTER_IMAGE_MODEL,
        },
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[generate-image] Puter status', res.status, errText);
      return { imageUrl: null, error: errText || `Puter respondió con estado ${res.status}.` };
    }

    const contentType = res.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
      const bytes = await res.arrayBuffer();
      if (!bytes.byteLength) {
        return { imageUrl: null, error: 'Puter respondió sin contenido de imagen.' };
      }
      const imageUrl = bytesToDataUrl(
        bytes,
        contentType.startsWith('image/') ? contentType : 'image/png',
      );
      console.info('[generate-image] Puter success', {
        status: res.status,
        driver: 'ai-image',
        model: PUTER_IMAGE_MODEL,
      });
      return { imageUrl };
    }

    const data = (await res.json()) as {
      success?: boolean;
      error?: string | { message?: string };
      result?: string | { data_url?: string; url?: string; src?: string };
    };
    if (data.success === false) {
      const error = typeof data.error === 'string' ? data.error : data.error?.message;
      console.error('[generate-image] Puter rejected the request', error ?? 'Unknown Puter error');
      return { imageUrl: null, error: error ?? 'Puter rechazó la solicitud.' };
    }
    const imageUrl = typeof data.result === 'string'
      ? data.result
      : data.result?.data_url || data.result?.url || data.result?.src;
    if (!imageUrl) {
      console.error('[generate-image] Puter returned no image', {
        status: res.status,
        contentType,
      });
      return { imageUrl: null, error: 'Puter respondió correctamente, pero no devolvió una URL de imagen.' };
    }

    if (imageUrl.startsWith('http')) {
      try {
        const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
        if (imgRes.ok) {
          const bytes = await imgRes.arrayBuffer();
          const mime = imgRes.headers.get('content-type') || 'image/jpeg';
          console.info('[generate-image] Puter success', {
            status: res.status,
            driver: 'ai-image',
            model: PUTER_IMAGE_MODEL,
          });
          return { imageUrl: bytesToDataUrl(bytes, mime) };
        }
      } catch {
        // Return the URL provided by Puter if the image cannot be downloaded here.
      }
    }

    console.info('[generate-image] Puter success', {
      status: res.status,
      driver: 'ai-image',
      model: PUTER_IMAGE_MODEL,
    });
    return { imageUrl };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[generate-image] Puter failed', error);
    return { imageUrl: null, error };
  }
}

// ── Main Handler ─────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = getImageRateLimit(`image:${clientIp}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Has generado demasiadas imágenes. Espera un minuto e inténtalo de nuevo.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
    );
  }

  let userPrompt = '';
  try {
    const body = await request.json() as { prompt?: unknown };
    const parsed = imagePromptSchema.safeParse(body.prompt);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Describe la imagen que quieres crear (3 a 4000 caracteres).' }, { status: 400 });
    }
    userPrompt = parsed.data;
  } catch {
    return NextResponse.json({ success: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  console.info('[generate-image] Puter request', {
    driver: 'ai-image',
    model: PUTER_IMAGE_MODEL,
    promptCharacters: userPrompt.length,
  });
  const puterResult = await generateWithPuter(userPrompt);
  const imageUrl = puterResult.imageUrl;

  if (!imageUrl) {
    return NextResponse.json(
      {
        success: false,
        error: puterResult.error ?? 'Puter no pudo generar la imagen.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    success: true,
    imageUrl,
    width: 1024,
    height: 1024,
    provider: 'puter-api-rest',
  });
}