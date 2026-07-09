/**
 * YOSSELING TYPES
 * Single source of truth for all shared types.
 * NO imports from other files here to avoid circular dependencies.
 */

// Providers must match keys in lib/ai-config.ts PROVIDER_CONFIG
export type Provider = 'openai' | 'groq' | 'openrouter' | 'gemini' | 'cerebras';

// Model IDs must match models defined in lib/ai-config.ts
export type ModelId =
  // OpenAI
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  // Groq
  | 'llama-3.3-70b-versatile'
  | 'deepseek-r1-distill-llama-70b'
  | 'mixtral-8x7b-32768'
  | 'gemma2-9b-it'
  | 'qwen-qwq-32b'
  // Gemini - ACTUAL VALID MODELS ONLY
  | 'gemini-2.5-flash-preview-05-20'
  | 'gemini-2.5-pro-preview-06-05'
  // OpenRouter
  | 'qwen/qwen3-coder'
  | 'openrouter/gpt-oss-120b'
  | 'meta-llama/llama-3.3-70b-instruct'
  | 'anthropic/claude-3.5-sonnet'
  | 'anthropic/claude-3-opus'
  | 'google/gemini-2.5-pro-preview'
  // Cerebras
  | 'llama-3.3-70b'
  | 'llama-3.1-8b';

export interface ModelConfig {
  id: ModelId;
  name: string;
  provider: Provider;
  description?: string;
  contextWindow?: number;
  isDefault?: boolean;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string;
  dataUrl?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  model?: ModelId;
  provider?: Provider;
  attachments?: AttachedFile[];
  isStreaming?: boolean;
  responseTime?: number;
  tokenCount?: number;
  isFavorite?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model: ModelId;
  provider: Provider;
  isPinned?: boolean;
  isFavorite?: boolean;
  isShared?: boolean;
  shareId?: string;
}

export interface MemoryItem {
  id: string;
  key: string;
  value: string;
  createdAt: number;
  updatedAt: number;
  category?: 'preference' | 'fact' | 'instruction' | 'other';
}

export type Theme = 'dark' | 'light';
export type Language = 'es' | 'en';
export type VoiceName = string;

export interface VoiceSettings {
  enabled: boolean;
  voiceName: VoiceName;
  rate: number;
  pitch: number;
  volume: number;
  language: Language;
}

export interface AppSettings {
  theme: Theme;
  language: Language;
  fontSize: 'small' | 'medium' | 'large';
  primaryColor: string;
  defaultModel: ModelId;
  defaultProvider: Provider;
  userName: string;
  voice: VoiceSettings;
  autoSave: boolean;
  streamingEnabled: boolean;
  showTokenCount: boolean;
  showResponseTime: boolean;
}

export type SidebarView =
  | 'chats'
  | 'favorites'
  | 'pinned'
  | 'shared'
  | 'memory'
  | 'documents'
  | 'images'
  | 'printers'
  | 'settings'
  | 'shortcuts'
  | 'help';

export type RightPanelView = 'tools' | 'settings' | 'files' | 'memory';

export interface PrinterInfo {
  name: string;
  status: string;
}

export interface AIRouterResult {
  provider: Provider;
  model: string;
  content: string;
  responseTime: number;
  fallbackUsed: boolean;
  originalProvider?: Provider;
  triedProviders?: Provider[];
  error?: string;
}

export interface AICenterInfo {
  activeProvider: Provider | null;
  activeModel: string | null;
  status: 'idle' | 'connecting' | 'streaming' | 'error' | 'success';
  latency: number;
  responseTime: number;
  tokens: number;
  estimatedCost: number;
  fallbackUsed: boolean;
  fallbackFrom?: Provider;
  triedProviders: Provider[];
}
