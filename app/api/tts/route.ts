import { NextRequest, NextResponse } from 'next/server';
import { getEnvVar } from '@/lib/env';
import { checkRateLimit, getClientIp, sanitizeInput } from '@/lib/security';
import type { PersonalityStyle } from '@/types';

export const runtime = 'nodejs';

const TTS_MODEL = 'canopylabs/orpheus-v1-english';
const TTS_VOICE = 'hannah';

const PERSONALITY_SPEED: Record<PersonalityStyle, number> = {
  profesional: 1.0,
  amigable: 1.05,
  creativa: 1.1,
  tecnica: 0.95,
  divertida: 1.15,
  formal: 0.9,
};

const PERSONALITY_EXPRESSIVE_TAG: Record<PersonalityStyle, string> = {
  profesional: '[calm, professional, clear speech] ',
  amigable: '[cheerful, natural speech, expressive tone] ',
  creativa: '[excited, warm, natural speech] ',
  tecnica: '[thoughtful, clear, measured speech] ',
  divertida: '[cheerful, playful, natural speech] ',
  formal: '[thoughtful, formal, composed speech] ',
};

function cleanTextForSpeech(raw: string): string {
  let text = raw;
  text = text.replace(/```[\s\S]*?```/g, ' bloque de código. ');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, ' imagen. ');
  text = text.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  text = text.replace(/^\s*>\s+/gm, '');
  text = text.replace(/\|/g, ' ');
  text = text.replace(/[*_~]/g, '');
  text = text.replace(/ GENERAR_IMAGEN:[^\]]+\]/gi, '');
  text = text.replace(/\[GENERAR_IMAGEN:[^\]]*\]/gi, '');
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  text = text.replace(/(https?:\/\/[^\s]+)/g, 'enlace.');
  text = text.replace(/\n{3,}/g, '. ');
  text = text.replace(/\n/g, '. ');
  text = text.replace(/\.{2,}/g, '. ');
  text = text.replace(/,\s*,/g, ', ');
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\s+([.,;:!?])/g, '$1');
  text = text.trim();
  if (text && !/[.!?]$/.test(text)) text += '.';
  return text;
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(`tts:${clientIp}`, 15);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Has usado la voz demasiadas veces. Espera un momento.' },
        { status: 429 },
      );
    }

    const body = await req.json() as { text?: unknown; personality?: unknown };
    const rawText = typeof body.text === 'string' ? sanitizeInput(body.text.trim()) : '';
    if (!rawText || rawText.length > 3000) {
      return NextResponse.json({ error: 'No hay texto para leer.' }, { status: 400 });
    }

    const cleanedText = cleanTextForSpeech(rawText);
    if (!cleanedText) {
      return NextResponse.json({ error: 'No hay texto para leer.' }, { status: 400 });
    }

    const personalityRaw = typeof body.personality === 'string' ? body.personality : 'amigable';
    const personality = (['profesional','amigable','creativa','tecnica','divertida','formal'].includes(personalityRaw)
      ? personalityRaw
      : 'amigable') as PersonalityStyle;
    const speed = PERSONALITY_SPEED[personality];
    const expressiveTag = PERSONALITY_EXPRESSIVE_TAG[personality];
    const ttsInput = `${expressiveTag}${cleanedText}`;

    const apiKey = getEnvVar('GROQ_API_KEY');
    if (!apiKey) {
      return NextResponse.json({ error: 'El servicio de voz no está disponible.' }, { status: 503 });
    }

    let audioBuffer: ArrayBuffer | null = null;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: TTS_MODEL,
          voice: TTS_VOICE,
          input: ttsInput,
          response_format: 'wav',
          speed,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return NextResponse.json(
          { error: `No pude generar la voz ahora. (${response.status}) ${errText.slice(0, 120)}` },
          { status: 502 },
        );
      }

      audioBuffer = await response.arrayBuffer();
    } catch {
      return NextResponse.json(
        { error: 'El servicio de voz no está disponible en este momento.' },
        { status: 503 },
      );
    }

    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: 'El servicio de voz devolvió una respuesta vacía.' },
        { status: 502 },
      );
    }

    const audioBytes = new Uint8Array(audioBuffer);

    return new NextResponse(audioBytes, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(audioBytes.byteLength),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Yosseling TTS] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error con el servicio de voz.' },
      { status: 500 },
    );
  }
}
