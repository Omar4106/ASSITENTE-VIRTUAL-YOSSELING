import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getClientIp, getImageRateLimit, imagePromptSchema } from '@/lib/security';
import { getEnvVar } from '@/lib/env';
import { logImagePromptMetadata, optimizeImagePrompt } from '@/lib/image-prompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const FAL_IMAGE_URL = 'https://fal.run/fal-ai/flux/schnell';

interface FalImageResponse {
  images?: Array<{ url?: string; content_type?: string }>;
}

export async function POST(request: NextRequest) {
  const rateLimit = getImageRateLimit(`generate-image-fal:${getClientIp(request)}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Has generado demasiadas imágenes. Espera un minuto e inténtalo de nuevo.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'La solicitud debe contener JSON válido.' }, { status: 400 });
  }
  const parsed = imagePromptSchema.safeParse(
    body && typeof body === 'object' && 'prompt' in body ? body.prompt : undefined,
  );
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Escribe una descripción de imagen de 3 a 4000 caracteres.' }, { status: 400 });
  }
  const prompt = parsed.data;
  const optimized = optimizeImagePrompt(prompt);
  logImagePromptMetadata('generate-image-fal', randomUUID(), optimized, 'fal-flux-schnell');

  const apiKey = getEnvVar('FAL_KEY') ?? getEnvVar('FAL_API_KEY');
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'El proveedor rápido requiere configurar FAL_KEY en el servidor.' }, { status: 503 });
  }

  try {
    const response = await fetch(FAL_IMAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: optimized.prompt,
        image_size: 'square_hd',
        num_images: 1,
        output_format: 'png',
        num_inference_steps: 28,
        guidance_scale: 7.5,
        enable_safety_checker: true,
      }),
      signal: AbortSignal.timeout(75_000),
    });

    if (!response.ok) {
      console.error('[generate-image-fal] Provider returned status', response.status);
      return NextResponse.json(
        { success: false, error: 'Fal.ai no pudo generar la imagen. Inténtalo de nuevo en unos momentos.' },
        { status: response.status === 429 ? 429 : 502 },
      );
    }

    const result = await response.json() as FalImageResponse;
    const imageUrl = result.images?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json({ success: false, error: 'Fal.ai no devolvió una imagen válida.' }, { status: 502 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return NextResponse.json({ success: false, error: 'Fal.ai devolvió una dirección de imagen no válida.' }, { status: 502 });
    }
    if (
      parsedUrl.protocol !== 'https:' ||
      (parsedUrl.hostname !== 'fal.media' && !parsedUrl.hostname.endsWith('.fal.media'))
    ) {
      return NextResponse.json({ success: false, error: 'Fal.ai devolvió un enlace inseguro para la imagen.' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      imageUrl: parsedUrl.toString(),
      width: 1024,
      height: 1024,
      provider: 'fal-flux-schnell',
    });
  } catch (error) {
    console.error('[generate-image-fal] Request failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'No se pudo conectar con Fal.ai. Comprueba la conexión e inténtalo de nuevo.' },
      { status: 502 },
    );
  }
}
