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
 * All calls use server-side GEMINI_API_KEY only.
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

function endpoint(model: string, method: string): string {
  return `${GEMINI_BASE}/models/${model}:${method}?key=${apiKey()}`;
}

/**
 * Analyze an image with Gemini Vision.
 *
 * Capabilities:
 *  - describe the image
 *  - detect objects
 *  - read text (OCR)
 *  - explain content
 *  - answer questions about the image
 */
export async function analyzeWithGemini(req: AnalyzeImageRequest): Promise<ImageAnalysisResult> {
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: req.prompt || 'Describe esta imagen en detalle, identifica objetos, lee texto (OCR) y explica el contenido.' },
        { inlineData: { mimeType: req.mimeType ?? 'image/png', data: req.imageB64 } },
      ],
    }],
  };

  const res = await fetch(endpoint(VISION_MODEL, 'generateContent'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`gemini analyze: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('gemini analyze: no text returned');

  return {
    text,
    provider: 'gemini',
    costEstimate: COST_ANALYZE,
    generationMs: 0,
  };
}
