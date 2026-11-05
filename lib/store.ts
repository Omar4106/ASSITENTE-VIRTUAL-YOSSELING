'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  Chat, Message, MemoryItem, AppSettings, Provider,
  SidebarView, RightPanelView, AttachedFile, AICenterData,
  MemoryCategory, MemoryImportance, MemoryType, ConversationSection, ImageGenerationProvider,
  WorkspaceFile, WorkspacePanelTab, SearchResult,
} from '@/types';
import {
  saveChat, getAllChats, deleteChat as dbDeleteChat, clearAllChats as dbClearChats,
  getAllMemory, saveMemoryItem, deleteMemoryItem as dbDeleteMemory,
  clearAllMemory, loadSettings, saveSettings, DEFAULT_SETTINGS,
} from '@/lib/db';
import { getDefaultModel } from '@/lib/ai-config';
import { detectMemory, isDuplicate, createMemoryItem, parseMemoryImport, updateAdaptiveProfile, buildMemoryContext, exportMemory } from '@/lib/memory';
import { detectMediaGenerationIntent, isImageGenerationRequest, isOfflineModeIntent, isAffirmation, isOptimizationRequest, detectPlatform } from '@/lib/image-intent';
import { generateOptimizationScript } from '@/lib/optimization';
import { sendThroughYosseling } from '@/lib/yosseling-engine';

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
  workspaceFiles: WorkspaceFile[];
  activeWorkspaceFile: string | null;
  workspacePanelTab: WorkspacePanelTab;
  composerDraft: string;
  isWorkspaceOpen: boolean;
  previewUrl: string | null;
  isPreviewLoading: boolean;
  searchEngine: {
    enabled: boolean;
    query: string | null;
    results: SearchResult[];
    loading: boolean;
    timestamp: number | null;
  };
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
  loadMemory: () => Promise<void>;
  addMemoryItem: (item: Partial<MemoryItem>) => Promise<MemoryItem | null>;
  updateMemoryItem: (id: string, updates: Partial<MemoryItem>) => Promise<void>;
  deleteMemoryItem: (id: string) => Promise<void>;
  clearMemory: () => Promise<void>;
  duplicateMemoryItem: (id: string) => Promise<void>;
  exportMemoryData: (format: 'json' | 'txt' | 'md') => string;
  importMemoryData: (json: string) => Promise<number>;
  clearMemoryIndicator: () => void;
  setIsSpeaking: (v: boolean) => void;
  setIsListening: (v: boolean) => void;
  addPendingFile: (file: AttachedFile) => void;
  removePendingFile: (id: string) => void;
  clearPendingFiles: () => void;
  setSearchQuery: (q: string) => void;
  setWorkspaceFiles: (files: WorkspaceFile[]) => void;
  setActiveWorkspaceFile: (id: string | null) => void;
  setWorkspacePanelTab: (tab: WorkspacePanelTab) => void;
  setComposerDraft: (draft: string) => void;
  setIsWorkspaceOpen: (open: boolean) => void;
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
    rightPanelOpen: false,
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
    workspaceFiles: [],
    activeWorkspaceFile: null,
    workspacePanelTab: 'preview',
    composerDraft: '',
    isWorkspaceOpen: false,
    previewUrl: null,
    isPreviewLoading: false,
    searchEngine: {
      enabled: false,
      query: null,
      results: [],
      loading: false,
      timestamp: null,
    },
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
      set(s => ({
        chats: [chat, ...s.chats],
        activeChatId: chat.id,
        isWorkspaceOpen: false,
        workspacePanelTab: 'preview',
      }));
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
      };
      const updatedMessages = [...(chat.messages ?? []), userMsg, assistantMsg];
      const updatedChat: Chat = {
        ...chat,
        messages: updatedMessages,
        updatedAt: Date.now(),
      };
      set(s => ({
        isStreaming: true,
        chats: s.chats.map(c => c.id === chatId ? updatedChat : c),
      }));
      const controller = new AbortController();
      set({ abortController: controller });
      const startTime = Date.now();
      try {
        const memCtx = buildMemoryContext(get().memory);
        const allMsgs = updatedMessages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }));
        const decoder = new TextDecoder();
        const streamResponse = async (requestMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) => {
          const { response: liveResponse } = await sendThroughYosseling({
            messages: requestMessages,
            model: state.selectedModel,
            provider: state.selectedProvider,
            autoRoute: state.selectedProvider === 'auto',
            personality: get().settings.personality,
            memoryContext: memCtx,
            adaptiveProfile: get().settings.adaptiveProfile,
            signal: controller.signal,
          });
          if (!liveResponse.ok) throw new Error('HTTP ' + liveResponse.status);
          const streamReader = liveResponse.body?.getReader();
          if (!streamReader) throw new Error('No stream');
          let text = '';
          let buffer = '';
          while (true) {
            const { done, value } = await streamReader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content ?? '';
                if (delta) text += delta;
              } catch {
                // Ignore JSON chunks that are not content.
              }
            }
          }
          return {
            text,
            usedProvider: (liveResponse.headers.get('X-Provider') ?? state.selectedProvider) as Provider,
            usedModel: liveResponse.headers.get('X-Model') ?? state.selectedModel,
          };
        };

        let fullContent = '';
        let resumeAttempts = 0;
        let usedProvider = state.selectedProvider as Provider;
        let usedModel = state.selectedModel;

        const continuationMessage = (partial: string) => ({
          role: 'user' as const,
          content: `La respuesta anterior quedó cortada o incompleta. Continua desde el punto exacto de corte y finaliza la estructura correctamente. No repitas el contenido previo; añade solo la continuación final.\n\nContexto exacto:\n${partial.slice(-1500)}`,
        });

        while (resumeAttempts < 2) {
          const requestMessages = resumeAttempts === 0 ? allMsgs : [...allMsgs, continuationMessage(fullContent || content)];
          const { text, usedProvider: nextProvider, usedModel: nextModel } = await streamResponse(requestMessages);
          fullContent = resumeAttempts === 0 ? text : `${fullContent}${text}`;
          usedProvider = nextProvider;
          usedModel = nextModel;
          set(s => ({
            chats: s.chats.map(c => c.id !== chatId ? c : { ...c, messages: c.messages.map(m => m.id === assistantMsg.id ? { ...m, content: resumeAttempts > 0 ? 'Completando documento...' : fullContent } : m) }),
          }));
          if (!isLikelyIncompleteArtifact(fullContent)) break;
          resumeAttempts += 1;
        }
        const finalChat = get().chats.find(c => c.id === chatId);
        if (finalChat) {
          const saved: Chat = {
            ...finalChat,
            messages: finalChat.messages.map(m => m.id === assistantMsg.id ? { ...m, isStreaming: false, provider: usedProvider, model: usedModel, content: fullContent } : m),
            updatedAt: Date.now(),
          };
          set(s => ({ chats: s.chats.map(c => c.id === chatId ? saved : c) }));
          await saveChat(saved);
          extractAndSyncWorkspaceFiles(fullContent);
          checkAndTriggerWebSearch(fullContent);
        }
      } catch (err) {
        console.error(err);
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
        chats: s.chats.map(c => c.id !== chatId ? c : { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, content } : m) }),
      }));
      const chat = get().chats.find(c => c.id === chatId);
      if (chat) await saveChat(chat);
    },
    deleteMessage: async (chatId, msgId) => {
      set(s => ({
        chats: s.chats.map(c => c.id !== chatId ? c : { ...c, messages: c.messages.filter(m => m.id !== msgId) }),
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
    setIsWorkspaceOpen: (open) => set({ isWorkspaceOpen: open }),
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
      set(s => ({ memory: [base, ...s.memory] }));
      return base;
    },
    updateMemoryItem: async (id, updates) => {
      const cur = get().memory.find(m => m.id === id);
      if (!cur) return;
      const updated: MemoryItem = { ...cur, ...updates, updatedAt: Date.now() } as MemoryItem;
      await saveMemoryItem(updated);
      set(s => ({ memory: s.memory.map(m => m.id === id ? updated : m) }));
    },
    deleteMemoryItem: async (id) => {
      await dbDeleteMemory(id);
      set(s => ({ memory: s.memory.filter(m => m.id !== id) }));
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
    setWorkspaceFiles: (files) => set({ workspaceFiles: files }),
    setActiveWorkspaceFile: (id) => set({ activeWorkspaceFile: id }),
    setWorkspacePanelTab: (tab) => set({ workspacePanelTab: tab }),
    setComposerDraft: (draft) => set({ composerDraft: draft }),
  }))
);

