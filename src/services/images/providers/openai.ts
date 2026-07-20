/**
 * OpenAI image provider — DALL-E 3 generation, gpt-image-1 edit, GPT-4o vision.
 *
 * All calls use server-side OPENAI_API_KEY only.
 *
 * TRACE mode: set env var IMAGE_TRACE=1 to print the full HTTP request and
 * response for every call. API keys are redacted in the trace output.
 */
import { getEnvVar } from '@/lib/env';
import type {
  AnalyzeImageRequest, EditImageRequest, GenerateImageRequest,
  GeneratedImage, ImageAnalysisResult,
} from '../types';

const OPENAI_IMAGES_ENDPOINT = 'https://api.openai.com/v1/images';

const COST_GENERATE_STANDARD = 0.040;
const COST_GENERATE_HD = 0.080;
const COST_EDIT = 0.040;
const COST_ANALYZE = 0.005;

function apiKey(): string {
  const k = getEnvVar('OPENAI_API_KEY');
  if (!k) throw new Error('OPENAI_API_KEY not configured');
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

function traceBanner(label: string): void {
  if (!isTrace()) return;
  console.log('\n========================');
  console.log(`IMAGE REQUEST — ${label}`);
  console.log('========================');
}

function traceFooter(status: number, statusText: string, rawBody: string): void {
  if (!isTrace()) return;
  console.log(`HTTP Status: ${status} ${statusText}`);
  console.log('Respuesta RAW:');
  console.log(rawBody.slice(0, 2000));
  console.log('========================\n');
}

export async function generateWithOpenAI(req: GenerateImageRequest): Promise<GeneratedImage> {
  const k = apiKey();
  const size = req.size ?? '1024x1024';
  const quality = req.quality ?? 'standard';
  const prompt = req.enhancedPrompt ?? req.prompt;
  const model = 'dall-e-3';
  const url = `${OPENAI_IMAGES_ENDPOINT}/generations`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${k}`,
  };
  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size,
    quality,
    style: 'vivid',
    response_format: 'b64_json',
  };

  if (isTrace()) {
    traceBanner('GENERATE');
    console.log(`Provider: OpenAI Images API`);
    console.log(`Model: ${model}`);
    console.log(`Endpoint: ${url}`);
    console.log('Headers:', JSON.stringify({
      'Content-Type': headers['Content-Type'],
      Authorization: `Bearer ${redact(k)}`,
    }, null, 2));
    console.log('Body enviado:', JSON.stringify({ ...body, prompt: prompt.slice(0, 300) + (prompt.length > 300 ? '…' : '') }, null, 2));
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const rawText = await res.text().catch(() => '');
  if (isTrace()) traceFooter(res.status, res.statusText, rawText);

  if (!res.ok) {
    throw new Error(`openai generate: ${res.status} ${rawText.slice(0, 200)}`);
  }

  let data: { data?: Array<{ b64_json?: string; revised_prompt?: string }> };
  try { data = JSON.parse(rawText); } catch { throw new Error('openai generate: invalid JSON response'); }

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
  const model = 'gpt-image-1';
  const url = `${OPENAI_IMAGES_ENDPOINT}/edits`;

  const form = new FormData();
  form.append('model', model);
  form.append('prompt', req.prompt);
  form.append('image', `data:${req.mimeType};base64,${req.imageB64}`);
  if (req.maskB64) form.append('mask', `data:${req.mimeType};base64,${req.maskB64}`);
  form.append('n', '1');
  form.append('size', '1024x1024');

  if (isTrace()) {
    traceBanner('EDIT');
    console.log(`Provider: OpenAI Images API`);
    console.log(`Model: ${model}`);
    console.log(`Endpoint: ${url}`);
    console.log('Headers:', JSON.stringify({ Authorization: `Bearer ${redact(k)}` }, null, 2));
    console.log('Body enviado: multipart/form-data (image + prompt + n=1 + size=1024x1024)');
    console.log(`  prompt: ${req.prompt.slice(0, 200)}`);
    console.log(`  imageB64 length: ${req.imageB64.length}`);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${k}` },
    body: form,
  });

  const rawText = await res.text().catch(() => '');
  if (isTrace()) traceFooter(res.status, res.statusText, rawText);

  if (!res.ok) {
    throw new Error(`openai edit: ${res.status} ${rawText.slice(0, 200)}`);
  }

  let data: { data?: Array<{ b64_json?: string }> };
  try { data = JSON.parse(rawText); } catch { throw new Error('openai edit: invalid JSON response'); }

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
  const model = 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${k}`,
  };
  const body = {
    model,
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

  if (isTrace()) {
    traceBanner('ANALYZE (OpenAI fallback)');
    console.log(`Provider: OpenAI GPT-4o Vision`);
    console.log(`Model: ${model}`);
    console.log(`Endpoint: ${url}`);
    console.log('Headers:', JSON.stringify({
      'Content-Type': headers['Content-Type'],
      Authorization: `Bearer ${redact(k)}`,
    }, null, 2));
    console.log('Body enviado:', JSON.stringify({ ...body, messages: '[redacted — contains image b64]' }, null, 2));
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const rawText = await res.text().catch(() => '');
  if (isTrace()) traceFooter(res.status, res.statusText, rawText);

  if (!res.ok) {
    throw new Error(`openai analyze: ${res.status} ${rawText.slice(0, 200)}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try { data = JSON.parse(rawText); } catch { throw new Error('openai analyze: invalid JSON response'); }

  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('openai analyze: no text returned');

  return {
    text,
    provider: 'openai',
    costEstimate: COST_ANALYZE,
    generationMs: 0,
  };
}
