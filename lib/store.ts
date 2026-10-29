'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  Chat, Message, MemoryItem, AppSettings, Provider,
  SidebarView, RightPanelView, AttachedFile, AICenterData,
  MemoryCategory, MemoryImportance, MemoryType, ConversationSection, ImageGenerationProvider,
} from '@/types';
import {
  saveChat, getAllChats, deleteChat as dbDeleteChat, clearAllChats as dbClearChats,
  getAllMemory, saveMemoryItem, deleteMemoryItem as dbDeleteMemory,
  clearAllMemory, loadSettings, saveSettings, DEFAULT_SETTINGS,
} from '@/lib/db';
import { getDefaultModel } from '@/lib/ai-config';
import { buildMemoryContext, detectMemory, isDuplicate, createMemoryItem, exportMemory, parseMemoryImport, updateAdaptiveProfile } from '@/lib/memory';
import { sendThroughYosseling } from '@/lib/yosseling-engine';
import { detectMediaGenerationIntent, isImageGenerationRequest, isOfflineModeIntent, isAffirmation, isOptimizationRequest, detectPlatform } from '@/lib/image-intent';
import { generateOptimizationScript } from '@/lib/optimization';

function genId() {
  return Math.random().toString(36).slice(2, 11) + Math.random().toString(36).slice(2, 11);
}

const MODERATION_PATTERN = /User Safety:\s*safe|Response Safety:\s*safe|safety:\s*safe/i;
const DEFAULT_DOWNLOAD_MSG = '¡Listo! He procesado el enlace. Puedes reproducir o descargar el contenido a continuación 👇';

function filterModeration(content: string): string {
  if (!content) return content;
  if (MODERATION_PATTERN.test(content)) {
    const cleaned = content.replace(/User Safety:\s*safe|Response Safety:\s*safe/gi, '').trim();
    return cleaned || DEFAULT_DOWNLOAD_MSG;
  }
  return content;
}

function parseReasoning(content: string): { reasoning: string; cleanContent: string } {
  const closedMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  if (closedMatch) {
    return {
      reasoning: closedMatch[1].trim(),
      cleanContent: content.replace(/<think>[\s\S]*?<\/think>/, '').trim(),
    };
  }
  const openMatch = content.match(/<think>([\s\S]*)$/);
  if (openMatch) {
    return {
      reasoning: openMatch[1].trim(),
      cleanContent: '',
    };
  }
  return { reasoning: '', cleanContent: content };
}

interface AppState {
  chats: Chat[];
  activeChatId: string | null;
  authUser: { id: string; email: string | null; name: string | null; avatarUrl: string | null; role: string | null } | null;
  setAuthUser: (user: AppState['authUser']) => void;
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  sidebarView: SidebarView;
  rightPanelView: RightPanelView;
  isStreaming: boolean;
  abortController: AbortController | null;
  selectedModel: string;
  selectedProvider: Provider;
  settings: AppSettings;
  memory: MemoryItem[];
  isSpeaking: boolean;
  isListening: boolean;
  pendingFiles: AttachedFile[];
  searchQuery: string;
  aiCenterData: AICenterData | null;
  memoryIndicator: { type: 'save' | 'update' | 'delete'; title: string } | null;
  activeConversationSection: ConversationSection;

