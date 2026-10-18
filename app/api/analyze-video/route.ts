import { NextRequest, NextResponse } from 'next/server';
import { getEnvVar } from '@/lib/env';
import { checkRateLimit, getClientIp, sanitizeInput } from '@/lib/security';
import { VISION_MODEL, STT_MODEL } from '@/lib/ai-config';

export const runtime = 'nodejs';

const COBALT_INSTANCES = [
  'https://api.cobalt.tools/api/json',
  'https://cobalt-api.kwippy.com/api/json',
  'https://co.wuk.sh/api/json',
];

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const API_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': BROWSER_UA,
  'Origin': 'https://yosseling.ai',
  'Referer': 'https://yosseling.ai/',
};

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_UA,
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Supports TikTok, Instagram, Facebook, and YouTube (watch, shorts, youtu.be)
const SOCIAL_URL_PATTERN = /^https?:\/\/(www\.)?(m\.)?(vt\.tiktok\.com|vm\.tiktok\.com|tiktok\.com|instagram\.com\/(reel|p|reels|tv)\/|instagr\.am|reel\.instagram\.com|facebook\.com(\/share\/(v|r|reel)\/|\/share|\/watch|\/reel\/|\/videos\/)?|fb\.watch|fb\.gg|fb\.com|youtu\.be|youtube\.com\/(watch|shorts|embed))/i;

const SHORTENER_DOMAINS = /vt\.tiktok\.com|vm\.tiktok\.com|instagr\.am|fb\.watch|fb\.gg|youtu\.be|facebook\.com\/share/i;

interface CobaltResponse {
  status: string;
  error?: { code: string };
  url?: string;
  filename?: string;
}

function stripTrackingParams(url: string): string {
  try {
    const parsed = new URL(url);
    const trackingParams = ['fbclid', 'gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'igshid', 'ref', 'si', 'feature'];
    trackingParams.forEach(p => parsed.searchParams.delete(p));
    if (parsed.searchParams.toString() === '') {
      return parsed.origin + parsed.pathname + parsed.hash;
    }
    return parsed.origin + parsed.pathname + '?' + parsed.searchParams.toString() + parsed.hash;
  } catch {
    const qIdx = url.indexOf('?');
    if (qIdx === -1) return url;
    return url.slice(0, qIdx);
  }
}

async function resolveShortenedUrl(url: string): Promise<string> {
  if (!SHORTENER_DOMAINS.test(url)) return url;
  let current = url;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: { ...FETCH_HEADERS, 'Sec-Fetch-Mode': 'navigate' },
        signal: AbortSignal.timeout(8000),
      });
      const location = res.headers.get('location');
      if (location) {
        current = location.startsWith('http') ? location : new URL(location, current).href;
        if (SOCIAL_URL_PATTERN.test(stripTrackingParams(current))) {
          return stripTrackingParams(current);
        }
        continue;
      }
      break;
    } catch {
      break;
    }
  }
  return stripTrackingParams(current);
}

async function extractVideoUrl(url: string): Promise<string | null> {
  const cobaltBody = { url, videoQuality: '720', downloadMode: 'auto' };

  for (const endpoint of COBALT_INSTANCES) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(cobaltBody),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        console.error(`[Analyze] Cobalt ${endpoint} returned ${res.status}`);
        continue;
      }

      const data = await res.json() as CobaltResponse;
      if (data.status === 'error' || !data.url) {
        console.error(`[Analyze] Cobalt ${endpoint} status=${data.status}`);
        continue;
      }

      console.log(`[Analyze] Cobalt ${endpoint} succeeded`);
      return data.url;
    } catch (err) {
      console.error(`[Analyze] Cobalt ${endpoint} failed:`, err instanceof Error ? err.message : String(err));
    }
  }
  return null;
}

