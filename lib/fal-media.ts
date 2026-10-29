import { createFalClient } from '@fal-ai/client';
import { getEnvVar } from '@/lib/env';

const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;

export function createServerFalClient() {
  const credentials =
    getEnvVar('FAL_KEY') ??
    getEnvVar('FAL_API_KEY') ??
    getEnvVar('AI_HORDE_API_KEY');
  return credentials ? createFalClient({ credentials }) : null;
}

export function parseImageDataUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) return null;

  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_SOURCE_IMAGE_BYTES) return null;

  const mimeType = match[1].toLowerCase();
  const isPng = mimeType === 'png'
    && bytes.length >= 8
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = mimeType === 'jpeg'
    && bytes.length >= 3
    && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = mimeType === 'webp'
    && bytes.length >= 12
    && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP';

  return isPng || isJpeg || isWebp ? value : null;
}

export function validateFalMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const isFalHost = url.hostname === 'fal.media' || url.hostname.endsWith('.fal.media');
    const isGoogleStorage = url.hostname === 'storage.googleapis.com';
    return url.protocol === 'https:' && (isFalHost || isGoogleStorage) ? url.toString() : null;
  } catch {
    return null;
  }
}
