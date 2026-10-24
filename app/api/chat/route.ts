/**
 * YOSSELING AI ROUTER
 * Unified endpoint — personality, memory, multimodal, full fallback chain.
 * Fixes: OpenRouter/Cerebras headers, Gemini vision, personality injection.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  AI_SETTINGS, FALLBACK_ORDER, PROVIDER_CONFIG,
  getProviderDefaultModel, getProviderFromModel, getCodeRouteModel,
  shouldFallback, detectTaskType, TASK_ROUTING, COST_PER_1K,
  MAX_IMAGES_PER_MESSAGE, getVisionModelForProvider,
} from '@/lib/ai-config';
import { buildSystemPrompt, buildFastSystemPrompt } from '@/lib/personality';
import { getEnvVar } from '@/lib/env';
import { checkRateLimit, getClientIp, detectPromptInjection, PROMPT_INJECTION_RESPONSE, sanitizeInput } from '@/lib/security';
import type { Provider, AdaptiveProfile, TaskType } from '@/types';

export const runtime = 'nodejs';

const INSTANT_GROQ_MODEL = 'llama-3.1-8b-instant';

const MEDIA_LINK_PATTERN = /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch|shorts|embed)|youtu\.be|tiktok\.com|(vt|vm)\.tiktok\.com|instagram\.com\/(reel|p|reels|tv)|instagr\.am|reel\.instagram\.com|facebook\.com(\/share|\/watch|\/reel|\/videos)?|fb\.watch|fb\.gg|fb\.com|twitter\.com|x\.com|pinterest\.com|pin\.it|reddit\.com|redd\.it)/i;

const MEDIA_LINK_RESPONSE = 'He detectado el enlace de medios. Puedes usar los botones de la tarjeta arriba para descargar o procesar el contenido.';

function isMediaLinkOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const urlMatch = trimmed.match(/https?:\/\/\S+/);
  if (!urlMatch) return false;
  const url = urlMatch[0];
  const remaining = trimmed.replace(url, '').trim();
  return MEDIA_LINK_PATTERN.test(url) && remaining.length < 20;
}

const INTERNAL_TAG_NAMES = ['function_calls', 'invoke', 'function', 'tool_call', 'tool_result', 'tool', 'antml'];
const INTERNAL_TAG_RE = new RegExp(`<(?:${INTERNAL_TAG_NAMES.join('|')})\\b[^>]*>[\\s\\S]*?</(?:${INTERNAL_TAG_NAMES.join('|')})>`, 'gi');
const INTERNAL_TAG_SELF_RE = new RegExp(`</?(?:${INTERNAL_TAG_NAMES.join('|')})\\b[^>]*>`, 'gi');

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

function streamText(msg: string, failed = false): NextResponse {
  const enc = new TextEncoder();
  return new NextResponse(
    new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: msg } }] })}\n\n`));
        c.enqueue(enc.encode('data: [DONE]\n\n'));
        c.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', ...(failed ? { 'X-Yosseling-Failure': 'true' } : {}) } }
  );
}

// ── Internal tag filtering (streaming-safe) ────────────────────────────────

function stripInternalTags(text: string, state: { carry: string }): string {
  let combined = state.carry + text;
  state.carry = '';

  combined = combined.replace(INTERNAL_TAG_RE, '').replace(INTERNAL_TAG_SELF_RE, '');

  const lt = combined.lastIndexOf('<');
  if (lt !== -1) {
    const tail = combined.slice(lt);
    if (tail.length < 30 && !tail.includes('>')) {
      state.carry = tail;
      combined = combined.slice(0, lt);
    }
  }
  return combined;
}

function createFilteredStream(providerBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const reader = providerBody.getReader();
  const tagState = { carry: '' };
  let sseBuffer = '';

  return new ReadableStream({
    async start(ctrl) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += dec.decode(value, { stream: true });

          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) {
              ctrl.enqueue(enc.encode(line + '\n'));
              continue;
            }
            const raw = line.slice(6).trim();
            if (raw === '[DONE]' || !raw) {
              ctrl.enqueue(enc.encode(line + '\n'));
              continue;
            }
            try {
              const parsed = JSON.parse(raw);
              const content = parsed?.choices?.[0]?.delta?.content;
              if (typeof content === 'string' && content) {
                const cleaned = stripInternalTags(content, tagState);
                if (cleaned) {
                  parsed.choices[0].delta.content = cleaned;
                  ctrl.enqueue(enc.encode(`data: ${JSON.stringify(parsed)}\n`));
                }
              } else {
                ctrl.enqueue(enc.encode(line + '\n'));
              }
            } catch {
              ctrl.enqueue(enc.encode(line + '\n'));
            }
          }
        }
        if (sseBuffer.trim()) {
          ctrl.enqueue(enc.encode(sseBuffer + '\n'));
        }
        if (tagState.carry) {
          ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: tagState.carry } }] })}\n\n`));
        }
        ctrl.enqueue(enc.encode('\n'));
      } finally {
        ctrl.close();
      }
    },
  });
}

function sseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    ...extra,
  };
}

/** Convert a user message with image attachments into a multimodal content array (max 3 images) */
function buildMultimodalContent(text: string, attachments: ChatMessage['attachments']): ContentPart[] {
  const parts: ContentPart[] = [];
  let imageCount = 0;
  for (const att of attachments ?? []) {
    if (att.type.startsWith('image/') && att.dataUrl) {
      if (imageCount >= MAX_IMAGES_PER_MESSAGE) break;
      parts.push({ type: 'image_url', image_url: { url: att.dataUrl } });
      imageCount++;
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
    // Rate limiting
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(`chat:${clientIp}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Has enviado demasiados mensajes. Espera un momento e inténtalo de nuevo.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
      );
    }

    const { messages, model, provider, autoRoute, personality, memoryContext, adaptiveProfile } = await req.json();

    // Task detection — lightweight regex, no blocking I/O
    const lastUserMsgRaw = [...messages].reverse().find((m: ChatMessage) => m.role === 'user');
    const lastUserText = typeof lastUserMsgRaw?.content === 'string' ? lastUserMsgRaw.content : '';

    // Media-only link shortcut: return canned confirmation without calling any provider
    if (isMediaLinkOnly(lastUserText)) {
      return streamText(MEDIA_LINK_RESPONSE);
    }

    const detectedTask: TaskType = detectTaskType(lastUserText);
    const isSimpleChat = detectedTask === 'chat';

    // Prompt injection — quick regex check, only on last message
    const injection = detectPromptInjection(lastUserText);
    if (injection.detected) {
      return streamText(PROMPT_INJECTION_RESPONSE);
    }

    // Sanitize only for non-chat tasks; simple conversational text bypasses heavy sanitization
    const sanitizedMessages = isSimpleChat
      ? messages
      : messages.map((m: ChatMessage) => ({
          ...m,
          content: typeof m.content === 'string' ? sanitizeInput(m.content) : m.content,
        }));

    // Fast path: minimal system prompt for simple chat (≈80 tokens vs ≈2000)
    const systemPrompt = isSimpleChat
      ? buildFastSystemPrompt(personality ?? 'amigable', memoryContext)
      : buildSystemPrompt(
          personality ?? 'amigable',
          memoryContext,
          adaptiveProfile as AdaptiveProfile | undefined,
        );

    const apiMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...sanitizedMessages,
    ];

    // Determine provider chain
    let chain: Exclude<Provider, 'auto'>[];
    if (autoRoute || !provider || provider === 'auto') {
      const preferredProvider = TASK_ROUTING[detectedTask] as Exclude<Provider, 'auto'>;
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
      console.error('[Yosseling] No AI provider keys are configured in the production environment');
      return streamText('No hay proveedores de IA configurados en el entorno de producción. Añade al menos una clave API en la configuración de variables de entorno del despliegue.', true);
    }

    const triedProviders: string[] = [];
    const failureReasons: string[] = [];
    let fallbackUsed = false;

    // Detect if any message contains image attachments
    const hasImages = sanitizedMessages.some((m: ChatMessage) =>
      m.attachments?.some(a => a.type.startsWith('image/') && a.dataUrl)
    );

    for (const currentProvider of available) {
      let currentModel = model && getProviderFromModel(model) === currentProvider
        ? model
        : detectedTask === 'code'
          ? getCodeRouteModel(currentProvider)
          : isSimpleChat && currentProvider === 'groq'
            ? INSTANT_GROQ_MODEL
            : getProviderDefaultModel(currentProvider);

      // Route vision/OCR/analyze tasks OR any message with image attachments to a vision model
      if ((detectedTask === 'image_read' || detectedTask === 'ocr' || detectedTask === 'analyze' || hasImages) && currentProvider === 'groq') {
        currentModel = getVisionModelForProvider(currentProvider);
      }

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

        const filteredBody = createFilteredStream(response.body!);
        return new NextResponse(filteredBody, {
          headers: sseHeaders({
            'X-Provider': currentProvider,
            'X-Model': currentModel,
            'X-Response-Time': String(responseTime),
            'X-Fallback-Used': fallbackUsed ? 'true' : 'false',
            'X-Tried-Providers': triedProviders.join(','),
            'X-Cost-Per-1K': String(COST_PER_1K[currentProvider] ?? 0),
          }),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Yosseling] ${currentProvider} failed:`, msg);
        triedProviders.push(currentProvider);
        failureReasons.push(`${currentProvider}: ${msg.slice(0, 180)}`);
        fallbackUsed = true;

        if (!shouldFallback(msg)) {
          return streamText('La conexión con el proveedor seleccionado no está disponible.');
        }
        // Continue to next provider
      }
    }

    console.error('[Yosseling] All configured providers failed:', failureReasons.join(' | '));
    return streamText('Los proveedores configurados no pudieron responder. Verifica que las claves API estén vigentes y que el modelo seleccionado siga disponible.', true);
  } catch (err) {
    console.error('[Yosseling] Router unexpected error:', err);
    return streamText('Ocurrió un error inesperado. Por favor intenta de nuevo.', true);
  }
}
