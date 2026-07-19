/**
 * YOSSELING AI ROUTER
 * Unified endpoint — personality, memory, multimodal, full fallback chain.
 * Fixes: OpenRouter/Cerebras headers, Gemini vision, personality injection.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  AI_SETTINGS, FALLBACK_ORDER, PROVIDER_CONFIG,
  getProviderDefaultModel, getProviderFromModel,
  shouldFallback, detectTaskType, TASK_ROUTING, COST_PER_1K,
} from '@/lib/ai-config';
import { buildSystemPrompt } from '@/lib/personality';
import { getEnvVar } from '@/lib/env';
import { realtimeService } from '@/src/services/realtime';
import type { Provider } from '@/types';

export const runtime = 'nodejs';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
  attachments?: { name: string; type: string; dataUrl?: string; content?: string }[];
}

interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function streamText(msg: string): NextResponse {
  const enc = new TextEncoder();
  return new NextResponse(
    new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: msg } }] })}\n\n`));
        c.enqueue(enc.encode('data: [DONE]\n\n'));
        c.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
  );
}

function sseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    ...extra,
  };
}

/** Convert a user message with image attachments into a multimodal content array */
function buildMultimodalContent(text: string, attachments: ChatMessage['attachments']): ContentPart[] {
  const parts: ContentPart[] = [];
  for (const att of attachments ?? []) {
    if (att.type.startsWith('image/') && att.dataUrl) {
      parts.push({ type: 'image_url', image_url: { url: att.dataUrl } });
    } else if (att.content) {
      parts.push({ type: 'text', text: `[Archivo: ${att.name}]\n${att.content}` });
    }
  }
  if (text) parts.push({ type: 'text', text });
  return parts;
}

// ── Provider callers ───────────────────────────────────────────────────────

async function callOpenAICompatible(
  provider: Exclude<Provider, 'auto'>,
  model: string,
  messages: ChatMessage[]
): Promise<Response> {
  const cfg = PROVIDER_CONFIG[provider];
  const apiKey = getEnvVar(cfg.envKey);
  if (!apiKey) throw new Error(`${cfg.envKey} not configured`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  // OpenRouter requires these headers (without them it rejects requests)
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://yosseling.ai';
    headers['X-Title'] = 'Yosseling';
  }

  // Build messages array — support multimodal for vision-capable providers
  const apiMessages = messages.map(m => {
    if (m.role !== 'user' || !m.attachments?.length) {
      return { role: m.role, content: typeof m.content === 'string' ? m.content : m.content };
    }
    const hasImages = m.attachments.some(a => a.type.startsWith('image/') && a.dataUrl);
    if (!hasImages) return { role: m.role, content: m.content };
    return {
      role: m.role,
      content: buildMultimodalContent(typeof m.content === 'string' ? m.content : '', m.attachments),
    };
  });

  const res = await fetch(`${cfg.apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: apiMessages,
      stream: true,
      temperature: AI_SETTINGS.temperature,
      max_tokens: AI_SETTINGS.maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${provider}: ${res.status} ${err.slice(0, 200)}`);
  }
  return res;
}

async function callGemini(model: string, messages: ChatMessage[]): Promise<Response> {
  const apiKey = getEnvVar('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const systemMsg = messages.find(m => m.role === 'system');
  const conversationMsgs = messages.filter(m => m.role !== 'system');

  // Build Gemini contents with multimodal support
  const contents = conversationMsgs.map(m => {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const textContent = typeof m.content === 'string' ? m.content : '';

    // Check for image attachments
    const imgAttachments = m.attachments?.filter(a => a.type.startsWith('image/') && a.dataUrl) ?? [];
    const docAttachments = m.attachments?.filter(a => !a.type.startsWith('image/') && a.content) ?? [];

    if (imgAttachments.length === 0 && docAttachments.length === 0) {
      return { role, parts: [{ text: textContent }] };
    }

    const parts: Record<string, unknown>[] = [];
    for (const img of imgAttachments) {
      // Extract base64 from data URL
      const [meta, b64] = (img.dataUrl ?? '').split(',');
      const mimeType = meta.match(/data:([^;]+)/)?.[1] ?? img.type;
      parts.push({ inlineData: { mimeType, data: b64 } });
    }
    for (const doc of docAttachments) {
      parts.push({ text: `[Archivo: ${doc.name}]\n${doc.content}` });
    }
    if (textContent) parts.push({ text: textContent });
    return { role, parts };
  });

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: AI_SETTINGS.temperature,
      maxOutputTokens: AI_SETTINGS.maxTokens,
    },
  };
  if (systemMsg) {
    body.system_instruction = { parts: [{ text: typeof systemMsg.content === 'string' ? systemMsg.content : '' }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`gemini: ${res.status} ${err.slice(0, 200)}`);
  }

  return wrapGeminiStream(res);
}

