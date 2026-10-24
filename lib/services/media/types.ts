export interface ExtractResult {
  directUrl: string;
  filename: string;
}

export type MediaFormat = 'mp4' | 'mp3';

export const BROWSER_UA_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
export const BROWSER_UA_MOBILE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

export function apiHeaders(): Record<string, string> {
  const ua = Math.random() > 0.5 ? BROWSER_UA_DESKTOP : BROWSER_UA_MOBILE;
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': ua,
    'Origin': 'https://yosseling.ai',
    'Referer': 'https://yosseling.ai/',
  };
}
