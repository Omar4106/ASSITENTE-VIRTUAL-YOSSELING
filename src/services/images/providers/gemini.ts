/**
 * Gemini image provider — Imagen-style generation via gemini-2.0-flash-preview,
 * edit via same model with image input, and vision analysis via gemini-2.5-flash.
 *
 * All calls use server-side GEMINI_API_KEY only.
 */
import { getEnvVar } from '@/lib/env';
import type {
  AnalyzeImageRequest, EditImageRequest, GenerateImageRequest,
  GeneratedImage, ImageAnalysisResult,
} from '../types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEN_MODEL = 'gemini-2.0-flash-preview-image-generation';
const VISION_MODEL = 'gemini-2.5-flash-preview-05-20';

const COST_GENERATE = 0.040;
const COST_EDIT = 0.040;
const COST_ANALYZE = 0.001;

function apiKey(): string {
  const k = getEnvVar('GEMINI_API_KEY');
  if (!k) throw new Error('GEMINI_API_KEY not configured');
  return k;
}

function endpoint(model: string, method: string): string {
  return `${GEMINI_BASE}/models/${model}:${method}?key=${apiKey()}`;
}

export async function generateWithGemini(
  req: GenerateImageRequest,
  negativePrompt: string,
): Promise<GeneratedImage> {
  const prompt = req.enhancedPrompt ?? req.prompt;
  const fullPrompt = negativePrompt ? `${prompt}\n\n${negativePrompt}` : prompt;

  const body = {
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  const res = await fetch(endpoint(GEN_MODEL, 'generateContent'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`gemini generate: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> };
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (p.inlineData?.data) {
      return {
        b64: p.inlineData.data,
        mimeType: p.inlineData.mimeType ?? 'image/png',
        provider: 'gemini',
        costEstimate: COST_GENERATE,
        generationMs: 0,
      };
    }
  }
  throw new Error('gemini generate: no image returned');
}

export async function editWithGemini(req: EditImageRequest): Promise<GeneratedImage> {
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: `${req.prompt}\n\nEdita la imagen adjunta según estas instrucciones, manteniendo la coherencia.` },
        { inlineData: { mimeType: req.mimeType, data: req.imageB64 } },
      ],
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  const res = await fetch(endpoint(GEN_MODEL, 'generateContent'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`gemini edit: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> };
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (p.inlineData?.data) {
      return {
        b64: p.inlineData.data,
        mimeType: p.inlineData.mimeType ?? 'image/png',
        provider: 'gemini',
        costEstimate: COST_EDIT,
        generationMs: 0,
      };
    }
  }
  throw new Error('gemini edit: no image returned');
}

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