  // Core
  initStore: () => Promise<void>;
  createNewChat: () => void;
  setActiveChat: (id: string) => void;
  deleteChat: (id: string) => Promise<void>;
  clearAllChats: () => Promise<void>;
  importChats: (chats: Chat[]) => Promise<void>;
  sendMessage: (
    content: string,
    files?: AttachedFile[],
    options?: {
      section?: ConversationSection;
      imageProvider?: ImageGenerationProvider;
      mediaMode?: 'image' | 'edit-image' | 'audio' | 'video';
      imageDataUrl?: string;
      lyrics?: string;
    },
  ) => Promise<void>;
  setConversationSection: (section: ConversationSection) => void;
  stopStreaming: () => void;
  editMessage: (chatId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  regenerateResponse: (chatId: string, messageId: string) => Promise<void>;
  renameChat: (id: string, title: string) => Promise<void>;
  pinChat: (id: string) => Promise<void>;
  favoriteChat: (id: string) => Promise<void>;
  setSelectedModel: (model: string, provider: Provider) => void;
  setSidebarOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setSidebarView: (view: SidebarView) => void;
  setRightPanelView: (view: RightPanelView) => void;
  updateSettings: (s: Partial<AppSettings>) => void;

  // Memory
  loadMemory: () => Promise<void>;
  addMemoryItem: (item: Partial<MemoryItem>) => Promise<MemoryItem | null>;
  updateMemoryItem: (id: string, updates: Partial<MemoryItem>) => Promise<void>;
  deleteMemoryItem: (id: string) => Promise<void>;
  clearMemory: () => Promise<void>;
  duplicateMemoryItem: (id: string) => Promise<void>;
  exportMemoryData: (format: 'json' | 'txt' | 'md') => string;
  importMemoryData: (json: string) => Promise<number>;
  clearMemoryIndicator: () => void;

  // Voice / Files
  setIsSpeaking: (v: boolean) => void;
  setIsListening: (v: boolean) => void;
  addPendingFile: (file: AttachedFile) => void;
  removePendingFile: (id: string) => void;
  clearPendingFiles: () => void;
  setSearchQuery: (q: string) => void;
}

const { id: defaultModelId, provider: defaultProvider } = getDefaultModel();
let storeInitializationPromise: Promise<void> | null = null;

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    chats: [],
    activeChatId: null,
    authUser: null,
    setAuthUser: (authUser) => set({ authUser }),
    sidebarOpen: true,
    rightPanelOpen: true,
    sidebarView: 'chats',
    rightPanelView: 'tools',
    isStreaming: false,
    abortController: null,
    selectedModel: defaultModelId,
    selectedProvider: defaultProvider,
    settings: DEFAULT_SETTINGS,
    memory: [],
    isSpeaking: false,
    isListening: false,
    pendingFiles: [],
    searchQuery: '',
    aiCenterData: null,
    memoryIndicator: null,
    activeConversationSection: 'general',

    initStore: () => {
      if (!storeInitializationPromise) {
        storeInitializationPromise = (async () => {
          const settings = loadSettings();
          const storageLoad = Promise.all([getAllChats(), getAllMemory()]);
          const timeout = new Promise<[Chat[], MemoryItem[]]>((resolve) => {
            globalThis.setTimeout(() => resolve([[], []]), 2500);
          });
          const [chats, memory] = await Promise.race([storageLoad, timeout]);
          set({
            settings,
            chats: chats.map((chat) => ({ ...chat, section: chat.section ?? 'general' })),
            memory,
            selectedModel: settings.defaultModel,
            selectedProvider: settings.defaultProvider,
          });
        })().catch((error: unknown) => {
          storeInitializationPromise = null;
          throw error;
        });
      }

      return storeInitializationPromise;
    },

    createNewChat: () => {
      const { selectedModel, selectedProvider } = get();
      const section = get().activeConversationSection;
      const chat: Chat = {
        id: genId(),
        title: 'Nuevo Chat',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: selectedModel,
        provider: selectedProvider,
        section,
      };
      set(s => ({ chats: [chat, ...s.chats], activeChatId: chat.id }));
      saveChat(chat);
    },

    setActiveChat: (id) => {
      const chat = get().chats.find((item) => item.id === id);
      set({
        activeChatId: id,
        activeConversationSection: chat?.section ?? 'general',
      });
    },

    setConversationSection: (section) => {
      const latestChat = get().chats
        .filter((chat) => (chat.section ?? 'general') === section)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      set({
        activeConversationSection: section,
        activeChatId: latestChat?.id ?? null,
      });
    },

    deleteChat: async (id) => {
      await dbDeleteChat(id);
      set(s => {
        const chats = s.chats.filter(c => c.id !== id);
        if (s.activeChatId !== id) return { chats };
        const nextChat = chats
          .filter((chat) => (chat.section ?? 'general') === s.activeConversationSection)
          .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
        return {
          chats,
          activeChatId: nextChat?.id ?? null,
        };
      });
    },

    clearAllChats: async () => {
      await dbClearChats();
      set({ chats: [], activeChatId: null });
    },

    importChats: async (imported) => {
      const existingIds = new Set(get().chats.map(c => c.id));
      const toAdd = imported.filter(c => !existingIds.has(c.id));
      for (const c of toAdd) await saveChat(c);
      set(s => ({ chats: [...toAdd, ...s.chats].sort((a, b) => b.updatedAt - a.updatedAt) }));
    },

