import { getEnvVar } from '@/lib/env';
import { arrayBufferToDataUrl, type ImageResult } from './types';

const HF_FLUX_ENDPOINT =
  'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell';
const HF_SDXL_ENDPOINT =
  'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0';

async function callHFModel(
  endpoint: string,
  apiKey: string,
  prompt: string,
): Promise<ImageResult | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: prompt }),
        signal: AbortSignal.timeout(15000),
      });

      const contentType = res.headers.get('content-type') ?? '';

      if (res.ok && contentType.includes('image/')) {
        const buffer = await res.arrayBuffer();
        if (buffer.byteLength > 0) {
          return {
            url: arrayBufferToDataUrl(buffer, contentType),
            provider: 'huggingface-flux',
          };
        }
      }

      // Model loading (cold start) — wait 3s and retry once
      if (res.status === 503 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      break;
    } catch {
      break;
    }
  }

  return null;
}

/**
 * Priority 1: Hugging Face Inference API.
 * Tries FLUX.1-schnell (15s timeout, 1 retry on 503), then SDXL.
 * Reads HUGGINGFACE_API_KEY or HF_TOKEN from environment.
 */
export async function tryHuggingFace(prompt: string): Promise<ImageResult | null> {
  const apiKey = getEnvVar('HUGGINGFACE_API_KEY') ?? getEnvVar('HF_TOKEN');
  if (!apiKey) return null;

  const fluxResult = await callHFModel(HF_FLUX_ENDPOINT, apiKey, prompt);
  if (fluxResult) return fluxResult;

  const sdxlResult = await callHFModel(HF_SDXL_ENDPOINT, apiKey, prompt);
  if (sdxlResult) return { ...sdxlResult, provider: 'huggingface-sdxl' };

  return null;
}
