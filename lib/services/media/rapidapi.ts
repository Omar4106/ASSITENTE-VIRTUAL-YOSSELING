import { getEnvVar } from '@/lib/env';
import { apiHeaders, type ExtractResult, type MediaFormat } from './types';

const RAPIDAPI_ENDPOINT =
  'https://ytstream-download-and-search.p.rapidapi.com/api/ytdl/v1/download';
const RAPIDAPI_HOST = 'ytstream-download-and-search.p.rapidapi.com';

interface RapidApiResponse {
  url?: string;
  download_url?: string;
  title?: string;
}

/**
 * Attempts extraction via RapidAPI.
 * Returns null on any failure so the caller can fall through to Cobalt mirrors.
 */
export async function tryRapidApi(
  url: string,
  format: MediaFormat,
): Promise<ExtractResult | null> {
  const rapidKey = getEnvVar('RAPIDAPI_KEY');
  if (!rapidKey) return null;

  try {
    const res = await fetch(
      `${RAPIDAPI_ENDPOINT}?url=${encodeURIComponent(url)}`,
      {
        method: 'GET',
        headers: {
          ...apiHeaders(),
          'X-RapidAPI-Key': rapidKey,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
        signal: AbortSignal.timeout(20000),
      },
    );

    if (!res.ok) {
      console.error(`[Download] RapidAPI returned ${res.status}`);
      return null;
    }

    const data = (await res.json()) as RapidApiResponse;
    const directUrl = data.download_url ?? data.url;

    if (!directUrl) return null;

    const filename =
      format === 'mp3'
        ? `yosseling_audio_${Date.now()}.mp3`
        : `yosseling_video_${Date.now()}.mp4`;

    console.log('[Download] RapidAPI succeeded');
    return { directUrl, filename };
  } catch (err) {
    console.error(
      '[Download] RapidAPI failed:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