    sendMessage: async (content, files, options) => {
      const state = get();
      const detectedMediaMode = detectMediaGenerationIntent(content);
      const requestedMediaMode = detectedMediaMode
        ?? options?.mediaMode
        ?? (isImageGenerationRequest(content) ? 'image' : undefined);
      const section = options?.section ?? state.activeConversationSection;
      let chat = state.chats.find(c => c.id === state.activeChatId && (c.section ?? 'general') === section) ?? null;
      let chatId: string | null = chat?.id ?? null;

      if (!chat) {
        const newChat: Chat = {
          id: genId(),
          title: content.slice(0, 40) || 'Nuevo Chat',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: state.selectedModel,
          provider: state.selectedProvider,
          section,
        };
        chatId = newChat.id;
        set(s => ({ chats: [newChat, ...s.chats], activeChatId: chatId }));
        chat = newChat;
        await saveChat(newChat);
      }

      const userMsg: Message = {
        id: genId(),
        role: 'user',
        content,
        timestamp: Date.now(),
        section,
        attachments: files?.length ? files : undefined,
      };
      const assistantMsg: Message = {
        id: genId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        section,
        model: state.selectedModel,
        provider: state.selectedProvider,
        isStreaming: true,
        isImageGenerating: requestedMediaMode === 'image' || requestedMediaMode === 'edit-image',
        isMediaGenerating: Boolean(requestedMediaMode),
        mediaType: requestedMediaMode === 'audio'
          ? 'audio'
          : requestedMediaMode === 'video'
            ? 'video'
            : requestedMediaMode === 'edit-image' || requestedMediaMode === 'image'
              ? 'image'
              : undefined,
      };

      const updatedMessages = [...(chat.messages ?? []), userMsg, assistantMsg];
      const updatedChat: Chat = {
        ...chat,
        messages: updatedMessages,
        updatedAt: Date.now(),
        title: chat.messages.length === 0 ? (content.slice(0, 40) || 'Nuevo Chat') : chat.title,
      };

      set(s => ({
        isStreaming: true,
        chats: s.chats.map(c => c.id === chatId ? updatedChat : c),
        aiCenterData: {
          activeProvider: state.selectedProvider,
          activeModel: state.selectedModel,
          status: 'streaming',
          latency: 0,
          responseTime: 0,
          tokens: 0,
          costEstimate: 0,
          providerUsed: null,
          discardedProviders: [],
          fallbackUsed: false,
          fallbackChain: '',
        },
      }));

      const controller = new AbortController();
      set({ abortController: controller });
      const startTime = Date.now();
      let multimediaTimedOut = false;

      try {
        const mediaMode = requestedMediaMode;
        if (mediaMode) {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            const offlineMessage = 'Las herramientas de generación multimedia requieren conexión a internet. Vuelve a conectarte e inténtalo de nuevo.';
            const offlineChat = get().chats.find(c => c.id === chatId);
            if (offlineChat) {
              const savedOffline: Chat = {
                ...offlineChat,
                messages: offlineChat.messages.map(m => m.id === assistantMsg.id ? { ...m, content: offlineMessage, isStreaming: false, isImageGenerating: false, isMediaGenerating: false } : m),
                updatedAt: Date.now(),
              };
              set(s => ({ chats: s.chats.map(c => c.id === chatId ? savedOffline : c), aiCenterData: s.aiCenterData ? { ...s.aiCenterData, status: 'success' } : null }));
              await saveChat(savedOffline);
            }
            return;
          }

          const imageProvider = options?.imageProvider ?? 'auto';
          const mediaEndpoint = mediaMode === 'edit-image'
            ? '/api/transform-image'
            : mediaMode === 'audio'
              ? '/api/generate-audio'
              : mediaMode === 'video'
                ? '/api/generate-video'
                : imageProvider === 'huggingface'
                  ? '/api/generate-image-hf'
                  : imageProvider === 'fal'
                    ? '/api/generate-image-fal'
                    : '/api/generate-image';
          const fetchController = new AbortController();
          const abortUserRequest = () => fetchController.abort();
          controller.signal.addEventListener('abort', abortUserRequest, { once: true });
          const mediaTimeout = globalThis.setTimeout(() => {
            multimediaTimedOut = true;
            fetchController.abort();
          }, mediaMode === 'video' ? 30_000 : 120_000);

          let mediaResponse: Response;
          let mediaResult: {
            success?: boolean;
            imageUrl?: string;
            audioUrl?: string;
            videoUrl?: string;
            error?: string;
          };
          try {
            mediaResponse = await fetch(mediaEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: content,
                ...(options?.imageDataUrl ? { imageDataUrl: options.imageDataUrl } : {}),
                ...(options?.lyrics?.trim() ? { lyrics: options.lyrics.trim() } : {}),
              }),
              signal: fetchController.signal,
            });
            try {
              mediaResult = await mediaResponse.json();
            } catch {
              throw new Error(mediaMode === 'video'
                ? 'El servidor de video devolvió una respuesta inválida. Inténtalo de nuevo.'
                : mediaMode === 'audio'
                  ? 'El servidor de audio devolvió una respuesta inválida. Inténtalo de nuevo.'
                  : 'El servidor multimedia devolvió una respuesta inválida. Inténtalo de nuevo.');
            }
          } finally {
            globalThis.clearTimeout(mediaTimeout);
            controller.signal.removeEventListener('abort', abortUserRequest);
          }
          const mediaChat = get().chats.find(c => c.id === chatId);
          if (mediaChat) {
            const mediaUrl = mediaMode === 'audio'
              ? mediaResult.audioUrl
              : mediaMode === 'video'
                ? mediaResult.videoUrl
                : mediaResult.imageUrl;
            const ok = mediaResponse.ok && Boolean(mediaUrl);
            const completedMessage: Message = {
              ...assistantMsg,
              content: ok
                ? mediaMode === 'audio'
                  ? 'Tu audio está listo.'
                  : mediaMode === 'video'
                    ? 'Tu video está listo.'
                    : mediaMode === 'edit-image'
                      ? 'Aquí tienes la imagen transformada.'
                      : 'Aquí tienes la imagen que imaginé para ti.'
                : mediaResult.error ?? 'No pude completar la generación multimedia. Inténtalo de nuevo.',
              imageUrl: mediaMode === 'image' || mediaMode === 'edit-image' ? mediaUrl : undefined,
              audioUrl: mediaMode === 'audio' ? mediaUrl : undefined,
              videoUrl: mediaMode === 'video' ? mediaUrl : undefined,
              isStreaming: false,
              isImageGenerating: false,
              isMediaGenerating: false,
            };
            const savedMedia: Chat = {
              ...mediaChat,
              messages: mediaChat.messages.map(m => m.id === assistantMsg.id ? completedMessage : m),
              updatedAt: Date.now(),
            };
            set(s => ({ chats: s.chats.map(c => c.id === chatId ? savedMedia : c), aiCenterData: s.aiCenterData ? { ...s.aiCenterData, status: ok ? 'success' : 'error', providerUsed: null } : null }));
            await saveChat(savedMedia);
          }
          return;
        }

        // Device optimization intent detection
        if (isOptimizationRequest(content)) {
          const platform = detectPlatform(content);
          const script = generateOptimizationScript(platform, content);
          const stepsList = script.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
          const platformLabel = platform === 'unknown' ? 'tu sistema (Windows por defecto)' :
            platform === 'android' ? 'Android' : platform === 'linux' ? 'Linux' : 'Windows';
          const optMessage = `He preparado un script de optimización para ${platformLabel}. Este script hace lo siguiente:\n\n${stepsList}\n\nRevisa el script con calma. Cuando estés listo, puedes copiarlo o descargarlo con los botones que aparecen encima del código.\n\n\`\`\`${script.language}\n${script.code}\n\`\`\`\n\n**Importante:** Ejecuta el script como administrador (Windows) o con permisos sudo (Linux). Para Android necesitas ADB instalado y depuración USB activada. Nunca se ejecuta automáticamente — tú decides cuándo y dónde correrlo.`;
          const optChat = get().chats.find(c => c.id === chatId);
          if (optChat) {
            const savedOpt: Chat = {
              ...optChat,
              messages: optChat.messages.map(m => m.id === assistantMsg.id
                ? { ...m, content: optMessage, isStreaming: false, optimizationScript: { filename: script.filename, language: script.language, code: script.code, description: script.description, steps: script.steps } }
                : m),
              updatedAt: Date.now(),
            };
            set(s => ({ chats: s.chats.map(c => c.id === chatId ? savedOpt : c), aiCenterData: s.aiCenterData ? { ...s.aiCenterData, status: 'success' } : null }));
            await saveChat(savedOpt);
          }
          return;
        }

        // Offline mode intent detection with typo tolerance
        if (isOfflineModeIntent(content)) {
          if (get().settings.pendingOfflineInstall) {
            // User previously asked — now confirming
            if (isAffirmation(content)) {
              get().updateSettings({ pendingOfflineInstall: false });
              const confirmMessage = '¡Perfecto! Voy a instalar el motor local ahora mismo. Verás una barra de progreso mientras se descarga. Cuando termine, podré seguir ayudándote incluso sin internet.';
              const confirmChat = get().chats.find(c => c.id === chatId);
              if (confirmChat) {
                const savedConfirm: Chat = {
                  ...confirmChat,
                  messages: confirmChat.messages.map(m => m.id === assistantMsg.id ? { ...m, content: confirmMessage, isStreaming: false } : m),
                  updatedAt: Date.now(),
                };
                set(s => ({ chats: s.chats.map(c => c.id === chatId ? savedConfirm : c) }));
                await saveChat(savedConfirm);
              }
              // Trigger the offline download via event — OfflineManager listens
              window.dispatchEvent(new CustomEvent('yosseling-install-offline'));
              return;
            }
          } else {
            // First time asking — propose the solution
            get().updateSettings({ pendingOfflineInstall: true });
            const proposal = '¡Sí! Puedo funcionar sin conexión. Si me confirmas, descargaré e instalaré un motor local ligero en tu dispositivo para cuando te quedes sin señal. ¿Deseas que lo instale ahora?';
            const proposalChat = get().chats.find(c => c.id === chatId);
            if (proposalChat) {
              const savedProposal: Chat = {
                ...proposalChat,
                messages: proposalChat.messages.map(m => m.id === assistantMsg.id ? { ...m, content: proposal, isStreaming: false } : m),
                updatedAt: Date.now(),
              };
              set(s => ({ chats: s.chats.map(c => c.id === chatId ? savedProposal : c) }));
              await saveChat(savedProposal);
            }
            return;
          }
        }

        // If user says yes but there's a pending offline install confirmation
        if (isAffirmation(content) && get().settings.pendingOfflineInstall) {
          get().updateSettings({ pendingOfflineInstall: false });
          const affirmMessage = '¡Perfecto! Voy a instalar el motor local ahora mismo. Verás una barra de progreso mientras se descarga. Cuando termine, podré seguir ayudándote incluso sin internet.';
          const affirmChat = get().chats.find(c => c.id === chatId);
          if (affirmChat) {
            const savedAffirm: Chat = {
              ...affirmChat,
              messages: affirmChat.messages.map(m => m.id === assistantMsg.id ? { ...m, content: affirmMessage, isStreaming: false } : m),
              updatedAt: Date.now(),
            };
            set(s => ({ chats: s.chats.map(c => c.id === chatId ? savedAffirm : c) }));
            await saveChat(savedAffirm);
          }
          window.dispatchEvent(new CustomEvent('yosseling-install-offline'));
          return;
        }

        const memCtx = buildMemoryContext(get().memory);
        const allMsgs = updatedMessages
          .filter(m => !(m.role === 'assistant' && m.isStreaming))
          .map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }));

        const MAX_HISTORY = 18;
        let chatMsgs: { role: 'user' | 'assistant' | 'system'; content: string }[];

        if (allMsgs.length > MAX_HISTORY) {
          const older = allMsgs.slice(0, allMsgs.length - MAX_HISTORY);
          const recent = allMsgs.slice(allMsgs.length - MAX_HISTORY);
          const olderSummary = older
            .map(m => `${m.role === 'user' ? 'Usuario' : 'Yosseling'}: ${m.content.slice(0, 120)}`)
            .join(' | ');
          const summaryMsg: { role: 'user' | 'assistant' | 'system'; content: string } = { role: 'system', content: `Resumen de la conversación anterior:\n${olderSummary}` };
          chatMsgs = [summaryMsg, ...recent];
        } else {
          chatMsgs = allMsgs;
        }

        const messagePayload = files?.length
          ? chatMsgs.map((m, i) => i === chatMsgs.length - 1 && m.role === 'user'
            ? {
                ...m,
                attachments: files.map(f => ({ name: f.name, type: f.type, dataUrl: f.dataUrl, content: f.content })),
              }
            : m)
          : chatMsgs;

        const { response } = await sendThroughYosseling({
          messages: messagePayload,
          model: state.selectedModel,
          provider: state.selectedProvider,
          autoRoute: state.selectedProvider === 'auto',
          personality: get().settings.personality,
          memoryContext: memCtx,
          adaptiveProfile: get().settings.adaptiveProfile,
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const usedProvider = (response.headers.get('X-Provider') ?? state.selectedProvider) as Provider;
        const usedModel = response.headers.get('X-Model') ?? state.selectedModel;
        const fallbackUsed = response.headers.get('X-Fallback-Used') === 'true';
        const triedProviders = (response.headers.get('X-Tried-Providers') ?? '').split(',').filter(Boolean) as Provider[];

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No stream');

        const decoder = new TextDecoder();
        let fullContent = '';
        let reasoningContent = '';
        let tokenCount = 0;
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content ?? '';
              const deltaReasoning = parsed.choices?.[0]?.delta?.reasoning_content ?? '';
              if (deltaReasoning) reasoningContent += deltaReasoning;
              if (delta) {
                fullContent += delta;
                tokenCount++;
              }
              fullContent = filterModeration(fullContent);
              // Extract <think> blocks from content
              const { reasoning: thinkReasoning, cleanContent } = parseReasoning(fullContent);
              const finalReasoning = reasoningContent || thinkReasoning;
              set(s => ({
                chats: s.chats.map(c => {
                  if (c.id !== chatId) return c;
                  return {
                    ...c,
                    messages: c.messages.map(m =>
                      m.id === assistantMsg.id ? {
                        ...m,
                        content: cleanContent,
                        reasoning: finalReasoning || undefined,
                        provider: usedProvider,
                        model: usedModel,
                      } : m
                    ),
                  };
                }),
              }));
            } catch { /* skip */ }
          }
        }

        const responseTime = Date.now() - startTime;
        const finalChat = get().chats.find(c => c.id === chatId);
        if (finalChat) {
          const { reasoning: thinkReasoning, cleanContent } = parseReasoning(fullContent);
          const finalReasoning = reasoningContent || thinkReasoning;
          const saved: Chat = {
            ...finalChat,
            messages: finalChat.messages.map(m =>
              m.id === assistantMsg.id
                ? { ...m, isStreaming: false, responseTime, tokenCount, provider: usedProvider, model: usedModel, content: cleanContent, reasoning: finalReasoning || undefined }
                : m
            ),
            updatedAt: Date.now(),
          };
          set(s => ({ chats: s.chats.map(c => c.id === chatId ? saved : c) }));
          await saveChat(saved);
        }

        // Update Centro IA
        const costPer1k: Record<string, number> = { openai: 0.005, groq: 0, gemini: 0.000075, openrouter: 0.0005, cerebras: 0 };
        set({
          aiCenterData: {
            activeProvider: usedProvider,
            activeModel: usedModel,
            status: 'success',
            latency: responseTime,
            responseTime,
            tokens: tokenCount,
            costEstimate: (tokenCount / 1000) * (costPer1k[usedProvider] ?? 0),
            providerUsed: usedProvider,
            discardedProviders: triedProviders,
            fallbackUsed,
            fallbackChain: triedProviders.length ? triedProviders.join(' → ') + ' → ' + usedProvider : usedProvider,
          },
        });

        // Auto-detect memory + adaptive profile
        if (get().settings.memoryEnabled && get().settings.memoryAutoSave) {
          const detected = detectMemory(content, get().memory);
          for (const d of detected) {
            const item = createMemoryItem(d, 'auto');
            if (!isDuplicate(item, get().memory)) {
              await saveMemoryItem(item);
              set(s => ({ memory: [item, ...s.memory] }));
            }
          }
          if (detected.length > 0) {
            set({ memoryIndicator: { type: 'save', title: `${detected.length} memoria${detected.length > 1 ? 's' : ''} detectada${detected.length > 1 ? 's' : ''}` } });
            setTimeout(() => get().clearMemoryIndicator(), 3000);
          }
        }

        // Update adaptive profile based on user's message
        const currentSettings = get().settings;
        const updatedProfile = updateAdaptiveProfile(currentSettings.adaptiveProfile, content);
        get().updateSettings({ adaptiveProfile: updatedProfile });
      } catch (err: unknown) {
        const wasAborted = err instanceof Error && err.name === 'AbortError';
        if (multimediaTimedOut) {
          const timeoutMessage = 'La generación multimedia tardó demasiado tiempo. El servidor no respondió a tiempo; inténtalo de nuevo.';
          set(s => ({
            chats: s.chats.map(c => c.id !== chatId ? c : {
              ...c,
              messages: c.messages.map(m => m.id === assistantMsg.id
                ? { ...m, content: timeoutMessage, isStreaming: false, isImageGenerating: false, isMediaGenerating: false }
                : m),
              updatedAt: Date.now(),
            }),
            aiCenterData: s.aiCenterData ? { ...s.aiCenterData, status: 'error' } : null,
          }));
          const timeoutChat = get().chats.find(c => c.id === chatId);
          if (timeoutChat) await saveChat(timeoutChat);
        } else if (wasAborted) {
          set(s => ({
            chats: s.chats.map(c => c.id !== chatId ? c : {
              ...c,
              messages: c.messages.map(m => m.id === assistantMsg.id
                ? { ...m, content: 'Generación cancelada.', isStreaming: false, isImageGenerating: false, isMediaGenerating: false }
                : m),
              updatedAt: Date.now(),
            }),
          }));
          const cancelledChat = get().chats.find(c => c.id === chatId);
          if (cancelledChat) await saveChat(cancelledChat);
        } else if (err instanceof Error) {
          console.error('[Yosseling] sendMessage error:', err);
          let errMsg = err.message.includes('servidor multimedia') || err.message.includes('servidor de video') || err.message.includes('servidor de audio')
            ? err.message
            : 'Lo siento, no pude procesar tu solicitud en este momento. Por favor, intenta de nuevo.';
          if (err.message === 'MÓVIL_OFFLINE_NO_COMPATIBLE') {
            errMsg = 'Modo offline no compatible en móviles sin servidor remoto configurado. Por favor, conéctate a internet para usar Yosseling en la nube.';
          }
          set(s => ({
            chats: s.chats.map(c => {
              if (c.id !== chatId) return c;
              return {
                ...c,
                messages: c.messages.map(m =>
                  m.id === assistantMsg.id
                    ? { ...m, content: errMsg, isStreaming: false, isImageGenerating: false, isMediaGenerating: false }
                    : m
                ),
              };
            }),
            aiCenterData: get().aiCenterData ? { ...get().aiCenterData!, status: 'error' } : null,
          }));
          const errChat = get().chats.find(c => c.id === chatId);
          if (errChat) await saveChat(errChat);
        }
      } finally {
        set({ isStreaming: false, abortController: null });
      }
    },

    stopStreaming: () => {
      get().abortController?.abort();
      set({ isStreaming: false, abortController: null });
    },

    editMessage: async (chatId, msgId, content) => {
      set(s => ({
        chats: s.chats.map(c =>
          c.id !== chatId ? c : { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, content } : m) }
        ),
      }));
      const chat = get().chats.find(c => c.id === chatId);
      if (chat) await saveChat(chat);
    },

    deleteMessage: async (chatId, msgId) => {
      set(s => ({
        chats: s.chats.map(c =>
          c.id !== chatId ? c : { ...c, messages: c.messages.filter(m => m.id !== msgId) }
        ),
      }));
      const chat = get().chats.find(c => c.id === chatId);
      if (chat) await saveChat(chat);
    },

    regenerateResponse: async (chatId, msgId) => {
      const chat = get().chats.find(c => c.id === chatId);
      if (!chat) return;
      const idx = chat.messages.findIndex(m => m.id === msgId);
      if (idx < 0) return;
      let lastUserIdx = -1;
      for (let i = idx; i >= 0; i--) {
        if (chat.messages[i].role === 'user') { lastUserIdx = i; break; }
      }
      if (lastUserIdx < 0) return;
      const lastUser = chat.messages[lastUserIdx];
      set(s => ({ chats: s.chats.map(c => c.id === chatId ? { ...c, messages: c.messages.slice(0, lastUserIdx) } : c), activeChatId: chatId }));
      await get().sendMessage(lastUser.content, lastUser.attachments);
    },

    renameChat: async (id, title) => {
      set(s => ({ chats: s.chats.map(c => c.id === id ? { ...c, title } : c) }));
      const chat = get().chats.find(c => c.id === id);
      if (chat) await saveChat(chat);
    },
    pinChat: async (id) => {
      set(s => ({ chats: s.chats.map(c => c.id === id ? { ...c, isPinned: !c.isPinned } : c) }));
      const chat = get().chats.find(c => c.id === id);
      if (chat) await saveChat(chat);
    },
    favoriteChat: async (id) => {
      set(s => ({ chats: s.chats.map(c => c.id === id ? { ...c, isFavorite: !c.isFavorite } : c) }));
      const chat = get().chats.find(c => c.id === id);
      if (chat) await saveChat(chat);
    },

    setSelectedModel: (model, provider) => set({ selectedModel: model, selectedProvider: provider }),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
    setSidebarView: (view) => set({ sidebarView: view }),
    setRightPanelView: (view) => set({ rightPanelView: view }),

    updateSettings: (partial) => {
      const next = { ...get().settings, ...partial };
      set({ settings: next });
      saveSettings(next);
    },

    loadMemory: async () => { set({ memory: await getAllMemory() }); },

    addMemoryItem: async (partial) => {
      const base: MemoryItem = {
        id: genId(),
        title: partial.title ?? '',
        content: partial.content ?? '',
        category: (partial.category as MemoryCategory) ?? 'otros',
        type: (partial.type as MemoryType) ?? 'persistent',
        importance: (partial.importance as MemoryImportance) ?? 'medium',
        tags: partial.tags ?? [],
        source: partial.source ?? 'manual',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (isDuplicate(base, get().memory)) return null;
      await saveMemoryItem(base);
      set(s => ({
        memory: [base, ...s.memory],
        memoryIndicator: { type: 'save', title: base.title },
      }));
      setTimeout(() => get().clearMemoryIndicator(), 2500);
      return base;
    },

    updateMemoryItem: async (id, updates) => {
      const cur = get().memory.find(m => m.id === id);
      if (!cur) return;
      const updated: MemoryItem = { ...cur, ...updates, updatedAt: Date.now() } as MemoryItem;
      await saveMemoryItem(updated);
      set(s => ({
        memory: s.memory.map(m => m.id === id ? updated : m),
        memoryIndicator: { type: 'update', title: updated.title },
      }));
      setTimeout(() => get().clearMemoryIndicator(), 2500);
    },

    deleteMemoryItem: async (id) => {
      const item = get().memory.find(m => m.id === id);
      await dbDeleteMemory(id);
      set(s => ({
        memory: s.memory.filter(m => m.id !== id),
        memoryIndicator: { type: 'delete', title: item?.title ?? '' },
      }));
      setTimeout(() => get().clearMemoryIndicator(), 2500);
    },

    clearMemory: async () => {
      await clearAllMemory();
      set({ memory: [] });
    },

    duplicateMemoryItem: async (id) => {
      const orig = get().memory.find(m => m.id === id);
      if (!orig) return;
      const copy: MemoryItem = { ...orig, id: genId(), title: `${orig.title} (copia)`, createdAt: Date.now(), updatedAt: Date.now() };
      await saveMemoryItem(copy);
      set(s => ({ memory: [copy, ...s.memory] }));
    },

    exportMemoryData: (format) => exportMemory(get().memory, format),

    importMemoryData: async (json) => {
      const items = parseMemoryImport(json);
      let count = 0;
      for (const p of items) {
        const item: MemoryItem = {
          id: genId(),
          title: p.title ?? '',
          content: p.content ?? '',
          category: (p.category as MemoryCategory) ?? 'otros',
          type: (p.type as MemoryType) ?? 'persistent',
          importance: (p.importance as MemoryImportance) ?? 'medium',
          tags: p.tags ?? [],
          source: 'manual',
          createdAt: p.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        };
        if (!isDuplicate(item, get().memory)) {
          await saveMemoryItem(item);
          set(s => ({ memory: [item, ...s.memory] }));
          count++;
        }
      }
      return count;
    },

    clearMemoryIndicator: () => set({ memoryIndicator: null }),
    setIsSpeaking: (v) => set({ isSpeaking: v }),
    setIsListening: (v) => set({ isListening: v }),
    addPendingFile: (file) => set(s => ({ pendingFiles: [...s.pendingFiles, file] })),
    removePendingFile: (id) => set(s => ({ pendingFiles: s.pendingFiles.filter(f => f.id !== id) })),
    clearPendingFiles: () => set({ pendingFiles: [] }),
    setSearchQuery: (q) => set({ searchQuery: q }),
  }))
);

export const useActiveChat = () =>
  useAppStore(s => s.chats.find(c => c.id === s.activeChatId) ?? null);
