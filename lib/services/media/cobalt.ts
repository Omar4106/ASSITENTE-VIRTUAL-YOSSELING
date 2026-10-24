import { getEnvVar } from '@/lib/env';
import { apiHeaders, type ExtractResult, type MediaFormat } from './types';

const COBALT_INSTANCES = [
  'https://api.cobalt.tools/api/json',
  'https://co.wuk.sh/api/json',
  'https://cobalt-api.kwippy.com/api/json',
];

interface CobaltResponse {
  status: string;
  error?: { code: string };
  url?: string;
  audio?: string;
  filename?: string;
  audioFilename?: string;
}

function buildCobaltBody(url: string, format: MediaFormat): Record<string, unknown> {
  const body: Record<string, unknown> = { url, videoQuality: '720', downloadMode: 'auto' };
  if (format === 'mp3') {
    body.audioFormat = 'mp3';
    body.isAudioOnly = true;
  }
  return body;
}

function parseCobaltData(data: CobaltResponse, format: MediaFormat): ExtractResult | null {
  if (data.status === 'error') return null;
  const directUrl = format === 'mp3' ? (data.audio ?? data.url) : data.url;
  if (!directUrl) return null;
  const filename =
    format === 'mp3'
      ? (data.audioFilename ?? `yosseling_audio_${Date.now()}.mp3`)
      : (data.filename ?? `yosseling_video_${Date.now()}.mp4`);
  return { directUrl, filename };
}

/**
 * Tries each Cobalt instance in order.
 * If COBALT_API_KEY is configured it's sent as `Authorization: ApiKey <key>`.
 * If no key is present, public mirrors are used without interruption.
 */
export async function tryCobaltInstances(
  url: string,
  format: MediaFormat,
): Promise<ExtractResult | null> {
  const cobaltKey = getEnvVar('COBALT_API_KEY');
  const body = buildCobaltBody(url, format);

  for (const endpoint of COBALT_INSTANCES) {
    try {
      const headers = apiHeaders();
      if (cobaltKey) headers['Authorization'] = `ApiKey ${cobaltKey}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        console.error(`[Download] Cobalt ${endpoint} returned ${res.status}`);
        continue;
      }

      const data = (await res.json()) as CobaltResponse;
      const result = parseCobaltData(data, format);

      if (result) {
        console.log(`[Download] Cobalt ${endpoint} succeeded`);
        return result;
      }
      console.error(`[Download] Cobalt ${endpoint} returned status=${data.status}`);
    } catch (err) {
      console.error(
        `[Download] Cobalt ${endpoint} failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return null;
}
