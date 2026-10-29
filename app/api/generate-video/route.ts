import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, getImageRateLimit, videoPromptSchema } from '@/lib/security';
import { createServerFalClient, parseImageDataUrl, validateFalMediaUrl } from '@/lib/fal-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const rateLimit = getImageRateLimit(`generate-video:${getClientIp(request)}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Has generado demasiado contenido multimedia. Espera un minuto e inténtalo de nuevo.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'La solicitud debe contener JSON válido.' }, { status: 400 });
  }

  const parsed = videoPromptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Describe el video (3 a 1000 caracteres).' }, { status: 400 });
  }
  const prompt = parsed.data.prompt;
  const suppliedImage = parsed.data.imageDataUrl;
  const imageDataUrl = suppliedImage === undefined ? undefined : parseImageDataUrl(suppliedImage);
  if (suppliedImage !== undefined && !imageDataUrl) {
    return NextResponse.json({ success: false, error: 'La imagen de referencia debe ser PNG, JPEG o WebP de hasta 8 MB.' }, { status: 400 });
  }

  const fal = createServerFalClient();
  if (!fal) {
    return NextResponse.json({ success: false, error: 'La generación de video requiere configurar FAL_API_KEY, FAL_KEY o AI_HORDE_API_KEY en el servidor.' }, { status: 503 });
  }

  try {
    const result = imageDataUrl
      ? await fal.subscribe('fal-ai/wan-i2v', {
          input: {
            prompt,
            image_url: imageDataUrl,
            aspect_ratio: 'auto',
            resolution: '480p',
            num_frames: 81,
            frames_per_second: 16,
            enable_safety_checker: true,
          },
          abortSignal: AbortSignal.timeout(285_000),
        })
      : await fal.subscribe('fal-ai/wan-t2v', {
          input: {
            prompt,
            resolution: '480p',
            num_frames: 81,
            frames_per_second: 16,
            enable_safety_checker: true,
          },
          abortSignal: AbortSignal.timeout(285_000),
        });
    const data = result.data as { video?: { url?: string } };
    const videoUrl = validateFalMediaUrl(data.video?.url);
    if (!videoUrl) {
      return NextResponse.json({ success: false, error: 'Fal.ai no devolvió un video válido.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, videoUrl, provider: imageDataUrl ? 'fal-wan-i2v' : 'fal-wan-t2v' });
  } catch (error) {
    console.error('[generate-video] Fal.ai request failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'No se pudo generar el video. Inténtalo de nuevo en unos momentos.' },
      { status: 502 },
    );
  }
}
