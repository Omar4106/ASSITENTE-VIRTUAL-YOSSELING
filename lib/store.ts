'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  Chat, Message, MemoryItem, AppSettings, ModelId, Provider,
  SidebarView, RightPanelView, AttachedFile
} from '@/types';
import {
  saveChat, getAllChats, deleteChat, clearAllChats,
  getAllMemory, saveMemoryItem, deleteMemoryItem, clearAllMemory,
  loadSettings, saveSettings, DEFAULT_SETTINGS
} from '@/lib/db';
import { getDefaultModel } from '@/lib/ai-config';

function genId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

interface AppState {
  // Chats
  chats: Chat[];
  activeChatId: string | null;

  // UI
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  sidebarView: SidebarView;
  rightPanelView: RightPanelView;
  isStreaming: boolean;
  abortController: AbortController | null;

  // Model
  selectedModel: ModelId;
  selectedProvider: Provider;

  // Settings
  settings: AppSettings;

  // Memory
  memory: MemoryItem[];

  // Voice
  isSpeaking: boolean;
  isListening: boolean;

  // Files
  pendingFiles: AttachedFile[];

  // Search
  searchQuery: string;

  // Actions
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
  setSelectedModel: (model: ModelId, provider: Provider) => void;
  setSidebarOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setSidebarView: (view: SidebarView) => void;
  setRightPanelView: (view: RightPanelView) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  loadMemory: () => Promise<void>;
  addMemoryItem: (key: string, value: string, category?: MemoryItem['category']) => Promise<void>;
  updateMemoryItem: (id: string, key: string, value: string) => Promise<void>;
  deleteMemoryItem: (id: string) => Promise<void>;
  clearMemory: () => Promise<void>;
  setIsSpeaking: (v: boolean) => void;
  setIsListening: (v: boolean) => void;
  addPendingFile: (file: AttachedFile) => void;
  removePendingFile: (id: string) => void;
  clearPendingFiles: () => void;
  setSearchQuery: (q: string) => void;
}

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
    selectedModel: getDefaultModel().id,
    selectedProvider: getDefaultModel().provider,
    settings: DEFAULT_SETTINGS,
    memory: [],
    isSpeaking: false,
    isListening: false,
    pendingFiles: [],
    searchQuery: '',

    initStore: async () => {
      const settings = loadSettings();
      const chats = await getAllChats();
      const memory = await getAllMemory();
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
      set(state => ({ chats: [chat, ...state.chats], activeChatId: chat.id }));
      saveChat(chat);
    },

    setActiveChat: (id: string) => {
      set({ activeChatId: id });
    },

    deleteChat: async (id: string) => {
      await deleteChat(id);
      set(state => {
        const chats = state.chats.filter(c => c.id !== id);
        const activeChatId = state.activeChatId === id ? (chats[0]?.id ?? null) : state.activeChatId;
        return { chats, activeChatId };
      });
    },

    clearAllChats: async () => {
      await clearAllChats();
      set({ chats: [], activeChatId: null });
    },

    importChats: async (imported: Chat[]) => {
      const existing = get().chats;
      const existingIds = new Set(existing.map(c => c.id));
      const toAdd = imported.filter(c => !existingIds.has(c.id));
      for (const chat of toAdd) {
        await saveChat(chat);
      }
      set(s => ({
        chats: [...toAdd, ...s.chats].sort((a, b) => b.updatedAt - a.updatedAt),
      }));
    },

    sendMessage: async (content: string, files?: AttachedFile[]) => {
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

      const userMessage: Message = {
        id: genId(),
        role: 'user',
        content,
        timestamp: Date.now(),
        attachments: files && files.length > 0 ? files : undefined,
      };

      const assistantMessage: Message = {
        id: genId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        model: state.selectedModel,
        provider: state.selectedProvider,
        isStreaming: true,
      };

      const updatedMessages = [...(chat.messages ?? []), userMessage, assistantMessage];
      const updatedChat: Chat = {
        ...chat,
        messages: updatedMessages,
        updatedAt: Date.now(),
        title: chat.messages.length === 0 ? (content.slice(0, 40) || 'Nuevo Chat') : chat.title,
      };

      set(s => ({
        isStreaming: true,
        chats: s.chats.map(c => c.id === chatId ? updatedChat : c),
      }));

      const controller = new AbortController();
      set({ abortController: controller });

      const startTime = Date.now();

      try {
        // Use unified AI router endpoint for all providers
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages.filter(m => m.role !== 'assistant' || !m.isStreaming).map(m => ({
              role: m.role,
              content: m.content,
              attachments: m.attachments,
            })),
            model: state.selectedModel,
            provider: state.selectedProvider,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content ?? parsed.text ?? '';
                if (delta) {
                  fullContent += delta;
                  set(s => ({
                    chats: s.chats.map(c => {
                      if (c.id !== chatId) return c;
                      return {
                        ...c,
                        messages: c.messages.map(m =>
                          m.id === assistantMessage.id
                            ? { ...m, content: fullContent }
                            : m
                        ),
                      };
                    }),
                  }));
                }
              } catch {}
            }
          }
        }

        const responseTime = Date.now() - startTime;
        const finalChat = get().chats.find(c => c.id === chatId);
        if (finalChat) {
          const saved: Chat = {
            ...finalChat,
            messages: finalChat.messages.map(m =>
              m.id === assistantMessage.id
                ? { ...m, isStreaming: false, responseTime }
                : m
            ),
            updatedAt: Date.now(),
          };
          set(s => ({ chats: s.chats.map(c => c.id === chatId ? saved : c) }));
          await saveChat(saved);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          const errorMsg = 'Lo siento, ocurrió un error al procesar tu solicitud. Por favor, verifica tu configuración e intenta de nuevo.';
          set(s => ({
            chats: s.chats.map(c => {
              if (c.id !== chatId) return c;
              return {
                ...c,
                messages: c.messages.map(m =>
                  m.id === assistantMessage.id
                    ? { ...m, content: errorMsg, isStreaming: false }
                    : m
                ),
              };
            }),
          }));
          const errChat = get().chats.find(c => c.id === chatId);
          if (errChat) await saveChat(errChat);
        }
      } finally {
        set({ isStreaming: false, abortController: null });
      }
    },

    stopStreaming: () => {
      const { abortController } = get();
      if (abortController) {
        abortController.abort();
        set({ isStreaming: false, abortController: null });
      }
    },

    editMessage: async (chatId, messageId, content) => {
      set(s => ({
        chats: s.chats.map(c => {
          if (c.id !== chatId) return c;
          return { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, content } : m) };
        }),
      }));
      const chat = get().chats.find(c => c.id === chatId);
      if (chat) await saveChat(chat);
    },

    deleteMessage: async (chatId, messageId) => {
      set(s => ({
        chats: s.chats.map(c => {
          if (c.id !== chatId) return c;
          return { ...c, messages: c.messages.filter(m => m.id !== messageId) };
        }),
      }));
      const chat = get().chats.find(c => c.id === chatId);
      if (chat) await saveChat(chat);
    },

    regenerateResponse: async (chatId, messageId) => {
      const chat = get().chats.find(c => c.id === chatId);
      if (!chat) return;
      const msgIdx = chat.messages.findIndex(m => m.id === messageId);
      if (msgIdx < 0) return;
      // Find the last user message at or before the assistant message being regenerated
      let lastUserIdx = -1;
      for (let i = msgIdx; i >= 0; i--) {
        if (chat.messages[i].role === 'user') { lastUserIdx = i; break; }
      }
      if (lastUserIdx < 0) return;
      const lastUser = chat.messages[lastUserIdx];
      // Remove everything from the last user message onward, then re-send
      const messagesBefore = chat.messages.slice(0, lastUserIdx);
      set(s => ({
        chats: s.chats.map(c => c.id === chatId ? { ...c, messages: messagesBefore } : c),
        activeChatId: chatId,
      }));
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

    setSelectedModel: (model, provider) => {
      set({ selectedModel: model, selectedProvider: provider });
    },

    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
    setSidebarView: (view) => set({ sidebarView: view }),
    setRightPanelView: (view) => set({ rightPanelView: view }),

    updateSettings: (partial) => {
      const newSettings = { ...get().settings, ...partial };
      set({ settings: newSettings });
      saveSettings(newSettings);
    },

    loadMemory: async () => {
      const memory = await getAllMemory();
      set({ memory });
    },

    addMemoryItem: async (key, value, category = 'other') => {
      const item: MemoryItem = {
        id: genId(),
        key,
        value,
        category,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveMemoryItem(item);
      set(s => ({ memory: [item, ...s.memory] }));
    },

    updateMemoryItem: async (id, key, value) => {
      const updated: MemoryItem = {
        ...get().memory.find(m => m.id === id)!,
        key,
        value,
        updatedAt: Date.now(),
      };
      await saveMemoryItem(updated);
      set(s => ({ memory: s.memory.map(m => m.id === id ? updated : m) }));
    },

    deleteMemoryItem: async (id) => {
      await deleteMemoryItem(id);
      set(s => ({ memory: s.memory.filter(m => m.id !== id) }));
    },

    clearMemory: async () => {
      await clearAllMemory();
      set({ memory: [] });
    },

    setIsSpeaking: (v) => set({ isSpeaking: v }),
    setIsListening: (v) => set({ isListening: v }),
    addPendingFile: (file) => set(s => ({ pendingFiles: [...s.pendingFiles, file] })),
    removePendingFile: (id) => set(s => ({ pendingFiles: s.pendingFiles.filter(f => f.id !== id) })),
    clearPendingFiles: () => set({ pendingFiles: [] }),
    setSearchQuery: (q) => set({ searchQuery: q }),
  }))
);

export const useActiveChat = () =>
  useAppStore(state => state.chats.find(c => c.id === state.activeChatId) ?? null);
