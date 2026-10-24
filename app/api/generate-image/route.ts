import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, getImageRateLimit, sanitizeInput } from '@/lib/security';
import { enhancePrompt, tryPollinations, withTimeout, type ImageResult } from '@/lib/services/image/types';
import { tryHuggingFace } from '@/lib/services/image/huggingface';
import { tryAIHorde } from '@/lib/services/image/aihorde';

export const runtime = 'nodejs';

const HF_TIMEOUT_MS = 5000;
const HORDE_TIMEOUT_MS = 5000;

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

    // Level 1: Hugging Face Inference (5s timeout — FLUX.1-schnell, then SDXL)
    const hfResult = await withTimeout(tryHuggingFace(enhanced), HF_TIMEOUT_MS);
    if (hfResult) {
      return NextResponse.json({ url: hfResult.url, provider: hfResult.provider });
    }

    // Level 2: AI Horde (5s timeout — async generation with polling)
    const hordeResult = await withTimeout(tryAIHorde(enhanced), HORDE_TIMEOUT_MS);
    if (hordeResult) {
      return NextResponse.json({ url: hordeResult.url, provider: hordeResult.provider });
    }

    // Level 3: Pollinations — guaranteed public fallback, always returns a URL
    const pollinationsUrl = tryPollinations(prompt);
    return NextResponse.json({ url: pollinationsUrl, provider: 'pollinations' });
  } catch (error) {
    console.error('[Yosseling] Generate-image route failed:', error);
    // Even on unexpected errors, return Pollinations so the UI always renders
    const body = await request.clone().json().catch(() => ({})) as { prompt?: string };
    const fallbackPrompt = typeof body.prompt === 'string' ? body.prompt : 'abstract art';
    const pollinationsUrl = tryPollinations(fallbackPrompt);
    return NextResponse.json({ url: pollinationsUrl, provider: 'pollinations' });
  }
}
