import { getEnvVar } from '@/lib/env';
import { type ImageResult } from './types';

const AI_HORDE_ASYNC = 'https://aihorde.net/api/v2/generate/async';
const AI_HORDE_STATUS = 'https://aihorde.net/api/v2/generate/status';

interface HordeSubmitResponse {
  id?: string;
  message?: string;
}

interface HordeStatusResponse {
  done?: boolean;
  faulted?: boolean;
  generations?: Array<{ img?: string; worker_name?: string }>;
}

async function pollHordeStatus(
  jobId: string,
  apiKey: string,
): Promise<ImageResult | null> {
  const maxAttempts = 30;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));

    try {
      const res = await fetch(`${AI_HORDE_STATUS}/${jobId}`, {
        headers: { 'apikey': apiKey },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;

      const data = (await res.json()) as HordeStatusResponse;

      if (data.faulted) return null;

      if (data.done && data.generations?.length) {
        const gen = data.generations[0];
        if (gen.img) {
          // AI Horde returns either a URL or a base64 string
          if (gen.img.startsWith('http')) {
            return { url: gen.img, provider: 'aihorde' };
          }
          return {
            url: `data:image/png;base64,${gen.img}`,
            provider: 'aihorde',
          };
        }
      }
    } catch {
      // Continue polling on network errors
    }
  }

  return null;
}

/**
 * Level 2 image provider: AI Horde.
 * Uses AI_HORDE_API_KEY if configured, or anonymous key '0000000000'.
 * Submits an async generation request and polls until complete.
 */
export async function tryAIHorde(prompt: string): Promise<ImageResult | null> {
  const apiKey = getEnvVar('AI_HORDE_API_KEY') ?? '0000000000';

  try {
    const submitRes = await fetch(AI_HORDE_ASYNC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        prompt,
        params: {
          width: 1024,
          height: 1024,
          steps: 30,
          cfg_scale: 7,
          sampler_name: 'k_euler',
          n: 1,
        },
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!submitRes.ok) return null;

    const submitData = (await submitRes.json()) as HordeSubmitResponse;
    if (!submitData.id) return null;

    return pollHordeStatus(submitData.id, apiKey);
  } catch {
    return null;
  }
}
