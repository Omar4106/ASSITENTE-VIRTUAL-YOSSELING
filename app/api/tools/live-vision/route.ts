import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getClientIp } from '@/lib/security';
import { getEnvVar } from '@/lib/env';
import { getVisionModelForProvider, PROVIDER_CONFIG } from '@/lib/ai-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BASE64_LENGTH = 7_000_000;
const requestSchema = z.object({
  image: z.string().max(MAX_IMAGE_BASE64_LENGTH),
  question: z.string().trim().min(3).max(1000).default('Describe lo que ves y señala detalles importantes.'),
});

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(`live-vision:${getClientIp(request)}`, 8);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Has enviado demasiados imágenes para analizar. Espera un minuto.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'La solicitud no contiene JSON válido.' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'La imagen o la pregunta no tienen un formato válido.' }, { status: 400 });
  }

  const imageMatch = parsed.data.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!imageMatch) {
    return NextResponse.json({ error: 'Usa una imagen JPEG, PNG o WebP válida.' }, { status: 400 });
  }

  const provider = PROVIDER_CONFIG.groq;
  const apiKey = getEnvVar(provider.envKey);
  if (!apiKey) {
    return NextResponse.json(
      { error: 'El análisis visual requiere configurar GROQ_API_KEY en el servidor.' },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${provider.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getVisionModelForProvider('groq'),
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: parsed.data.question },
            { type: 'image_url', image_url: { url: parsed.data.image } },
          ],
        }],
        temperature: 0.3,
        max_tokens: 700,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!response.ok) {
      console.error('[live-vision] Groq returned status', response.status);
      return NextResponse.json(
        { error: 'El proveedor de visión no pudo analizar la imagen. Inténtalo de nuevo.' },
        { status: 502 },
      );
    }

    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const analysis = result.choices?.[0]?.message?.content?.trim();
    if (!analysis) {
      return NextResponse.json({ error: 'El proveedor no devolvió una descripción de la imagen.' }, { status: 502 });
    }

    return NextResponse.json({ analysis, provider: 'groq', model: getVisionModelForProvider('groq') });
  } catch (error) {
    console.error('[live-vision] Request failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se pudo conectar con el servicio de visión.' }, { status: 502 });
  }
}
