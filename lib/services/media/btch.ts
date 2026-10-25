import type { ExtractResult, MediaFormat } from './types';

type Platform = 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'facebook' | 'unknown';

function detectPlatform(url: string): Platform {
  if (/youtu\.be|youtube\.com/i.test(url)) return 'youtube';
  if (/instagram\.com|instagr\.am/i.test(url)) return 'instagram';
  if (/tiktok\.com/i.test(url)) return 'tiktok';
  if (/twitter\.com|x\.com/i.test(url)) return 'twitter';
  if (/facebook\.com|fb\.watch|fb\.gg|fb\.com/i.test(url)) return 'facebook';
  return 'unknown';
}

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
  }
  return typeof data === 'object' ? (data as Record<string, unknown>) : null;
}

function httpUrl(value: unknown): string | null {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null;
}

function filenameFor(format: MediaFormat, title?: string): string {
  const safe = (title ?? 'media')
    .replace(/[^\w\s\-àáäâèéëêìíïîòóöôùúüûñç]/gi, '')
    .trim()
    .slice(0, 48)
    .replace(/\s+/g, '_') || 'yosseling';
  return `yosseling_${safe}_${Date.now()}.${format}`;
}

function collectHttpUrls(payload: unknown, depth = 0): string[] {
  if (depth > 5 || payload == null) return [];
  if (typeof payload === 'string') {
    return /^https?:\/\//i.test(payload) ? [payload] : [];
  }
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => collectHttpUrls(item, depth + 1));
  }
  if (typeof payload === 'object') {
    return Object.values(payload as Record<string, unknown>).flatMap((v) =>
      collectHttpUrls(v, depth + 1),
    );
  }
  return [];
}

function pickMediaUrl(data: unknown, format: MediaFormat): string | null {
  const record = asRecord(data);
  if (record) {
    if (format === 'mp3') {
      const audio =
        httpUrl(record.mp3) ??
        httpUrl(record.audio) ??
        httpUrl(record.music) ??
        httpUrl(record.sound) ??
        httpUrl(record.audioUrl);
      if (audio) return audio;
    } else {
      const video =
        httpUrl(record.mp4) ??
        httpUrl(record.hd) ??
        httpUrl(record.sd) ??
        httpUrl(record.nowm) ??
        httpUrl(record.wm) ??
        httpUrl(record.video) ??
        httpUrl(record.url) ??
        httpUrl(record.link);
      if (video) return video;
    }
  }

  const urls = collectHttpUrls(data);
  if (format === 'mp3') {
    return (
      urls.find((u) => /\.(mp3|m4a|aac)(\?|$)/i.test(u) || /[?&]mime=audio/i.test(u) || /\/audio/i.test(u)) ??
      null
    );
  }
  return (
    urls.find((u) => /\.mp4(\?|$)/i.test(u) || /[?&]mime=video/i.test(u)) ??
    urls.find((u) => !/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u)) ??
    null
  );
}

/**
 * Extracts direct MP4/MP3 URLs via btch-downloader for
 * YouTube, Instagram, TikTok, Twitter/X and Facebook.
 */
export async function tryBtchDownloader(
  url: string,
  format: MediaFormat,
): Promise<ExtractResult | null> {
  const platform = detectPlatform(url);
  if (platform === 'unknown') return null;

  try {
    const btch = await import('btch-downloader');
    let data: unknown;

    switch (platform) {
      case 'youtube':
        data = await btch.youtube(url);
        break;
      case 'instagram':
        data = await btch.igdl(url);
        break;
      case 'tiktok':
        data = await btch.ttdl(url);
        break;
      case 'twitter':
        data = await btch.twitter(url);
        break;
      case 'facebook':
        data = await btch.fbdown(url);
        break;
    }

    const mediaUrl = pickMediaUrl(data, format);
    if (!mediaUrl) return null;

    const record = asRecord(data);
    const title = typeof record?.title === 'string' ? record.title : undefined;
    return { directUrl: mediaUrl, filename: filenameFor(format, title) };
  } catch (err) {
    console.error(
      '[Download] btch-downloader failed:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
