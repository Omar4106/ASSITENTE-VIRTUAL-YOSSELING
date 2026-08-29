/**
 * YOSSELING TYPES — single source of truth.
 * No imports from other project files (avoid circular deps).
 */

export type Provider = 'auto' | 'openai' | 'groq' | 'openrouter' | 'gemini' | 'cerebras';

export type ModelId =
  | 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo'
  | 'llama-3.3-70b-versatile' | 'deepseek-r1-distill-llama-70b'
  | 'mixtral-8x7b-32768' | 'gemma2-9b-it' | 'qwen-qwq-32b'
  | 'gemini-2.5-flash-preview-05-20' | 'gemini-2.5-pro-preview-06-05'
  | 'qwen/qwen3-coder' | 'openrouter/gpt-oss-120b'
  | 'meta-llama/llama-3.3-70b-instruct'
  | 'anthropic/claude-3.5-sonnet' | 'anthropic/claude-3-opus'
  | 'google/gemini-2.5-pro-preview'
  | 'llama-3.3-70b' | 'llama-3.1-8b'
  | (string & {});  // allow dynamic model IDs

export interface ModelConfig {
  id: string;
  name: string;
  provider: Provider;
  description?: string;
  contextWindow?: number;
  isDefault?: boolean;
  supportsVision?: boolean;
  supportsImageGen?: boolean;
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
  model?: string;
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
  model: string;
  provider: Provider;
  isPinned?: boolean;
  isFavorite?: boolean;
  isShared?: boolean;
  shareId?: string;
}

// Enhanced MemoryItem
export type MemoryCategory =
  | 'personal' | 'trabajo' | 'estudios' | 'familia'
  | 'mascotas' | 'preferencias' | 'proyectos' | 'objetivos'
  | 'hobbies' | 'otros';
export type MemoryImportance = 'low' | 'medium' | 'high';
export type MemoryType = 'temporal' | 'persistent' | 'preference';

export interface MemoryItem {
  id: string;
  title: string;
  content: string;
  category: MemoryCategory;
  type: MemoryType;
  importance: MemoryImportance;
  tags: string[];
  source: 'auto' | 'manual';
  createdAt: number;
  updatedAt: number;
}

export type Theme = 'dark' | 'light';
export type Language = 'es' | 'en';
export type PersonalityStyle = 'profesional' | 'amigable' | 'creativa' | 'tecnica' | 'divertida' | 'formal';

export interface VoiceSettings {
  enabled: boolean;
  voiceName: string;
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
  defaultModel: string;
  defaultProvider: Provider;
  userName: string;
  voice: VoiceSettings;
  autoSave: boolean;
  streamingEnabled: boolean;
  showTokenCount: boolean;
  showResponseTime: boolean;
  memoryEnabled: boolean;
  memoryAutoSave: boolean;
  personality: PersonalityStyle;
}

export type SidebarView =
  | 'chats' | 'favorites' | 'pinned' | 'shared' | 'memory'
  | 'documents' | 'images' | 'printers' | 'settings' | 'shortcuts' | 'help';

export type RightPanelView = 'tools' | 'settings' | 'files' | 'memory';

export interface AICenterData {
  activeProvider: Provider;
  activeModel: string;
  status: 'idle' | 'streaming' | 'success' | 'error';
  latency: number;
  responseTime: number;
  tokens: number;
  costEstimate: number;
  providerUsed: Provider | null;
  discardedProviders: Provider[];
  fallbackUsed: boolean;
  fallbackChain: string;
}

export type TaskType =
  | 'chat' | 'code' | 'math' | 'document' | 'ocr'
  | 'translate' | 'analyze' | 'summarize' | 'write' | 'image_gen' | 'image_read';
