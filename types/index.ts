export type Provider = 'openai' | 'gemini' | 'groq';

export type ModelId =
  // OpenAI
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  // Gemini
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'
  // Groq
  | 'llama-3.3-70b-versatile'
  | 'deepseek-r1-distill-llama-70b'
  | 'mixtral-8x7b-32768'
  | 'gemma2-9b-it'
  | 'qwen-qwq-32b';

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
