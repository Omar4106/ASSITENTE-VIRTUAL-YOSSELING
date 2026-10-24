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
