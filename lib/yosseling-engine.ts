'use client';

import { openDB } from 'idb';
import { buildSystemPrompt } from '@/lib/personality';
import type { Provider, AdaptiveProfile } from '@/types';

export type RuntimeMode = 'cloud' | 'local';

export interface OfflineConfig {
  backend: 'ollama' | 'webgpu';
  ollamaUrl: string;
  ollamaModel: string;
  webgpuModel: string;
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
const DB_NAME = 'yosseling-offline';
const DB_VERSION = 1;
const DEFAULT_CONFIG: OfflineConfig = {
  backend: 'ollama',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:7b',
  webgpuModel: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
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
  if (typeof window !== 'undefined') window.localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  return next;
}

export function getRuntimeMode(): RuntimeMode {
  if (typeof navigator !== 'undefined' && navigator.onLine && !getOfflineConfig().configured) return 'cloud';
  return 'local';
}

export async function getOfflineModelState(): Promise<{ downloaded: boolean; progress: number }> {
  if (typeof window === 'undefined') return { downloaded: false, progress: 0 };
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('models')) database.createObjectStore('models');
    },
  });
  return (await db.get('models', getOfflineConfig().webgpuModel)) ?? { downloaded: false, progress: 0 };
}

export async function downloadWebGPUModel(onProgress: (progress: number) => void): Promise<void> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    throw new Error('WebGPU no está disponible en este dispositivo');
  }

  const config = getOfflineConfig();
  const webllm = await import('@mlc-ai/web-llm');
  const engine = await webllm.CreateMLCEngine(config.webgpuModel, {
    initProgressCallback: report => {
      const progress = Math.max(0, Math.min(100, Math.round(report.progress * 100)));
      onProgress(progress);
    },
  });
  await engine.unload();

  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('models')) database.createObjectStore('models');
    },
  });
  await db.put('models', { downloaded: true, progress: 100 }, config.webgpuModel);
  saveOfflineConfig({ backend: 'webgpu', configured: true });
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
  const endpoint = `${config.ollamaUrl.replace(/\/$/, '')}/api/chat`;
  const messages = [
    { role: 'system', content: buildSystemPrompt(request.personality, request.memoryContext, request.adaptiveProfile) },
    ...request.messages.filter(message => message.role !== 'system').map(message => ({
      role: message.role,
      content: [message.content, ...(message.attachments ?? []).filter(attachment => attachment.content).map(attachment => `[Archivo adjunto: ${attachment.name}]\n${attachment.content}`)].filter(Boolean).join('\n\n'),
      ...(message.attachments?.some(attachment => attachment.dataUrl)
        ? { images: message.attachments.filter(attachment => attachment.dataUrl).map(attachment => attachment.dataUrl!.split(',')[1] ?? attachment.dataUrl) }
        : {}),
    })),
  ];
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.ollamaModel, messages, stream: true }),
    signal: request.signal,
  });
  if (!response.ok) throw new Error(`Ollama respondió ${response.status}`);
  if (!response.body) throw new Error('Ollama no devolvió una respuesta');

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
        const data = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
        if (data.message?.content) yield data.message.content;
      }
    }
  }
  return sseResponse(chunks(), { 'X-Provider': 'local', 'X-Model': config.ollamaModel });
}

async function callWebGPU(request: EngineRequest, config: OfflineConfig): Promise<Response> {
  if (request.messages.some(message => message.attachments?.some(attachment => attachment.dataUrl))) {
    throw new Error('LOCAL_VISION_UNSUPPORTED');
  }
  const webllm = await import('@mlc-ai/web-llm');
  const engine = await webllm.CreateMLCEngine(config.webgpuModel);
  const messages = [
    { role: 'system' as const, content: buildSystemPrompt(request.personality, request.memoryContext, request.adaptiveProfile) },
    ...request.messages.filter(message => message.role !== 'system').map(message => ({
      role: message.role,
      content: [message.content, ...(message.attachments ?? []).filter(attachment => attachment.content).map(attachment => `[Archivo adjunto: ${attachment.name}]\n${attachment.content}`)].filter(Boolean).join('\n\n'),
    })),
  ];
  const stream = await engine.chat.completions.create({ messages, stream: true });
  async function* chunks(): AsyncIterable<string> {
    for await (const part of stream) {
      const content = part.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }
  return sseResponse(chunks(), { 'X-Provider': 'local', 'X-Model': config.webgpuModel });
}

export async function sendThroughYosseling(request: EngineRequest): Promise<{ response: Response; mode: RuntimeMode }> {
  const config = getOfflineConfig();
  const online = typeof navigator === 'undefined' || navigator.onLine;

  if (online) {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: request.signal,
      });
      if (response.ok && response.headers.get('X-Yosseling-Failure') !== 'true') return { response, mode: 'cloud' };
    } catch {
      // Fall through to the local engine when the cloud cannot be reached.
    }
  }

  try {
    const response = config.backend === 'webgpu'
      ? await callWebGPU(request, config)
      : await callOllama(request, config);
    return { response, mode: 'local' };
  } catch (error) {
    if (error instanceof Error && error.message === 'LOCAL_VISION_UNSUPPORTED') {
      throw new Error('En modo local, este modelo del navegador no puede analizar imágenes. Vuelve al modo nube o configura Ollama con un modelo de visión como llama3.2-vision.');
    }
    throw new Error('Me he quedado sin conexión a internet y noto que tu motor local no está activo. Revisa el Gestor de Modo Offline o enciende tu servidor para que podamos seguir trabajando.');
  }
}
