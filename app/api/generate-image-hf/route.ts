import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getClientIp, getImageRateLimit, imagePromptSchema } from '@/lib/security';
import { getEnvVar } from '@/lib/env';
import { logImagePromptMetadata, optimizeImagePrompt } from '@/lib/image-prompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const HF_IMAGE_URL = 'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-dev';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function dataUrl(bytes: ArrayBuffer, contentType: string): string {
  const mimeType = contentType.includes('png')
    ? 'image/png'
    : contentType.includes('webp')
      ? 'image/webp'
      : 'image/jpeg';
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
}

export async function POST(request: NextRequest) {
  const rateLimit = getImageRateLimit(`generate-image-hf:${getClientIp(request)}`);
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
  logImagePromptMetadata('generate-image-hf', randomUUID(), optimized, 'huggingface-flux-dev');

  const token = getEnvVar('HF_TOKEN') ?? getEnvVar('HUGGINGFACE_API_KEY') ?? getEnvVar('HUGGINGFACE_TOKEN');
  if (!token) {
    return NextResponse.json({ success: false, error: 'El proveedor preciso requiere configurar HF_TOKEN en el servidor.' }, { status: 503 });
  }

  try {
    const response = await fetch(HF_IMAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'image/png, application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: optimized.prompt,
        parameters: {
          width: 1024,
          height: 1024,
          num_inference_steps: 40,
          guidance_scale: 7.5,
        },
      }),
      signal: AbortSignal.timeout(105_000),
    });

    if (!response.ok) {
      console.error('[generate-image-hf] Provider returned status', response.status);
      return NextResponse.json(
        { success: false, error: response.status === 503
          ? 'El modelo de Hugging Face está iniciando o temporalmente ocupado. Inténtalo de nuevo.'
          : 'Hugging Face no pudo generar la imagen. Revisa la disponibilidad del modelo y vuelve a intentarlo.' },
        { status: response.status === 503 ? 503 : 502 },
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'Hugging Face devolvió un formato de imagen no válido.' }, { status: 502 });
    }
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ success: false, error: 'La imagen generada supera el límite de tamaño permitido.' }, { status: 502 });
    }
    const image = await response.arrayBuffer();
    if (!image.byteLength || image.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ success: false, error: 'La imagen generada tiene un tamaño no válido.' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      imageUrl: dataUrl(image, contentType),
      width: 1024,
      height: 1024,
      provider: 'huggingface-flux-dev',
    });
  } catch (error) {
    console.error('[generate-image-hf] Request failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'No se pudo completar la generación en Hugging Face. Comprueba la conexión e inténtalo de nuevo.' },
      { status: 502 },
    );
  }
}
