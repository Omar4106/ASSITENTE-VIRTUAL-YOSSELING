/**
 * Gemini image provider — VISION ANALYSIS ONLY.
 *
 * Gemini is used exclusively for:
 *   - image analysis (describe, detect objects, answer questions)
 *   - OCR (extract text from images)
 *   - image description and recognition
 *
 * Gemini is NOT used for image generation or editing. Those operations
 * are handled exclusively by the OpenAI Images API (DALL-E 3 / gpt-image-1).
 *
 * TRACE mode: set env var IMAGE_TRACE=1 to print the full HTTP request and
 * response. API keys are redacted.
 */
import { getEnvVar } from '@/lib/env';
import type { AnalyzeImageRequest, ImageAnalysisResult } from '../types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const VISION_MODEL = 'gemini-2.5-flash-preview-05-20';

const COST_ANALYZE = 0.001;

function apiKey(): string {
  const k = getEnvVar('GEMINI_API_KEY');
  if (!k) throw new Error('GEMINI_API_KEY not configured');
  return k;
}

function isTrace(): boolean {
  return getEnvVar('IMAGE_TRACE') === '1' || process.env.IMAGE_TRACE === '1';
}

function redact(key: string): string {
  if (!key) return '(empty)';
  if (key.length <= 10) return '***';
  return `${key.slice(0, 6)}…${key.slice(-4)} (len=${key.length})`;
}

export async function analyzeWithGemini(req: AnalyzeImageRequest): Promise<ImageAnalysisResult> {
  const k = apiKey();
  const url = `${GEMINI_BASE}/models/${VISION_MODEL}:generateContent?key=${k}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: req.prompt || 'Describe esta imagen en detalle, identifica objetos, lee texto (OCR) y explica el contenido.' },
        { inlineData: { mimeType: req.mimeType ?? 'image/png', data: req.imageB64 } },
      ],
    }],
  };

  if (isTrace()) {
    console.log('\n========================');
    console.log('IMAGE REQUEST — ANALYZE');
    console.log('========================');
    console.log('Provider: Gemini Vision');
    console.log(`Model: ${VISION_MODEL}`);
    console.log(`Endpoint: ${GEMINI_BASE}/models/${VISION_MODEL}:generateContent?key=${redact(k)}`);
    console.log('Headers:', JSON.stringify(headers, null, 2));
    console.log('Body enviado:', JSON.stringify({
      ...body,
      contents: [{ role: 'user', parts: [{ text: body.contents[0].parts[0].text }, { inlineData: '[redacted b64]' }] }],
    }, null, 2));
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const rawText = await res.text().catch(() => '');
  if (isTrace()) {
    console.log(`HTTP Status: ${res.status} ${res.statusText}`);
    console.log('Respuesta RAW:');
    console.log(rawText.slice(0, 2000));
    console.log('========================\n');
  }

  if (!res.ok) {
    throw new Error(`gemini analyze: ${res.status} ${rawText.slice(0, 200)}`);
  }

  let data: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  try { data = JSON.parse(rawText); } catch { throw new Error('gemini analyze: invalid JSON response'); }

  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('gemini analyze: no text returned');

  return {
    text,
    provider: 'gemini',
    costEstimate: COST_ANALYZE,
    generationMs: 0,
  };
}
