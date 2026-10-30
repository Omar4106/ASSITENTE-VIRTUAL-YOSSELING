'use client';

import { buildSystemPrompt } from '@/lib/personality';
import type { Provider, AdaptiveProfile } from '@/types';
import { createClient } from '@/lib/supabase/client';

export type RuntimeMode = 'cloud' | 'local';

export interface OfflineConfig {
  backend: 'ollama';
  ollamaUrl: string;
  ollamaModel: string;
  configured: boolean;
}

export interface EngineRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    attachments?: Array<{ name: string; type: string; dataUrl?: string; content?: string }>;
  }>;
  model: string;
  provider: Provider;
  autoRoute: boolean;
  personality: Parameters<typeof buildSystemPrompt>[0];
  memoryContext?: string;
  adaptiveProfile?: AdaptiveProfile;
  signal?: AbortSignal;
}

const CONFIG_KEY = 'yosseling-offline-config';
const SETTINGS_KEY = 'yosseling-settings';
const DEFAULT_CONFIG: OfflineConfig = {
  backend: 'ollama',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:7b',
  configured: false,
};

export function getOfflineConfig(): OfflineConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const saved = window.localStorage.getItem(CONFIG_KEY);
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveOfflineConfig(config: Partial<OfflineConfig>): OfflineConfig {
  const next = { ...getOfflineConfig(), ...config };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    } catch {
      return next;
    }
  }
  return next;
}

function getSettingsRuntimeMode(): RuntimeMode {
  if (typeof window === 'undefined') return 'cloud';
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return 'cloud';
    const parsed = JSON.parse(raw) as { runtimeMode?: RuntimeMode };
    return parsed.runtimeMode === 'local' ? 'local' : 'cloud';
  } catch {
    return 'cloud';
  }
}

export function getRuntimeMode(): RuntimeMode {
  const configured = getOfflineConfig().configured;
  const online = typeof navigator === 'undefined' || navigator.onLine;
  const preferred = getSettingsRuntimeMode();

  if (preferred === 'local' && configured) return 'local';
  if (!online && configured) return 'local';
  return 'cloud';
}

function sseResponse(chunks: AsyncIterable<string>, headers: Record<string, string>): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of chunks) {
          if (chunk) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  }), { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', ...headers } });
}

async function callOllama(request: EngineRequest, config: OfflineConfig): Promise<Response> {
  const endpoint = `${config.ollamaUrl.replace(/\/$/, '')}/api/generate`;
  const systemPrompt = buildSystemPrompt(request.personality, request.memoryContext, request.adaptiveProfile);
  const conversation = request.messages.filter(message => message.role !== 'system');
  const prompt = [
    systemPrompt,
    ...conversation.map(message => {
      const label = message.role === 'user' ? 'Usuario' : 'Yosseling';
      const content = [message.content, ...(message.attachments ?? []).filter(attachment => attachment.content).map(attachment => `[Archivo adjunto: ${attachment.name}]\n${attachment.content}`)].filter(Boolean).join('\n\n');
      return `${label}: ${content}`;
    }),
    'Yosseling:',
  ].join('\n\n');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.ollamaModel, prompt, stream: true }),
    mode: 'cors',
    signal: request.signal,
  });
  if (!response.ok) throw new Error(`El motor local respondió ${response.status}`);
  if (!response.body) throw new Error('El motor local no devolvió una respuesta');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  async function* chunks(): AsyncIterable<string> {
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const data = JSON.parse(line) as { response?: string; done?: boolean };
        if (data.response) yield data.response;
      }
    }
  }
  return sseResponse(chunks(), { 'X-Provider': 'local', 'X-Model': config.ollamaModel });
}

export async function sendThroughYosseling(request: EngineRequest): Promise<{ response: Response; mode: RuntimeMode }> {
  const config = getOfflineConfig();
  const online = typeof navigator === 'undefined' || navigator.onLine;
  const mode = getRuntimeMode();

  const buildCloudHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch (error) {
      console.warn('[Yosseling] Supabase session header unavailable; continuing for guest mode:', error);
    }
    return headers;
  };

  if (mode === 'local' && config.configured) {
    try {
      const response = await callOllama(request, config);
      return { response, mode: 'local' };
    } catch (error) {
      if (online) {
        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: await buildCloudHeaders(),
            body: JSON.stringify(request),
            signal: request.signal,
          });
          if (response.ok) return { response, mode: 'cloud' };
        } catch { /* cloud also failed */ }
      }
      throw new Error('El motor local no respondió. Verifica que Ollama esté en ejecución o cambia al Modo Nube.');
    }
  }

  if (online) {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: await buildCloudHeaders(),
        body: JSON.stringify(request),
        signal: request.signal,
      });
      if (response.ok) return { response, mode: 'cloud' };
    } catch { /* Fall through to local engine */ }
  }

  if (config.configured) {
    try {
      const response = await callOllama(request, config);
      return { response, mode: 'local' };
    } catch {
      throw new Error('Me he quedado sin conexión a internet y el motor local no está disponible. Revisa el Gestor de Modo Offline o enciende Ollama.');
    }
  }

  throw new Error('Me he quedado sin conexión a internet y el Modo Sin Conexión no está activo. Revisa el Gestor de Modo Offline o enciende tu motor local.');
}