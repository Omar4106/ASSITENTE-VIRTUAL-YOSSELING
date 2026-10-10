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

    // Try OpenAI DALL-E 3 first if key is configured
    const apiKey = getEnvVar('OPENAI_API_KEY');
    if (apiKey) {
      try {
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
        if (response.ok) {
          const result = await response.json() as { data?: Array<{ url?: string }> };
          const url = result.data?.[0]?.url;
          if (url) return NextResponse.json({ url, provider: 'dall-e-3' });
        }
      } catch {
        // Fall through to Pollinations
      }
    }

    // Pollinations AI fallback — free, no API key required
    const encodedPrompt = encodeURIComponent(prompt.slice(0, 500));
    const seed = Math.floor(Math.random() * 1000000);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true`;
    return NextResponse.json({ url: pollinationsUrl, provider: 'pollinations' });
  } catch (error) {
    console.error('[Yosseling] Image route failed:', error);
    return NextResponse.json({ error: 'No pude crear la imagen en este momento.' }, { status: 500 });
  }
}
