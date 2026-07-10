'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  Chat, Message, MemoryItem, AppSettings, Provider,
  SidebarView, RightPanelView, AttachedFile, AICenterData,
  MemoryCategory, MemoryImportance, MemoryType,
} from '@/types';
import {
  saveChat, getAllChats, deleteChat as dbDeleteChat, clearAllChats as dbClearChats,
  getAllMemory, saveMemoryItem, deleteMemoryItem as dbDeleteMemory,
  clearAllMemory, loadSettings, saveSettings, DEFAULT_SETTINGS,
} from '@/lib/db';
import { getDefaultModel } from '@/lib/ai-config';
import { buildMemoryContext, detectMemory, isDuplicate, createMemoryItem, exportMemory, parseMemoryImport } from '@/lib/memory';

function genId() {
  return Math.random().toString(36).slice(2, 11) + Math.random().toString(36).slice(2, 11);
}

interface AppState {
  chats: Chat[];
  activeChatId: string | null;
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

  // Core
  initStore: () => Promise<void>;
  createNewChat: () => void;
  setActiveChat: (id: string) => void;
  deleteChat: (id: string) => Promise<void>;
  clearAllChats: () => Promise<void>;
  importChats: (chats: Chat[]) => Promise<void>;
  sendMessage: (content: string, files?: AttachedFile[]) => Promise<void>;
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

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    chats: [],
    activeChatId: null,
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

    initStore: async () => {
      const settings = loadSettings();
      const [chats, memory] = await Promise.all([getAllChats(), getAllMemory()]);
      set({
        settings,
        chats,
        memory,
        selectedModel: settings.defaultModel,
        selectedProvider: settings.defaultProvider,
      });
    },

    createNewChat: () => {
      const { selectedModel, selectedProvider } = get();
      const chat: Chat = {
        id: genId(),
        title: 'Nuevo Chat',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: selectedModel,
        provider: selectedProvider,
      };
      set(s => ({ chats: [chat, ...s.chats], activeChatId: chat.id }));
      saveChat(chat);
    },

    setActiveChat: (id) => set({ activeChatId: id }),

    deleteChat: async (id) => {
      await dbDeleteChat(id);
      set(s => {
        const chats = s.chats.filter(c => c.id !== id);
        return { chats, activeChatId: s.activeChatId === id ? (chats[0]?.id ?? null) : s.activeChatId };
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

    sendMessage: async (content, files) => {
      const state = get();
      let chat = state.chats.find(c => c.id === state.activeChatId) ?? null;
      let chatId = state.activeChatId;

      if (!chat) {
        const newChat: Chat = {
          id: genId(),
          title: content.slice(0, 40) || 'Nuevo Chat',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: state.selectedModel,
          provider: state.selectedProvider,
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
        attachments: files?.length ? files : undefined,
      };
      const assistantMsg: Message = {
        id: genId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        model: state.selectedModel,
        provider: state.selectedProvider,
        isStreaming: true,
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

      try {
        const memCtx = buildMemoryContext(get().memory);
        const chatMsgs = updatedMessages
          .filter(m => !(m.role === 'assistant' && m.isStreaming))
          .map(m => ({ role: m.role, content: m.content }));

        // Build the payload — include image data if files are attached
        const hasImages = files?.some(f => f.type.startsWith('image/') && f.dataUrl);
        const messagePayload = hasImages
          ? chatMsgs.map((m, i) => {
              if (i === chatMsgs.length - 1 && m.role === 'user' && files?.length) {
                return {
                  ...m,
                  attachments: files.map(f => ({
                    name: f.name,
                    type: f.type,
                    dataUrl: f.dataUrl,
                    content: f.content,
                  })),
                };
              }
              return m;
            })
          : chatMsgs;

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messagePayload,
            model: state.selectedModel,
            provider: state.selectedProvider === 'auto' ? null : state.selectedProvider,
            autoRoute: state.selectedProvider === 'auto',
            personality: get().settings.personality,
            memoryContext: memCtx,
          }),
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
              if (delta) {
                fullContent += delta;
                tokenCount++;
                set(s => ({
                  chats: s.chats.map(c => {
                    if (c.id !== chatId) return c;
                    return {
                      ...c,
                      messages: c.messages.map(m =>
                        m.id === assistantMsg.id ? { ...m, content: fullContent, provider: usedProvider, model: usedModel } : m
                      ),
                    };
                  }),
                }));
              }
            } catch { /* skip */ }
          }
        }

        const responseTime = Date.now() - startTime;
        const finalChat = get().chats.find(c => c.id === chatId);
        if (finalChat) {
          const saved: Chat = {
            ...finalChat,
            messages: finalChat.messages.map(m =>
              m.id === assistantMsg.id
                ? { ...m, isStreaming: false, responseTime, tokenCount, provider: usedProvider, model: usedModel }
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

        // Auto-detect memory
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
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('[Yosseling] sendMessage error:', err);
          set(s => ({
            chats: s.chats.map(c => {
              if (c.id !== chatId) return c;
              return {
                ...c,
                messages: c.messages.map(m =>
                  m.id === assistantMsg.id
                    ? { ...m, content: 'Lo siento, no pude procesar tu solicitud en este momento. Por favor, intenta de nuevo.', isStreaming: false }
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
