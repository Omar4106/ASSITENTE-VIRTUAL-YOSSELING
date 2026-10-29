import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, getImageRateLimit, audioPromptSchema } from '@/lib/security';
import { createServerFalClient, validateFalMediaUrl } from '@/lib/fal-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const rateLimit = getImageRateLimit(`generate-audio:${getClientIp(request)}`);
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

  const parsed = audioPromptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Describe el audio (3 a 1000 caracteres); la letra opcional admite hasta 3000.' }, { status: 400 });
  }
  const { prompt, lyrics } = parsed.data;

  const fal = createServerFalClient();
  if (!fal) {
    return NextResponse.json({ success: false, error: 'La generación de audio requiere configurar FAL_API_KEY, FAL_KEY o AI_HORDE_API_KEY en el servidor.' }, { status: 503 });
  }

  try {
    const result = await fal.subscribe('fal-ai/ace-step', {
      input: {
        tags: prompt,
        lyrics,
        duration: 20,
        number_of_steps: 27,
      },
      abortSignal: AbortSignal.timeout(165_000),
    });
    const data = result.data as { audio?: { url?: string } };
    const audioUrl = validateFalMediaUrl(data.audio?.url);
    if (!audioUrl) {
      return NextResponse.json({ success: false, error: 'Fal.ai no devolvió un audio válido.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, audioUrl, provider: 'fal-ace-step' });
  } catch (error) {
    console.error('[generate-audio] Fal.ai request failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'No se pudo generar el audio. Inténtalo de nuevo en unos momentos.' },
      { status: 502 },
    );
  }
}
