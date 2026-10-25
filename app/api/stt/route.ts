import { NextRequest, NextResponse } from 'next/server';
import { getEnvVar } from '@/lib/env';
import { STT_MODEL } from '@/lib/ai-config';
import { getImageRateLimit, getClientIp } from '@/lib/security';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rateLimit = getImageRateLimit(`stt:${clientIp}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Has enviado demasiadas notas de voz. Espera un momento.' },
        { status: 429 },
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    if (!audioFile) {
      return NextResponse.json({ error: 'No se encontró audio.' }, { status: 400 });
    }

    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'El audio es demasiado grande (máx 25 MB).' }, { status: 413 });
    }

    const apiKey = getEnvVar('GROQ_API_KEY');
    if (!apiKey) {
      return NextResponse.json({ error: 'El servicio de transcripción no está disponible.' }, { status: 503 });
    }

    const groqFormData = new FormData();
    groqFormData.append('file', audioFile);
    groqFormData.append('model', STT_MODEL);
    groqFormData.append('language', 'es');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: groqFormData,
    });

    if (!response.ok) {
      console.error('[Yosseling STT] Error:', response.status);
      return NextResponse.json({ error: 'No pude transcribir el audio.' }, { status: 502 });
    }

    const result = await response.json() as { text?: string };
    return NextResponse.json({ text: result.text ?? '' });
  } catch (error) {
    console.error('[Yosseling STT] Unexpected error:', error);
    return NextResponse.json({ error: 'Ocurrió un error con la transcripción.' }, { status: 500 });
  }
}