export const useActiveChat = () =>
  useAppStore(s => s.chats.find(c => c.id === s.activeChatId) ?? null);

export const useAppStoreForSettings = useAppStore;

function isLikelyIncompleteArtifact(content: string): boolean {
  if (!content || content.length < 80) return false;
  const trimmed = content.trim();
  const opens = (trimmed.match(/\{/g) ?? []).length + (trimmed.match(/\[/g) ?? []).length + (trimmed.match(/\(/g) ?? []).length;
  const closes = (trimmed.match(/\}/g) ?? []).length + (trimmed.match(/\]/g) ?? []).length + (trimmed.match(/\)/g) ?? []).length;
  const hasToolJunk = /<\s*(?:tool_call|function)[\s\S]*$/i.test(trimmed) || /\b(?:\/|\\)(?:Users|home|workspace|testbed|tmp|var|opt|root|private|mnt)[^\s\n\r)\]]*$/i.test(trimmed);
  const hasUnclosedMarkdown = /```(?:[a-zA-Z0-9_-]+)?\s*$/m.test(trimmed) || /^\s*#+\s+.*$/m.test(trimmed) && !/\n\s*$/m.test(trimmed);
  return opens > closes || hasToolJunk || hasUnclosedMarkdown;
}

function inferArtifactMeta(content: string, pathHint?: string) {
  const normalized = content.trim();
  if (!normalized) {
    return { language: 'markdown', path: pathHint ?? 'document.md', tab: 'preview' as const };
  }

  const lowerPath = (pathHint ?? '').toLowerCase();
  const knownLanguage = lowerPath.endsWith('.tsx') || lowerPath.endsWith('.jsx') || lowerPath.endsWith('.ts') || lowerPath.endsWith('.js') || lowerPath.endsWith('.py') || lowerPath.endsWith('.html') || lowerPath.endsWith('.css') || lowerPath.endsWith('.json') || lowerPath.endsWith('.md') ? lowerPath.split('.').pop() ?? '' : '';

  if (lowerPath.endsWith('.html') || /<!doctype html|<html|<body|<div|<section|<main/i.test(normalized)) {
    return { language: 'html', path: pathHint ?? 'artifact.html', tab: 'preview' as const };
  }

  if (lowerPath.endsWith('.md') || /^(#\s|\n#\s|[-*]\s|\d+\.\s)/m.test(normalized) || /```markdown/i.test(normalized)) {
    return { language: 'markdown', path: pathHint ?? 'document.md', tab: 'preview' as const };
  }

  if (lowerPath.endsWith('.json') || /^\s*[\[{]/.test(normalized)) {
    try {
      JSON.parse(normalized);
      return { language: 'json', path: pathHint ?? 'artifact.json', tab: 'code' as const };
    } catch {
      // fall through to other detection
    }
  }

  if (lowerPath.endsWith('.py') || /^(from\s+\w+\s+import|import\s+\w+|def\s+\w+\s*\(|class\s+\w+\s*\(|if\s+__name__\s*==\s*['\"]__main__['\"])/m.test(normalized)) {
    return { language: 'python', path: pathHint ?? 'script.py', tab: 'code' as const };
  }

  if (lowerPath.endsWith('.tsx') || lowerPath.endsWith('.jsx') || /export\s+(default\s+)?function|const\s+\w+\s*=\s*\(|return\s*\(\s*<|import\s+React/i.test(normalized)) {
    return { language: 'tsx', path: pathHint ?? 'Component.tsx', tab: 'code' as const };
  }

  if (lowerPath.endsWith('.ts') || lowerPath.endsWith('.js') || /const\s+\w+\s*=|function\s+\w+\s*\(|console\.log\(|export\s+\{/.test(normalized)) {
    return { language: 'typescript', path: pathHint ?? 'script.ts', tab: 'code' as const };
  }

  if (lowerPath.endsWith('.css') || /\.[A-Za-z-]+\s*\{|#\w+\s*\{|display:\s*flex|@media/i.test(normalized)) {
    return { language: 'css', path: pathHint ?? 'styles.css', tab: 'code' as const };
  }

  if (knownLanguage) {
    return { language: knownLanguage, path: pathHint ?? `artifact.${knownLanguage}`, tab: knownLanguage === 'html' || knownLanguage === 'md' || knownLanguage === 'markdown' ? 'preview' as const : 'code' as const };
  }

  return { language: 'markdown', path: pathHint ?? 'document.md', tab: 'preview' as const };
}

function upsertWorkspaceArtifact(currentFiles: Array<{ id: string; path: string; content: string; language: string; type: string; isModified: boolean; createdAt: number; updatedAt: number }>, filePath: string, content: string, language: string, tab: 'preview' | 'code') {
  const existingIndex = currentFiles.findIndex(f => f.path === filePath);
  if (existingIndex >= 0) {
    const current = currentFiles[existingIndex];
    if (current.content !== content) {
      currentFiles[existingIndex] = {
        ...current,
        content,
        language: language as any,
        type: filePath.includes('components/') ? 'component' : filePath.includes('styles') ? 'style' : 'page',
        isModified: true,
        updatedAt: Date.now(),
      };
    }
    return { modified: current.content !== content, nextTab: tab };
  }

  currentFiles.push({
    id: crypto.randomUUID(),
    path: filePath,
    content,
    language: language as any,
    type: filePath.includes('components/') ? 'component' : filePath.includes('styles') ? 'style' : 'page',
    isModified: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return { modified: true, nextTab: tab };
}

function extractAndSyncWorkspaceFiles(content: string) {
  if (typeof window === 'undefined' || !content) return;

  const codeBlockRegex = /```([a-zA-Z0-9_-]+)?(?:\s*(?:\/\/|#|--)\s*([^\n]+))?\n([\s\S]*?)```/g;
  const currentFiles = [...useAppStore.getState().workspaceFiles];
  let match;
  let modified = false;
  let nextTab: 'preview' | 'code' = 'preview';

  codeBlockRegex.lastIndex = 0;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const rawLanguage = ((match[1] ?? 'typescript').toLowerCase().trim());
    const pathHint = match[2]?.trim();
    const codeContent = match[3]?.trim();

    if (!codeContent) continue;

    const knownLanguages = new Set(['tsx', 'jsx', 'ts', 'js', 'py', 'html', 'css', 'json', 'markdown', 'md']);
    const inferred = inferArtifactMeta(codeContent, pathHint);
    const language = knownLanguages.has(rawLanguage) ? rawLanguage : inferred.language;
    const resolvedPath = pathHint ?? inferred.path;
    const resolvedTab = rawLanguage === 'markdown' || rawLanguage === 'html' || inferred.tab === 'preview' ? 'preview' : 'code';

    const result = upsertWorkspaceArtifact(currentFiles, resolvedPath, codeContent, language, resolvedTab);
    modified = modified || result.modified;
    nextTab = result.nextTab;
  }

  codeBlockRegex.lastIndex = 0;
  const trimmed = content.trim();
  if (!codeBlockRegex.test(content) && trimmed.length > 0) {
    const fallbackMeta = inferArtifactMeta(trimmed, 'document.md');
    const fallbackResult = upsertWorkspaceArtifact(currentFiles, fallbackMeta.path, trimmed, fallbackMeta.language, fallbackMeta.tab);
    modified = modified || fallbackResult.modified;
    nextTab = fallbackResult.nextTab;
  }

  if (modified) {
    useAppStore.setState({
      workspaceFiles: currentFiles,
      rightPanelOpen: true,
      isWorkspaceOpen: true,
      workspacePanelTab: nextTab,
    });
    if (!useAppStore.getState().activeWorkspaceFile && currentFiles.length > 0) {
      useAppStore.setState({ activeWorkspaceFile: currentFiles[0].id });
    } else if (currentFiles.length > 0) {
      const active = useAppStore.getState().activeWorkspaceFile ?? currentFiles[currentFiles.length - 1].id;
      useAppStore.setState({ activeWorkspaceFile: active });
    }
  }
}

async function checkAndTriggerWebSearch(content: string) {
  if (typeof window === 'undefined' || !content) return;
  const searchRegex = /\[BUSCAR_WEB:\s*([^\]]+)\]/i;
  const match = content.match(searchRegex);
  if (!match) return;

  const query = match[1].trim();
  useAppStore.setState({
    searchEngine: {
      enabled: true,
      query,
      results: [],
      loading: true,
      timestamp: Date.now()
    }
  });

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.success && data.results) {
      useAppStore.setState(s => ({
        searchEngine: {
          ...s.searchEngine,
          results: data.results,
          loading: false
        }
      }));
    } else {
      useAppStore.setState(s => ({
        searchEngine: { ...s.searchEngine, loading: false }
      }));
    }
  } catch (err) {
    console.error('[Web Search Trigger Error]:', err);
    useAppStore.setState(s => ({
      searchEngine: { ...s.searchEngine, loading: false }
    }));
  }
}
