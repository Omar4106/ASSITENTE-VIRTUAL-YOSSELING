/**
 * YOSSELING AI ROUTER
 * Unified endpoint with automatic fallback chain.
 *
 * SINGLE ENDPOINT: Use /api/chat for all providers.
 * Fallback: OpenAI -> Groq -> OpenRouter -> Gemini -> Cerebras
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  SYSTEM_PROMPT,
  AI_SETTINGS,
  FALLBACK_ORDER,
  PROVIDER_CONFIG,
  getProviderDefaultModel,
  getProviderFromModel,
  getFriendlyError,
  type Provider,
} from '@/lib/ai-config';
import { getEnvVar } from '@/lib/env';

export const runtime = 'nodejs';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ============================================================
// PROVIDER CALL FUNCTIONS
// ============================================================

async function callOpenAI(messages: ChatMessage[], model: string): Promise<Response> {
  const apiKey = getEnvVar('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

  const res = await fetch(`${PROVIDER_CONFIG.openai.apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: AI_SETTINGS.stream,
      temperature: AI_SETTINGS.temperature,
      max_tokens: AI_SETTINGS.maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI: ${err}`);
  }

  return res;
}

async function callGroq(messages: ChatMessage[], model: string): Promise<Response> {
  const apiKey = getEnvVar('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY no configurada');

  const res = await fetch(`${PROVIDER_CONFIG.groq.apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: AI_SETTINGS.stream,
      temperature: AI_SETTINGS.temperature,
      max_tokens: AI_SETTINGS.maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq: ${err}`);
  }

  return res;
}

async function callOpenRouter(messages: ChatMessage[], model: string): Promise<Response> {
  const apiKey = getEnvVar('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada');

  const res = await fetch(`${PROVIDER_CONFIG.openrouter.apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://yosseling.ai',
      'X-Title': 'Yosseling AI',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: AI_SETTINGS.stream,
      temperature: AI_SETTINGS.temperature,
      max_tokens: AI_SETTINGS.maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter: ${err}`);
  }

  return res;
}

async function callGemini(messages: ChatMessage[], model: string): Promise<Response> {
  const apiKey = getEnvVar('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  // Convert messages to Gemini format
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const res = await fetch(
    `${PROVIDER_CONFIG.gemini.apiBaseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: AI_SETTINGS.temperature,
          maxOutputTokens: AI_SETTINGS.maxTokens,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini: ${err}`);
  }

  // Wrap Gemini stream in OpenAI format
  return wrapGeminiStream(res);
}

function wrapGeminiStream(geminiRes: Response): Response {
  const encoder = new TextEncoder();
  const reader = geminiRes.body?.getReader();
  if (!reader) throw new Error('No Gemini response body');

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                if (text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
                  );
                }
              } catch {}
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream);
}

async function callCerebras(messages: ChatMessage[], model: string): Promise<Response> {
  const apiKey = getEnvVar('CEREBRAS_API_KEY');
  if (!apiKey) throw new Error('CEREBRAS_API_KEY no configurada');

  const res = await fetch(`${PROVIDER_CONFIG.cerebras.apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: AI_SETTINGS.stream,
      temperature: AI_SETTINGS.temperature,
      max_tokens: AI_SETTINGS.maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cerebras: ${err}`);
  }

  return res;
}

const PROVIDER_CALLERS: Record<Provider, (messages: ChatMessage[], model: string) => Promise<Response>> = {
  openai: callOpenAI,
  groq: callGroq,
  openrouter: callOpenRouter,
  gemini: callGemini,
  cerebras: callCerebras,
};

// ============================================================
// MAIN ROUTER
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const { messages, model, provider, autoRoute = false } = await req.json();

    const apiMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
    ];

    const triedProviders: Provider[] = [];

    // Determine provider order
    const providersToTry: Provider[] = autoRoute || !provider
      ? FALLBACK_ORDER
      : [provider, ...FALLBACK_ORDER.filter(p => p !== provider)];

    console.log('[Yosseling Router] Starting request. Provider:', provider || 'auto', 'Model:', model || 'default');

    for (const currentProvider of providersToTry) {
      const caller = PROVIDER_CALLERS[currentProvider];
      if (!caller) continue;

      const currentModel = model && getProviderFromModel(model) === currentProvider
        ? model
        : getProviderDefaultModel(currentProvider);

      console.log(`[Yosseling Router] Trying ${currentProvider} with model ${currentModel}...`);
      const startTime = Date.now();

      try {
        const response = await caller(apiMessages, currentModel);
        const responseTime = Date.now() - startTime;

        console.log(`[Yosseling Router] ${currentProvider} succeeded in ${responseTime}ms`);

        return new NextResponse(response.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Provider': currentProvider,
            'X-Model': currentModel,
            'X-Response-Time': String(responseTime),
            'X-Fallback-Used': triedProviders.length > 0 ? 'true' : 'false',
            'X-Tried-Providers': triedProviders.join(','),
          },
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Yosseling Router] ${currentProvider} failed:`, errorMsg);
        triedProviders.push(currentProvider);

        // Only continue to next provider for certain errors
        if (!shouldFallback(errorMsg)) {
          return streamError(getFriendlyError(errorMsg));
        }
      }
    }

    return streamError('Todos los proveedores fallaron. Por favor verifica tus API keys en el archivo .env');
  } catch (err) {
    console.error('[Yosseling Router] Unexpected error:', err);
    return streamError('Error interno del servidor');
  }
}

function shouldFallback(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase();
  // Fallback on transient/recoverable errors; do NOT fallback on auth errors
  // (invalid key = configuration issue, not a transient failure)
  if (lower.includes('invalid') && lower.includes('key')) return false;
  return (
    lower.includes('quota') ||
    lower.includes('rate') ||
    lower.includes('429') ||
    lower.includes('timeout') ||
    lower.includes('unavailable') ||
    lower.includes('not found') ||
    lower.includes('no configurada') ||
    lower.includes('connection') ||
    lower.includes('network') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503')
  );
}

function streamError(msg: string): NextResponse {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: msg } }] })}\n\ndata: [DONE]\n\n`)
      );
      controller.close();
    },
  });
  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
