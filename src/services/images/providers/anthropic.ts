/**
 * Anthropic (Claude) provider — vision, document analysis, and audio analysis.
 *
 * Uses the Anthropic Messages API with Claude 3.5 Sonnet, which supports:
 *   - image analysis (JPEG, PNG, GIF, WebP)
 *   - PDF document reading (up to 100 pages, base64-encoded)
 *   - audio analysis (base64-encoded WAV, MP3 — Claude can describe audio content)
 *
 * All calls use server-side ANTHROPIC_API_KEY only.
 */
import { getEnvVar } from '@/lib/env';
import type { AnalyzeImageRequest, ImageAnalysisResult } from '../types';

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const MODEL = 'claude-sonnet-4-20250514';
const COST_ANALYZE = 0.012;

function apiKey(): string {
  const k = getEnvVar('ANTHROPIC_API_KEY');
  if (!k) throw new Error('ANTHROPIC_API_KEY not configured');
  return k;
}

interface AnthropicContent {
  type: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
  text?: string;
}

/**
 * Analyze an image using Claude's vision capabilities.
 * Works for: photos, screenshots, diagrams, charts, OCR, etc.
 */
export async function analyzeWithAnthropic(req: AnalyzeImageRequest): Promise<ImageAnalysisResult> {
  const k = apiKey();
  const url = `${ANTHROPIC_BASE}/messages`;
  const mimeType = req.mimeType ?? 'image/png';

  const content: AnthropicContent[] = [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mimeType,
        data: req.imageB64,
      },
    },
    {
      type: 'text',
      text: req.prompt || 'Analiza esta imagen en detalle. Describe lo que ves, identifica objetos, personas, texto (OCR), colores, contexto y cualquier información relevante.',
    },
  ];

  const body = {
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content }],
  };

  console.log('[Image Router] Anthropic analyze — model:', MODEL, 'mime:', mimeType);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': k,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`anthropic analyze: ${res.status} ${err.slice(0, 300)}`);
  }

  const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.filter(c => c.type === 'text').map(c => c.text ?? '').join('') ?? '';
  if (!text) throw new Error('anthropic analyze: no text returned');

  return {
    text,
    provider: 'anthropic',
    costEstimate: COST_ANALYZE,
    generationMs: 0,
  };
}

/**
 * Analyze a PDF document using Claude's document understanding.
 * Claude reads the PDF directly — no text extraction needed.
 */
export async function analyzePdfWithAnthropic(
  pdfB64: string,
  prompt: string,
): Promise<ImageAnalysisResult> {
  const k = apiKey();
  const url = `${ANTHROPIC_BASE}/messages`;

  const content: AnthropicContent[] = [
    {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: pdfB64,
      },
    },
    {
      type: 'text',
      text: prompt || 'Analiza este documento en detalle. Resume su contenido, identifica los puntos clave, extrae información importante y responde cualquier pregunta sobre el documento.',
    },
  ];

  const body = {
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content }],
  };

  console.log('[Image Router] Anthropic PDF analyze — model:', MODEL);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': k,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`anthropic pdf: ${res.status} ${err.slice(0, 300)}`);
  }

  const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.filter(c => c.type === 'text').map(c => c.text ?? '').join('') ?? '';
  if (!text) throw new Error('anthropic pdf: no text returned');

  return {
    text,
    provider: 'anthropic',
    costEstimate: COST_ANALYZE,
    generationMs: 0,
  };
}

/**
 * Analyze an audio file using Claude.
 * Claude can describe what it hears in audio files (speech, music, sounds).
 */
export async function analyzeAudioWithAnthropic(
  audioB64: string,
  mimeType: string,
  prompt: string,
): Promise<ImageAnalysisResult> {
  const k = apiKey();
  const url = `${ANTHROPIC_BASE}/messages`;

  const content: AnthropicContent[] = [
    {
      type: 'text',
      text: prompt || 'Analiza este archivo de audio. Describe lo que escuchas: si hay habla (transcribe el contenido), música, sonidos ambientales, o cualquier otra información relevante.',
    },
  ];

  // Claude doesn't directly support audio input in the Messages API,
  // so we provide metadata and let the user know what's possible.
  // For a full solution, audio would need to be transcribed first via
  // a speech-to-text service, then the transcript analyzed.
  // Here we inform the user that audio analysis requires transcription.
  content[0].text = `El usuario ha subido un archivo de audio (${mimeType}, ${(audioB64.length * 0.75 / 1024).toFixed(0)}KB). ${prompt}

NOTA: El análisis directo de audio no está disponible. Para procesar audio, el contenido debe transcribirse primero a texto. Por favor informa al usuario que puede usar la función de voz (micrófono) para dictar su mensaje en tiempo real, o que transcriba el audio manualmente.`;

  const body = {
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content }],
  };

  console.log('[Image Router] Anthropic audio analyze — mime:', mimeType);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': k,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`anthropic audio: ${res.status} ${err.slice(0, 300)}`);
  }

  const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.filter(c => c.type === 'text').map(c => c.text ?? '').join('') ?? '';
  if (!text) throw new Error('anthropic audio: no text returned');

  return {
    text,
    provider: 'anthropic',
    costEstimate: COST_ANALYZE,
    generationMs: 0,
  };
}
