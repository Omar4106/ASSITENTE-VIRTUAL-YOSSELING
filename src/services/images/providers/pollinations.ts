/**
 * Pollinations.ai image provider — FREE, no API key required.
 *
 * Uses the public Pollinations Flux model endpoint:
 *   https://image.pollinations.ai/prompt/{prompt}?width=...&height=...&seed=...&nologo=true&model=flux
 *
 * The endpoint returns a raw image binary (image/jpeg), which we convert to
 * base64 so it matches the same GeneratedImage contract used by the OpenAI
 * provider.
 *
 * This provider is used as a fallback when OPENAI_API_KEY is not configured,
 * so Yosseling can always generate images even without any paid API keys.
 */
import type { GenerateImageRequest, GeneratedImage } from '../types';

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

const STYLE_HINTS: Record<string, string> = {
  realista: 'photorealistic, highly detailed, 8k',
  anime: 'anime style, vibrant colors, detailed',
  disney: 'Disney Pixar style, 3D animation, cute',
  'pixel-art': 'pixel art, 16-bit retro game style',
  cyberpunk: 'cyberpunk style, neon lights, futuristic',
  futurista: 'futuristic, sci-fi, sleek design',
  minimalista: 'minimalist, clean, simple',
  fotografia: 'professional photography, high resolution',
  arquitectura: 'architectural rendering, detailed',
  logo: 'logo design, vector, clean, minimal',
  vector: 'vector art, flat design, clean lines',
  '3d': '3D render, octane, highly detailed',
  'concept-art': 'concept art, digital painting, dramatic',
};

function sizeToDimensions(size?: string): { width: number; height: number } {
  switch (size) {
    case '1024x1536': return { width: 1024, height: 1536 };
    case '1536x1024': return { width: 1536, height: 1024 };
    default: return { width: 1024, height: 1024 };
  }
}

export async function generateWithPollinations(req: GenerateImageRequest): Promise<GeneratedImage> {
  const prompt = req.enhancedPrompt ?? req.prompt;
  const styleHint = req.style ? STYLE_HINTS[req.style] ?? '' : '';
  const fullPrompt = styleHint ? `${prompt}. ${styleHint}` : prompt;

  const { width, height } = sizeToDimensions(req.size);
  const seed = Math.floor(Math.random() * 1_000_000);
  const encoded = encodeURIComponent(fullPrompt.slice(0, 2000));

  const model = req.style === 'realista' || req.style === 'fotografia' ? 'flux-realism' : 'flux';
  const url = `${POLLINATIONS_BASE}/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=${model}&enhance=true`;

  console.log('[Image Router] Pollinations URL:', url.slice(0, 120) + '...');

  const start = Date.now();
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'image/jpeg,image/png,*/*' },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`pollinations generate: ${res.status} ${errText.slice(0, 200)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const b64 = buffer.toString('base64');

  if (!b64 || b64.length < 100) {
    throw new Error('pollinations generate: empty or invalid image returned');
  }

  const generationMs = Date.now() - start;
  console.log(`[Image Router] Pollinations OK in ${generationMs}ms, image size: ${(b64.length / 1024).toFixed(0)}KB`);

  return {
    b64,
    mimeType: 'image/jpeg',
    revisedPrompt: fullPrompt,
    provider: 'pollinations',
    costEstimate: 0,
    generationMs,
  };
}
