import { getEnvVar } from '@/lib/env';
import { arrayBufferToDataUrl, type ImageResult } from './types';

const HF_FLUX_ENDPOINT =
  'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell';
const HF_SDXL_ENDPOINT =
  'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0';

async function pollHFModel(
  endpoint: string,
  apiKey: string,
  prompt: string,
): Promise<ImageResult | null> {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: prompt }),
        signal: AbortSignal.timeout(45000),
      });

      const contentType = res.headers.get('content-type') ?? '';

      // Hugging Face returns the image directly as binary (no watermark)
      if (res.ok && contentType.includes('image/')) {
        const buffer = await res.arrayBuffer();
        if (buffer.byteLength > 0) {
          return {
            url: arrayBufferToDataUrl(buffer, contentType),
            provider: 'huggingface-flux',
          };
        }
      }

      // Model is loading — wait and retry
      if (res.status === 503) {
        const waitMs = attempt < maxAttempts - 1 ? 3000 * (attempt + 1) : 0;
        if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      // Non-retryable error
      break;
    } catch {
      break;
    }
  }

  return null;
}

/**
 * Level 1 image provider: Hugging Face Inference API.
 * Tries FLUX.1-schnell first, then falls back to SDXL.
 * Reads HUGGINGFACE_API_KEY or HF_TOKEN from environment.
 */
export async function tryHuggingFace(prompt: string): Promise<ImageResult | null> {
  const apiKey = getEnvVar('HUGGINGFACE_API_KEY') ?? getEnvVar('HF_TOKEN');
  if (!apiKey) return null;

  // Try FLUX.1-schnell first
  const fluxResult = await pollHFModel(HF_FLUX_ENDPOINT, apiKey, prompt);
  if (fluxResult) return fluxResult;

  // Fall back to SDXL
  const sdxlResult = await pollHFModel(HF_SDXL_ENDPOINT, apiKey, prompt);
  if (sdxlResult) return { ...sdxlResult, provider: 'huggingface-sdxl' };

  return null;
}
