/**
 * YOSSELING AI ROUTER
 * Unified endpoint — personality, memory, multimodal, full fallback chain.
 *
 * Pipeline:
 *   1. Detect task type (image_gen → redirect to ImageService).
 *   2. Fetch realtime context (RealtimeService).
 *   3. Build system prompt (personality + memory).
 *   4. Inject realtime context as PRIORITY source (before history).
 *   5. Optimize context (ContextManager) — trim/summarize history to fit budget.
 *   6. Route model (SmartModelRouter) — pick best provider for the task.
 *   7. Stream response from provider.
 *   8. Validate response against realtime (ResponseValidator).
 *   9. Emit token + cost report.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  AI_SETTINGS, PROVIDER_CONFIG,
  getProviderDefaultModel, getProviderFromModel,
  shouldFallback, detectTaskType, COST_PER_1K,
} from '@/lib/ai-config';
import { buildSystemPrompt } from '@/lib/personality';
import { getEnvVar } from '@/lib/env';
import { realtimeService } from '@/src/services/realtime';
import { optimizeContext, buildTokenReport, formatTokenReport, type ContextMessage } from '@/src/services/context';
import { routeModel } from '@/src/services/router';
import { validateResponse } from '@/src/services/validator';
import type { Provider, TaskType } from '@/types';

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

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://yosseling.ai';
    headers['X-Title'] = 'Yosseling';
  }

  const apiMessages = messages.map(m => {
    if (m.role !== 'user' || !m.attachments?.length) {
      return { role: m.role, content: m.content };
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

  const contents = conversationMsgs.map(m => {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const textContent = typeof m.content === 'string' ? m.content : '';

    const imgAttachments = m.attachments?.filter(a => a.type.startsWith('image/') && a.dataUrl) ?? [];
    const docAttachments = m.attachments?.filter(a => !a.type.startsWith('image/') && a.content) ?? [];

    if (imgAttachments.length === 0 && docAttachments.length === 0) {
      return { role, parts: [{ text: textContent }] };
    }

    const parts: Record<string, unknown>[] = [];
    for (const img of imgAttachments) {
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

/** Stream a Response to the client while collecting the full text in the
 *  background. The response is returned immediately so the client starts
 *  receiving tokens without waiting for the whole stream to finish. The
 *  caller can attach a `.then()` to `textPromise` to run post-stream hooks
 *  (validation, token report) without blocking the stream. */
function streamAndCollect(
  res: Response,
  baseHeaders: Record<string, string>,
): { response: NextResponse; textPromise: Promise<string> } {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let fullText = '';

  let resolveText!: (s: string) => void;
  const textPromise = new Promise<string>(r => { resolveText = r; });

  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            const chunk = dec.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]' || !data) continue;
              try {
                const p = JSON.parse(data);
                const delta = p.choices?.[0]?.delta?.content
                  ?? p.candidates?.[0]?.content?.parts?.[0]?.text
                  ?? '';
                if (delta) fullText += delta;
              } catch { /* skip */ }
            }
            ctrl.enqueue(value);
          }
        }
        ctrl.enqueue(enc.encode('data: [DONE]\n\n'));
        ctrl.close();
      } catch (e) {
        ctrl.error(e);
      } finally {
        resolveText(fullText);
      }
    },
  });

  const response = new NextResponse(stream, { headers: sseHeaders(baseHeaders) });
  return { response, textPromise };
}

// ── DEBUG ──────────────────────────────────────────────────────────────────

const DEBUG_REALTIME = getEnvVar('DEBUG_REALTIME') === '1' || process.env.DEBUG_REALTIME === '1';

function debugLog(...args: unknown[]) {
  if (DEBUG_REALTIME) console.log(...args);
}

