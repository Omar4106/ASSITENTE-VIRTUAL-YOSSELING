import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, getImageRateLimit, sanitizeInput } from '@/lib/security';
import { createServerFalClient, parseImageDataUrl, validateFalMediaUrl } from '@/lib/fal-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const rateLimit = getImageRateLimit(`edit-image:${getClientIp(request)}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Has solicitado demasiadas transformaciones. Espera un minuto e inténtalo de nuevo.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'La solicitud debe contener JSON válido.' }, { status: 400 });
  }

  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const prompt = typeof record.prompt === 'string' ? sanitizeInput(record.prompt.trim()) : '';
  const imageDataUrl = parseImageDataUrl(record.imageDataUrl);
  if (prompt.length < 3 || prompt.length > 4000) {
    return NextResponse.json({ success: false, error: 'Describe cómo quieres transformar la imagen.' }, { status: 400 });
  }
  if (!imageDataUrl) {
    return NextResponse.json({ success: false, error: 'Adjunta una imagen PNG, JPEG o WebP de hasta 8 MB.' }, { status: 400 });
  }

  const fal = createServerFalClient();
  if (!fal) {
    return NextResponse.json({ success: false, error: 'La edición de imágenes requiere configurar FAL_KEY o AI_HORDE_API_KEY en el servidor.' }, { status: 503 });
  }

  try {
    const result = await fal.subscribe('fal-ai/flux-kontext', {
      input: {
        image_url: imageDataUrl,
        prompt: `${prompt}. Apply the requested transformation while preserving the original subject, pose, composition, and key visual structure. Produce a crisp, high-quality result.`,
        num_images: 1,
        output_format: 'png',
      },
      abortSignal: AbortSignal.timeout(165_000),
    });
    const data = result.data as { images?: Array<{ url?: string }> };
    const imageUrl = validateFalMediaUrl(data.images?.[0]?.url);
    if (!imageUrl) {
      return NextResponse.json({ success: false, error: 'Fal.ai no devolvió una imagen válida.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, imageUrl, provider: 'fal-flux-kontext' });
  } catch (error) {
    console.error('[edit-image] Fal.ai request failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'No se pudo transformar la imagen. Inténtalo de nuevo en unos momentos.' },
      { status: 502 },
    );
  }
}
