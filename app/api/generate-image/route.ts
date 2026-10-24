import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, getImageRateLimit, sanitizeInput } from '@/lib/security';
import { enhancePrompt, type ImageResult } from '@/lib/services/image/types';
import { tryHuggingFace } from '@/lib/services/image/huggingface';
import { tryAIHorde } from '@/lib/services/image/aihorde';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = getImageRateLimit(`image:${clientIp}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Has generado demasiadas imágenes. Espera un minuto e inténtalo de nuevo.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
      );
    }

    const body = (await request.json()) as { prompt?: unknown };
    const prompt = typeof body.prompt === 'string' ? sanitizeInput(body.prompt.trim()) : '';
    if (!prompt || prompt.length > 4000) {
      return NextResponse.json({ error: 'Describe la imagen que quieres crear.' }, { status: 400 });
    }

    const enhanced = enhancePrompt(prompt);
    let result: ImageResult | null = null;

    // Level 1: Hugging Face Inference (FLUX.1-schnell, then SDXL)
    result = await tryHuggingFace(enhanced);
    if (result) {
      return NextResponse.json({ url: result.url, provider: result.provider });
    }

    // Level 2: AI Horde (async generation with polling)
    result = await tryAIHorde(enhanced);
    if (result) {
      return NextResponse.json({ url: result.url, provider: result.provider });
    }

    return NextResponse.json(
      { error: 'No pude crear la imagen en este momento. Todos los motores están ocupados.' },
      { status: 503 },
    );
  } catch (error) {
    console.error('[Yosseling] Generate-image route failed:', error);
    return NextResponse.json({ error: 'No pude crear la imagen en este momento.' }, { status: 500 });
  }
}
