/**
 * OpenAI image provider — DALL-E 3 generation, gpt-image-1 edit, GPT-4o vision.
 *
 * All calls use server-side OPENAI_API_KEY only.
 */
import { getEnvVar } from '@/lib/env';
import type {
  AnalyzeImageRequest, EditImageRequest, GenerateImageRequest,
  GeneratedImage, ImageAnalysisResult,
} from '../types';

const OPENAI_IMAGES_ENDPOINT = 'https://api.openai.com/v1/images';

// Cost estimates per operation (USD) — used for the X-Cost header and history.
const COST_GENERATE_STANDARD = 0.040;
const COST_GENERATE_HD = 0.080;
const COST_EDIT = 0.040;
const COST_ANALYZE = 0.005; // GPT-4o-mini vision ~5k tokens

function apiKey(): string {
  const k = getEnvVar('OPENAI_API_KEY');
  if (!k) throw new Error('OPENAI_API_KEY not configured');
  return k;
}

export async function generateWithOpenAI(req: GenerateImageRequest): Promise<GeneratedImage> {
  const k = apiKey();
  const size = req.size ?? '1024x1024';
  const quality = req.quality ?? 'standard';
  const prompt = req.enhancedPrompt ?? req.prompt;

  const body: Record<string, unknown> = {
    model: 'dall-e-3',
    prompt,
    n: 1, // DALL-E 3 only supports n=1
    size,
    quality,
    style: 'vivid',
    response_format: 'b64_json',
  };

  const res = await fetch(`${OPENAI_IMAGES_ENDPOINT}/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${k}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
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
    costEstimate: quality === 'hd' ? COST_GENERATE_HD : COST_GENERATE_STANDARD,
    generationMs: 0,
  };
}

export async function editWithOpenAI(req: EditImageRequest): Promise<GeneratedImage> {
  const k = apiKey();

  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', req.prompt);
  form.append('image', `data:${req.mimeType};base64,${req.imageB64}`);
  if (req.maskB64) form.append('mask', `data:${req.mimeType};base64,${req.maskB64}`);
  form.append('n', '1');
  form.append('size', '1024x1024');

  const res = await fetch(`${OPENAI_IMAGES_ENDPOINT}/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${k}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`openai edit: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json() as { data?: Array<{ b64_json?: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('openai edit: no image returned');

  return {
    b64,
    mimeType: 'image/png',
    provider: 'openai',
    costEstimate: COST_EDIT,
    generationMs: 0,
  };
}

export async function analyzeWithOpenAI(req: AnalyzeImageRequest): Promise<ImageAnalysisResult> {
  const k = apiKey();

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: req.prompt || 'Describe esta imagen en detalle.' },
          { type: 'image_url', image_url: { url: `data:${req.mimeType ?? 'image/png'};base64,${req.imageB64}` } },
        ],
      },
    ],
    max_tokens: 1024,
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${k}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`openai analyze: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('openai analyze: no text returned');

  return {
    text,
    provider: 'openai',
    costEstimate: COST_ANALYZE,
    generationMs: 0,
  };
}
