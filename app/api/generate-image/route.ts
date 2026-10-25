import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, getImageRateLimit, sanitizeInput } from '@/lib/security';
import { getEnvVar } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const OVH_SDXL_URL =
  'https://stable-diffusion-xl.endpoints.kepler.ai.cloud.ovh.net/api/text2image';
const OVH_OAI_URL = 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/images/generations';
const HF_ROUTER_URL = 'https://router.huggingface.co/v1/images/generations';

function bytesToDataUrl(bytes: ArrayBuffer, mime = 'image/jpeg'): string {
  const buffer = Buffer.from(bytes);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function tryOvhSdxl(prompt: string): Promise<string | null> {
  try {
    const res = await fetch(OVH_SDXL_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/octet-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `${prompt}, high quality, detailed, 1024x1024`,
        negative_prompt: 'blurry, watermark, text, logo, low quality, deformed',
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok) {
      console.error('[generate-image] OVH SDXL status', res.status);
      return null;
    }

    const bytes = await res.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength < 1000) return null;
    const mime = res.headers.get('content-type')?.includes('png') ? 'image/png' : 'image/jpeg';
    return bytesToDataUrl(bytes, mime);
  } catch (err) {
    console.error('[generate-image] OVH SDXL failed', err instanceof Error ? err.message : err);
    return null;
  }
}

async function tryOvhOpenAICompat(prompt: string): Promise<string | null> {
  try {
    const res = await fetch(OVH_OAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'stable-diffusion-xl-base-v10',
        prompt: `${prompt}, high quality, detailed`,
        size: '1024x1024',
        response_format: 'b64_json',
        n: 1,
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const item = data.data?.[0];
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
    if (item?.url) return item.url;
    return null;
  } catch (err) {
    console.error('[generate-image] OVH OAI failed', err instanceof Error ? err.message : err);
    return null;
  }
}

async function tryHuggingFace(prompt: string): Promise<string | null> {
  const token =
    getEnvVar('HF_TOKEN') ??
    getEnvVar('HUGGINGFACE_API_KEY') ??
    getEnvVar('HUGGINGFACE_TOKEN');
  if (!token) return null;

  try {
    const res = await fetch(HF_ROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell',
        prompt,
        size: '1024x1024',
        response_format: 'b64_json',
        n: 1,
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok) {
      // Legacy inference fallback
      const legacy = await fetch(
        'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'image/png',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: { width: 1024, height: 1024 },
          }),
          signal: AbortSignal.timeout(90000),
        },
      );
      if (!legacy.ok) return null;
      const bytes = await legacy.arrayBuffer();
      if (!bytes.byteLength) return null;
      return bytesToDataUrl(bytes, 'image/png');
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as {
        data?: Array<{ b64_json?: string; url?: string }>;
      };
      const item = data.data?.[0];
      if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item?.url) return item.url;
      return null;
    }

    const bytes = await res.arrayBuffer();
    if (!bytes.byteLength) return null;
    return bytesToDataUrl(bytes, 'image/png');
  } catch (err) {
    console.error('[generate-image] HF failed', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = getImageRateLimit(`image:${clientIp}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Has generado demasiadas imágenes. Espera un minuto e inténtalo de nuevo.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
    );
  }

  let prompt = '';
  try {
    const body = (await request.json()) as { prompt?: unknown };
    prompt = typeof body.prompt === 'string' ? sanitizeInput(body.prompt.trim()) : '';
  } catch {
    return NextResponse.json({ success: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  if (!prompt || prompt.length > 4000) {
    return NextResponse.json({ success: false, error: 'Describe la imagen que quieres crear.' }, { status: 400 });
  }

  // Prefer fast public SDXL (OVH), then HF Flux if token present
  const imageUrl =
    (await tryOvhSdxl(prompt)) ??
    (await tryOvhOpenAICompat(prompt)) ??
    (await tryHuggingFace(prompt));

  if (!imageUrl) {
    return NextResponse.json(
      {
        success: false,
        error:
          'No pude generar la imagen ahora mismo (límite temporal del proveedor). Inténtalo de nuevo en unos segundos.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    success: true,
    imageUrl,
    width: 1024,
    height: 1024,
    provider: imageUrl.startsWith('data:') ? 'ovh-sdxl' : 'external',
  });
}