function wrapGeminiStream(geminiRes: Response): Response {
  const enc = new TextEncoder();
  const reader = geminiRes.body!.getReader();

  return new Response(
    new ReadableStream({
      async start(ctrl) {
        const dec = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = dec.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice(6).trim();
              if (raw === '[DONE]' || !raw) continue;
              try {
                const p = JSON.parse(raw);
                const text = p.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                if (text) {
                  ctrl.enqueue(enc.encode(
                    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`
                  ));
                }
              } catch { /* skip */ }
            }
          }
          ctrl.enqueue(enc.encode('data: [DONE]\n\n'));
        } finally {
          ctrl.close();
        }
      },
    })
  );
}

// ── Main router ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages, model, provider, autoRoute, personality, memoryContext } = await req.json();

    // Build system prompt with Yosseling personality + memory
    const systemPrompt = buildSystemPrompt(personality ?? 'amigable', memoryContext);
    const lastUserMsg = [...messages].reverse().find((m: ChatMessage) => m.role === 'user');
    const lastUserText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';

    // Realtime Service — the AI Router never contacts the internet directly.
    // If the user's message needs fresh information, fetch it here and inject
    // the sanitized context into the system prompt.
    let realtimeContext: Awaited<ReturnType<typeof realtimeService.fetch>> = null;
    try {
      realtimeContext = await realtimeService.fetch(lastUserText);
    } catch (e) {
      console.warn('[Yosseling] Realtime fetch failed (non-fatal):', e);
    }

    if (realtimeContext?.prompt) {
      console.log(`[Yosseling] Realtime context injected — domain=${realtimeContext.detectedDomain} sources=${realtimeContext.results.reduce((n, r) => n + r.sources.length, 0)} promptLen=${realtimeContext.prompt.length}`);
    } else {
      console.log('[Yosseling] No realtime context injected');
    }

    const finalSystemPrompt = realtimeContext?.prompt
      ? `${systemPrompt}\n\n${realtimeContext.prompt}`
      : systemPrompt;

    // Build final messages with system prepended
    const apiMessages: ChatMessage[] = [
      { role: 'system', content: finalSystemPrompt },
      ...messages,
    ];

    // Determine provider chain
    let chain: Exclude<Provider, 'auto'>[];
    if (autoRoute || !provider || provider === 'auto') {
      const taskType = detectTaskType(lastUserText);
      const preferredProvider = TASK_ROUTING[taskType] as Exclude<Provider, 'auto'>;
      chain = [preferredProvider, ...FALLBACK_ORDER.filter(p => p !== preferredProvider)] as Exclude<Provider, 'auto'>[];
    } else {
      chain = [provider as Exclude<Provider, 'auto'>, ...FALLBACK_ORDER.filter(p => p !== provider)] as Exclude<Provider, 'auto'>[];
    }

    // Filter to only providers with keys configured
    const available = chain.filter(p => {
      const key = PROVIDER_CONFIG[p]?.envKey;
      return key && getEnvVar(key);
    });

    if (available.length === 0) {
      return streamText('No hay ningún proveedor de IA configurado. Por favor agrega al menos una API key en el archivo .env (GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, CEREBRAS_API_KEY, u OPENAI_API_KEY).');
    }

    const triedProviders: string[] = [];
    let fallbackUsed = false;

    for (const currentProvider of available) {
      const currentModel = model && getProviderFromModel(model) === currentProvider
        ? model
        : getProviderDefaultModel(currentProvider);

      const startTime = Date.now();
      console.log(`[Yosseling] Trying ${currentProvider} / ${currentModel}...`);

      try {
        let response: Response;
        if (currentProvider === 'gemini') {
          response = await callGemini(currentModel, apiMessages);
        } else {
          response = await callOpenAICompatible(currentProvider, currentModel, apiMessages);
        }

        const responseTime = Date.now() - startTime;
        console.log(`[Yosseling] ${currentProvider} OK in ${responseTime}ms`);

        return new NextResponse(response.body, {
          headers: sseHeaders({
            'X-Provider': currentProvider,
            'X-Model': currentModel,
            'X-Response-Time': String(responseTime),
            'X-Fallback-Used': fallbackUsed ? 'true' : 'false',
            'X-Tried-Providers': triedProviders.join(','),
            'X-Cost-Per-1K': String(COST_PER_1K[currentProvider] ?? 0),
            'X-Realtime-Used': realtimeContext ? 'true' : 'false',
            'X-Realtime-Domain': realtimeContext?.detectedDomain ?? '',
          }),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Yosseling] ${currentProvider} failed:`, msg);
        triedProviders.push(currentProvider);
        fallbackUsed = true;

        if (!shouldFallback(msg)) {
          // Auth error — show message, don't continue
          return streamText('La API key no es válida. Verifica tu configuración en el archivo .env.');
        }
        // Continue to next provider
      }
    }

    return streamText('Todos los proveedores de IA están temporalmente no disponibles. Por favor intenta de nuevo en unos momentos.');
  } catch (err) {
    console.error('[Yosseling] Router unexpected error:', err);
    return streamText('Ocurrió un error inesperado. Por favor intenta de nuevo.');
  }
}