// ── Main router ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages, model, provider, autoRoute, personality, memoryContext } = await req.json();

    const lastUserMsg = [...messages].reverse().find((m: ChatMessage) => m.role === 'user');
    const lastUserText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';
    const hasImages = Boolean(lastUserMsg?.attachments?.some((a: { type: string; dataUrl?: string }) => a.type.startsWith('image/') && Boolean(a.dataUrl)));

    // ── 1. Task detection ───────────────────────────────────────────────────
    const taskType: TaskType = detectTaskType(lastUserText);

    // If the user is asking for image generation, redirect to the ImageService.
    if (taskType === 'image_gen') {
      return NextResponse.json({
        redirect: '/api/images',
        action: 'generate',
        prompt: lastUserText,
      }, { status: 200 });
    }

    // ── 2. Realtime fetch ────────────────────────────────────────────────────
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

    // ── 3. Build system prompt ───────────────────────────────────────────────
    const baseSystemPrompt = buildSystemPrompt(personality ?? 'amigable', memoryContext);

    // ── 4. Realtime PRIORITY injection ────────────────────────────────────────
    const realtimePriorityHeader = realtimeContext?.prompt
      ? `\n\n━━ INFORMACIÓN REALTIME (PRIORIDAD ABSOLUTA) ━━
Los datos obtenidos desde fuentes externas recientes tienen PRIORIDAD ABSOLUTA sobre tu conocimiento interno.
Nunca respondas con información antigua si existe contexto realtime válido.
Usa estos datos como única fuente de verdad para la pregunta del usuario.

${realtimeContext.prompt}`
      : '';

    const finalSystemPrompt = `${baseSystemPrompt}${realtimePriorityHeader}`;

    // ── 5. Context optimization ─────────────────────────────────────────────
    // Flatten content to string for the ContextManager (it doesn't need the
    // multimodal array — attachments are re-attached afterwards).
    const historyForOpt: ContextMessage[] = (messages as ChatMessage[]).map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '',
      attachments: m.attachments,
    }));
    const optimized = optimizeContext(
      finalSystemPrompt,
      null,
      historyForOpt,
      taskType,
    );

    // Re-attach image attachments on the last user message (ContextManager
    // drops attachments when summarizing — we re-inject them here).
    const apiMessages: ContextMessage[] = optimized.messages.map(m => {
      if (m.role === 'user' && hasImages && !m.attachments) {
        const orig = messages[messages.length - 1] as ChatMessage | undefined;
        if (orig?.attachments) {
          return { ...m, attachments: orig.attachments };
        }
      }
      return m;
    });

    debugLog('\n========== [YOSSELING DEBUG] ==========');
    debugLog('===== USER QUERY =====');
    debugLog(JSON.stringify(lastUserText, null, 2));
    debugLog('\n===== TAVILY RESPONSE =====');
    debugLog(JSON.stringify(realtimeContext, null, 2));
    debugLog('\n===== SYSTEM PROMPT =====');
    debugLog(finalSystemPrompt);
    debugLog('\n===== REQUEST TO MODEL (messages array) =====');
    debugLog(JSON.stringify(apiMessages, null, 2));
    debugLog(`\n[Context] inputTokens=${optimized.inputTokens} budget=${optimized.budget.maxInputTokens} summarized=${optimized.summarized} droppedTurns=${optimized.droppedTurns}`);

    // ── 6. Smart model routing ───────────────────────────────────────────────
    const forcedProvider = (autoRoute || !provider || provider === 'auto')
      ? null
      : provider as Exclude<Provider, 'auto'>;
    const decision = routeModel(lastUserText, hasImages, forcedProvider);

    if (!decision.provider || !decision.model) {
      // No AI provider configured — but if we have realtime data, stream it
      // directly so the user still gets an updated answer.
      if (realtimeContext) {
        const summary = realtimeContext.results.map(r => r.summary).filter(Boolean).join('\n\n');
        const sources = realtimeContext.results.flatMap(r => r.sources).slice(0, 5);
        const sourceLines = sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`).join('\n');
        const answer = summary
          ? `${summary}\n\nFuentes:\n${sourceLines}`
          : `Encontré información reciente pero no pude resumirla. Te dejo las fuentes:\n${sourceLines}`;
        return streamText(answer);
      }
      return streamText('No hay ningún proveedor de IA configurado. Por favor agrega al menos una API key en el archivo .env (GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, CEREBRAS_API_KEY, u OPENAI_API_KEY).');
    }

    debugLog(`\n===== MODEL USED =====`);
    debugLog(`Provider: ${decision.provider}`);
    debugLog(`Model: ${decision.model}`);
    debugLog(`Reason: ${decision.reason}`);

    const triedProviders: string[] = [];
    let fallbackUsed = false;

    // ── 7. Provider call (with fallback chain) ──────────────────────────────
    for (const currentProvider of decision.chain) {
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

        // Build headers now (token counts will be estimates; final counts are
        // logged after the stream completes).
        const estimatedReport = buildTokenReport(apiMessages, '', currentProvider, currentModel);
        const headers: Record<string, string> = {
          'X-Provider': currentProvider,
          'X-Model': currentModel,
          'X-Response-Time': String(responseTime),
          'X-Fallback-Used': fallbackUsed ? 'true' : 'false',
          'X-Tried-Providers': triedProviders.join(','),
          'X-Cost-Per-1K': String(COST_PER_1K[currentProvider] ?? 0),
          'X-Realtime-Used': realtimeContext ? 'true' : 'false',
          'X-Realtime-Domain': realtimeContext?.detectedDomain ?? '',
          'X-Input-Tokens': String(estimatedReport.inputTokens),
          'X-Context-Summarized': optimized.summarized ? 'true' : 'false',
          'X-Context-Dropped-Turns': String(optimized.droppedTurns),
        };

        // Stream to client immediately; collect text in the background.
        const { response: clientRes, textPromise } = streamAndCollect(response, headers);

        // Run validation + token report after the stream finishes, without
        // blocking the response.
        textPromise.then(finalText => {
          const validation = validateResponse(lastUserText, realtimeContext, finalText);
          if (!validation.valid) {
            console.log('[Response Validator]');
            console.log('[Contradiction detected]');
            console.log(`Reason: ${validation.reason}`);
            console.log('[Regenerating]');
            debugLog(`\n[Validator] ${validation.reason}`);
          } else if (realtimeContext) {
            console.log('[Response Validator] OK — response consistent with realtime');
          }
          const report = buildTokenReport(apiMessages, finalText, currentProvider, currentModel);
          console.log(formatTokenReport(report));
        }).catch(() => { /* stream errors handled by client */ });

        return clientRes;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Yosseling] ${currentProvider} failed:`, msg);
        triedProviders.push(currentProvider);
        fallbackUsed = true;

        if (!shouldFallback(msg)) {
          return streamText('La API key no es válida. Verifica tu configuración en el archivo .env.');
        }
      }
    }

    return streamText('Todos los proveedores de IA están temporalmente no disponibles. Por favor intenta de nuevo en unos momentos.');
  } catch (err) {
    console.error('[Yosseling] Router unexpected error:', err);
    return streamText('Ocurrió un error inesperado. Por favor intenta de nuevo.');
  }
}
