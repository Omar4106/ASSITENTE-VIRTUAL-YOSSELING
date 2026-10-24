export interface ImageResult {
  url: string;
  provider: string;
}

export type ImageFormat = 'png' | 'jpeg' | 'webp';

export function arrayBufferToDataUrl(
  buffer: ArrayBuffer,
  mimeType = 'image/png',
): string {
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

export function enhancePrompt(userPrompt: string): string {
  return `${userPrompt}, hyperrealistic, 8k resolution, detailed, vivid colors, photorealistic, sharp focus, professional photography, clean composition`;
}

/**
 * Level 3 guaranteed public fallback: Pollinations AI.
 * Always returns a usable URL — no API key required.
 */
export function tryPollinations(prompt: string): string {
  const seed = Math.floor(Math.random() * 1000000);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&nologo=true&nofeed=true&model=flux`;
}

/**
 * Runs a promise with a timeout. Returns null if the timeout fires first.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | null> {
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  } catch {
    return null;
  }
}
