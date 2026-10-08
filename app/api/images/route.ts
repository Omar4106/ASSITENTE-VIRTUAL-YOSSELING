import { NextRequest, NextResponse } from 'next/server';
import { getEnvVar } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { prompt?: unknown };
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt || prompt.length > 4000) {
      return NextResponse.json({ error: 'Describe la imagen que quieres crear.' }, { status: 400 });
    }

    const apiKey = getEnvVar('OPENAI_API_KEY');
    if (!apiKey) {
      return NextResponse.json({ error: 'La generación de imágenes no está configurada.' }, { status: 503 });
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'url',
      }),
    });

    if (!response.ok) {
      console.error('[Yosseling] Image provider failed:', response.status);
      return NextResponse.json({ error: 'No pude crear la imagen en este momento.' }, { status: 502 });
    }

    const result = await response.json() as { data?: Array<{ url?: string }> };
    const url = result.data?.[0]?.url;
    if (!url) return NextResponse.json({ error: 'La imagen no devolvió una dirección válida.' }, { status: 502 });
    return NextResponse.json({ url });
  } catch (error) {
    console.error('[Yosseling] Image route failed:', error);
    return NextResponse.json({ error: 'No pude crear la imagen en este momento.' }, { status: 500 });
  }
}
