import { NextRequest, NextResponse } from 'next/server';
import { getEnvVar } from '@/lib/env';
import { getImageRateLimit, getClientIp, sanitizeInput } from '@/lib/security';

export const runtime = 'nodejs';

function enhancePrompt(userPrompt: string): string {
  return `${userPrompt}, hyperrealistic, 8k resolution, detailed, vivid colors, photorealistic, sharp focus, professional photography, clean composition`;
}

function tryPollinations(prompt: string): string {
  const seed = Math.floor(Math.random() * 1000000);
  const enhanced = enhancePrompt(prompt);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(enhanced)}?width=1024&height=1024&model=flux&nologo=true&enhance=true&seed=${seed}`;
}

async function tryFalAI(prompt: string): Promise<string | null> {
  const apiKey = getEnvVar('FAL_AI_API_KEY');
  if (!apiKey) return null;
  try {
    const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, image_size: 'square_hd', num_inference_steps: 4, num_images: 1, enable_safety_checker: true }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return null;
    const result = await response.json() as { images?: Array<{ url?: string }> };
    return result.images?.[0]?.url ?? null;
  } catch { return null; }
}

async function tryHuggingFaceFLUX(prompt: string): Promise<string | null> {
  const apiKey = getEnvVar('HUGGINGFACE_API_KEY');
  if (!apiKey) return null;
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt, parameters: { width: 1024, height: 1024, num_inference_steps: 4 } }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) return null;
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch { return null; }
}

async function tryOpenAI(prompt: string): Promise<string | null> {
  const apiKey = getEnvVar('OPENAI_API_KEY');
  if (!apiKey) return null;
  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', quality: 'standard', response_format: 'url' }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return null;
    const result = await response.json() as { data?: Array<{ url?: string }> };
    return result.data?.[0]?.url ?? null;
  } catch { return null; }
}

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

    const body = await request.json() as { prompt?: unknown };
    const prompt = typeof body.prompt === 'string' ? sanitizeInput(body.prompt.trim()) : '';
    if (!prompt || prompt.length > 4000) {
      return NextResponse.json({ error: 'Describe la imagen que quieres crear.' }, { status: 400 });
    }

    const enhanced = enhancePrompt(prompt);

    const url = tryPollinations(prompt);
    if (url) {
      return NextResponse.json({ url, provider: 'pollinations-flux' });
    }

    const fallbacks = [
      () => tryFalAI(enhanced),
      () => tryHuggingFaceFLUX(enhanced),
      () => tryOpenAI(enhanced),
    ];

    for (const fn of fallbacks) {
      const result = await fn();
      if (result) return NextResponse.json({ url: result });
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