async function fetchVideoBuffer(videoUrl: string): Promise<ArrayBuffer | null> {
  try {
    const videoRes = await fetch(videoUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(60000),
    });
    if (!videoRes.ok) return null;
    return await videoRes.arrayBuffer();
  } catch (err) {
    console.error('[Analyze] Video fetch failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function transcribeAudio(videoBuffer: ArrayBuffer, groqKey: string): Promise<string> {
  try {
    const audioBlob = new Blob([videoBuffer], { type: 'video/mp4' });
    const formData = new FormData();
    formData.append('file', audioBlob, 'video.mp4');
    formData.append('model', STT_MODEL);
    formData.append('language', 'es');

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqKey}` },
      body: formData,
      signal: AbortSignal.timeout(60000),
    });
    if (!whisperRes.ok) return '';
    const whisperData = await whisperRes.json() as { text?: string };
    return whisperData.text ?? '';
  } catch (err) {
    console.error('[Analyze] Transcription failed:', err instanceof Error ? err.message : String(err));
    return '';
  }
}

async function analyzeWithVision(question: string, transcription: string, groqKey: string): Promise<string> {
  try {
    const prompt = `Eres Yosseling. ${question}\n\nTranscripción del audio del video: "${transcription.slice(0, 2000)}"\n\nAnaliza el video basándote en la transcripción del audio. Describe qué está sucediendo, el contexto, las personas y los elementos principales. Responde en español.`;

    const visionRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        max_tokens: 2048,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!visionRes.ok) return '';
    const visionData = await visionRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    return visionData.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    console.error('[Analyze] Vision analysis failed:', err instanceof Error ? err.message : String(err));
    return '';
  }
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`analyze-video:${clientIp}`, 5);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Has analizado demasiados videos. Espera un momento.' },
      { status: 429 },
    );
  }

  let url: string;
  let question: string;
  try {
    const body = await req.json();
    url = typeof body.url === 'string' ? body.url : '';
    question = typeof body.question === 'string' ? body.question : 'Analiza este video: describe qué está sucediendo, el contexto, las personas y los elementos principales.';
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  url = sanitizeInput(url).trim();
  if (!url || !SOCIAL_URL_PATTERN.test(url)) {
    return NextResponse.json({ error: 'Enlace no válido. Solo se admiten enlaces públicos de TikTok, Instagram, Facebook y YouTube.' }, { status: 400 });
  }

  try {
    const cleanedUrl = stripTrackingParams(url);
    const resolvedUrl = await resolveShortenedUrl(cleanedUrl);

    // Step 1: Extract direct video URL via Cobalt (with mirror fallbacks)
    const videoUrl = await extractVideoUrl(resolvedUrl);
    if (!videoUrl) {
      return NextResponse.json(
        { error: 'No pude procesar este enlace. Asegúrate de que la publicación sea pública e inténtalo de nuevo.' },
        { status: 422 },
      );
    }

    // Step 2: Download the video buffer
    const videoBuffer = await fetchVideoBuffer(videoUrl);
    if (!videoBuffer) {
      return NextResponse.json({ error: 'No pude descargar el video para analizarlo.' }, { status: 502 });
    }

    const groqKey = getEnvVar('GROQ_API_KEY');

    // Step 3: Transcribe audio via Whisper
    let transcription = '';
    if (groqKey) {
      transcription = await transcribeAudio(videoBuffer, groqKey);
    }

    // Step 4: Analyze with vision model
    let visualAnalysis = '';
    if (groqKey) {
      visualAnalysis = await analyzeWithVision(question, transcription, groqKey);
    }

    // Fallback: transcription-only summary
    if (!visualAnalysis && transcription) {
      visualAnalysis = `Basándome en la transcripción del audio del video, esto es lo que pude determinar:\n\n${transcription}`;
    }

    if (!visualAnalysis) {
      return NextResponse.json(
        { error: 'No pude analizar este video. Es posible que el contenido no esté disponible o que la publicación sea privada.' },
        { status: 422 },
      );
    }

    return NextResponse.json({
      analysis: visualAnalysis,
      transcription: transcription.slice(0, 500),
    }, { status: 200 });
  } catch (err) {
    console.error('[Yosseling Video Analysis] Unexpected error:', err);
    return NextResponse.json(
      { error: 'No pude procesar este enlace. Asegúrate de que la publicación sea pública e inténtalo de nuevo.' },
      { status: 500 },
    );
  }
}
