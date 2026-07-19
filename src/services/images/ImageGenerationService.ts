/**
 * ImageGenerationService — generates, edits, and analyzes images via
 * OpenAI Images API and Gemini.
 *
 * Security:
 *  - All API keys are read from server-side env vars only.
 *  - Never exposed to the frontend.
 *
 * Capabilities:
 *  - generateImage(prompt, size)  → DALL-E 3 (OpenAI) or Gemini image gen.
 *  - editImage(prompt, imageB64, mask?) → DALL-E 2 edit endpoint.
 *  - analyzeImage(prompt, imageB64) → Gemini vision describes the image.
 */
import { getEnvVar } from '@/lib/env';

export type ImageSize = '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
export type ImageQuality = 'standard' | 'hd';
export type ImageStyle = 'natural' | 'vivid';

export interface GenerateImageRequest {
  prompt: string;
  size?: ImageSize;
  quality?: ImageQuality;
  style?: ImageStyle;
  n?: number;
}

export interface GeneratedImage {
  b64: string;
  mimeType: string;
  revisedPrompt?: string;
  provider: 'openai' | 'gemini';
}

export interface AnalyzeImageRequest {
  prompt: string;
  imageB64: string;
  mimeType?: string;
}

export interface ImageHistoryEntry {
  id: string;
  kind: 'generate' | 'edit' | 'analyze';
  prompt: string;
  createdAt: number;
  provider: 'openai' | 'gemini';
  result?: GeneratedImage;
  analysis?: string;
  error?: string;
}

const OPENAI_IMAGES_ENDPOINT = 'https://api.openai.com/v1/images';
const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=`;

function pickProvider(): 'openai' | 'gemini' | null {
  if (getEnvVar('OPENAI_API_KEY')) return 'openai';
  if (getEnvVar('GEMINI_API_KEY')) return 'gemini';
  return null;
}

export const imageGenerationService = {
  isConfigured(): boolean {
    return pickProvider() !== null;
  },

  async generateImage(req: GenerateImageRequest): Promise<GeneratedImage> {
    const provider = pickProvider();
    if (!provider) {
      throw new Error('No image generation provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY.');
    }

    if (provider === 'openai') {
      return generateWithOpenAI(req);
    }
    return generateWithGemini(req);
  },

  async editImage(
    prompt: string,
    imageB64: string,
    mimeType: string,
    maskB64?: string,
  ): Promise<GeneratedImage> {
    const apiKey = getEnvVar('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for image editing.');
    }

    const form = new FormData();
    form.append('model', 'gpt-image-1');
    form.append('prompt', prompt);
    form.append('image', `data:${mimeType};base64,${imageB64}`);
    if (maskB64) form.append('mask', `data:${mimeType};base64,${maskB64}`);
    form.append('n', '1');
    form.append('size', '1024x1024');

    const res = await fetch(`${OPENAI_IMAGES_ENDPOINT}/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`openai edit: ${res.status} ${err.slice(0, 200)}`);
    }
    const data = await res.json() as { data?: Array<{ b64_json?: string; url?: string }> };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error('openai edit: no image returned');
    return { b64, mimeType: 'image/png', provider: 'openai' };
  },

  async analyzeImage(req: AnalyzeImageRequest): Promise<string> {
    const apiKey = getEnvVar('GEMINI_API_KEY') ?? getEnvVar('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY or OPENAI_API_KEY is required for image analysis.');
    }

    // Prefer Gemini for vision.
    if (getEnvVar('GEMINI_API_KEY')) {
      return analyzeWithGemini(req);
    }
    return analyzeWithOpenAI(req);
  },
};

async function generateWithOpenAI(req: GenerateImageRequest): Promise<GeneratedImage> {
  const apiKey = getEnvVar('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const body: Record<string, unknown> = {
    model: 'dall-e-3',
    prompt: req.prompt,
    n: req.n ?? 1,
    size: req.size ?? '1024x1024',
    quality: req.quality ?? 'standard',
    style: req.style ?? 'vivid',
    response_format: 'b64_json',
  };

  console.log(`[ImageService] OpenAI generate — prompt="${truncate(req.prompt, 80)}" size=${body.size}`);

  const res = await fetch(OPENAI_IMAGES_ENDPOINT + '/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`openai generate: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json() as { data?: Array<{ b64_json?: string; revised_prompt?: string }> };
  const item = data.data?.[0];
  if (!item?.b64_json) throw new Error('openai generate: no image returned');
  return {
    b64: item.b64_json,
    mimeType: 'image/png',
    revisedPrompt: item.revised_prompt,
    provider: 'openai',
  };
}

async function generateWithGemini(req: GenerateImageRequest): Promise<GeneratedImage> {
  const apiKey = getEnvVar('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const model = 'gemini-2.0-flash-preview-image-generation';
  const url = `${GEMINI_ENDPOINT(model)}${apiKey}`;

  const body = {
    contents: [{
      role: 'user',
      parts: [{ text: req.prompt }],
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  console.log(`[ImageService] Gemini generate — prompt="${truncate(req.prompt, 80)}"`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
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
      };
    }
  }
  throw new Error('gemini generate: no image returned');
}

async function analyzeWithGemini(req: AnalyzeImageRequest): Promise<string> {
  const apiKey = getEnvVar('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const model = 'gemini-2.5-flash-preview-05-20';
  const url = `${GEMINI_ENDPOINT(model)}${apiKey}`;

  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: req.prompt },
        { inlineData: { mimeType: req.mimeType ?? 'image/png', data: req.imageB64 } },
      ],
    }],
  };

  console.log(`[ImageService] Gemini analyze — prompt="${truncate(req.prompt, 80)}"`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`gemini analyze: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('gemini analyze: no text returned');
  return text;
}

async function analyzeWithOpenAI(req: AnalyzeImageRequest): Promise<string> {
  const apiKey = getEnvVar('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: req.prompt },
          { type: 'image_url', image_url: { url: `data:${req.mimeType ?? 'image/png'};base64,${req.imageB64}` } },
        ],
      },
    ],
    max_tokens: 1024,
  };

  console.log(`[ImageService] OpenAI analyze — prompt="${truncate(req.prompt, 80)}"`);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`openai analyze: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// In-memory history (per server instance). For production, persist to Supabase.
const history: ImageHistoryEntry[] = [];

export function recordImageHistory(entry: ImageHistoryEntry): void {
  history.unshift(entry);
  if (history.length > 50) history.length = 50;
}

export function getImageHistory(): ImageHistoryEntry[] {
  return [...history];
}
