/**
 * YOSSELING AI CONFIGURATION
 * Single source of truth: providers, models, routing, personality.
 */
import type { Provider, TaskType } from '@/types';

export type { Provider };

// ============================================================
// GENERATION SETTINGS
// ============================================================
export const AI_SETTINGS = {
  temperature: 0.75,
  maxTokens: 4096,
  stream: true,
  timeout: 60000,
} as const;

// ============================================================
// FALLBACK CHAIN
// Groq first (fastest, free) → OpenRouter → Gemini → Cerebras → OpenAI
// ============================================================
export const FALLBACK_ORDER: Provider[] = ['groq', 'openrouter', 'gemini', 'cerebras', 'openai'];

// ============================================================
// TASK → PROVIDER ROUTING
// ============================================================
export const TASK_ROUTING: Record<TaskType, Provider> = {
  chat:       'groq',
  code:       'openrouter',
  math:       'groq',
  document:   'gemini',
  ocr:        'gemini',
  translate:  'groq',
  analyze:    'gemini',
  summarize:  'groq',
  write:      'groq',
  image_gen:  'openai',   // only OpenAI DALL-E for generation
  image_read: 'gemini',   // Gemini for vision/reading images
};

// ============================================================
// PROVIDER CONFIGURATION
// ============================================================
export interface ProviderModel {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  isDefault?: boolean;
  supportsVision?: boolean;
  supportsImageGen?: boolean;
}

export interface ProviderConfigType {
  name: string;
  color: string;
  apiBaseUrl: string;
  envKey: string;
  models: ProviderModel[];
}

export const PROVIDER_CONFIG: Record<Exclude<Provider, 'auto'>, ProviderConfigType> = {
  openai: {
    name: 'OpenAI',
    color: '#10A37F',
    apiBaseUrl: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Multimodal, most capable', contextWindow: 128000, supportsVision: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and efficient', contextWindow: 128000, isDefault: true, supportsVision: true },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Powerful reasoning', contextWindow: 128000 },
    ],
  },
  groq: {
    name: 'Groq',
    color: '#F55036',
    apiBaseUrl: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Ultra-fast inference', contextWindow: 32768, isDefault: true },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1', description: 'Advanced reasoning', contextWindow: 32768 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Mixture of experts', contextWindow: 32768 },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B', description: 'Google open model', contextWindow: 8192 },
      { id: 'qwen-qwq-32b', name: 'Qwen QwQ 32B', description: 'Reasoning model', contextWindow: 32768 },
    ],
  },
  gemini: {
    name: 'Gemini',
    color: '#4285F4',
    apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    envKey: 'GEMINI_API_KEY',
    models: [
      {
        id: 'gemini-2.5-flash-preview-05-20',
        name: 'Gemini 2.5 Flash',
        description: 'Fast multimodal — vision, OCR, docs',
        contextWindow: 1000000,
        isDefault: true,
        supportsVision: true,
      },
      {
        id: 'gemini-2.5-pro-preview-06-05',
        name: 'Gemini 2.5 Pro',
        description: 'Most capable — complex analysis',
        contextWindow: 1000000,
        supportsVision: true,
      },
    ],
  },
  openrouter: {
    name: 'OpenRouter',
    color: '#6366F1',
    // CRITICAL: must use /chat/completions path
    apiBaseUrl: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', description: 'Meta latest Llama', contextWindow: 131072, isDefault: true },
      { id: 'qwen/qwen3-coder', name: 'Qwen3 Coder', description: 'Advanced coding', contextWindow: 131072 },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', description: 'Reasoning model', contextWindow: 64000 },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Via OpenRouter', contextWindow: 200000, supportsVision: true },
      { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', description: 'Via OpenRouter', contextWindow: 1000000, supportsVision: true },
    ],
  },
  cerebras: {
    name: 'Cerebras',
    color: '#00D9FF',
    apiBaseUrl: 'https://api.cerebras.ai/v1',
    envKey: 'CEREBRAS_API_KEY',
    models: [
      { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', description: 'Ultra-fast Cerebras', contextWindow: 8192, isDefault: true },
      { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', description: 'Fast & efficient', contextWindow: 8192 },
    ],
  },
};

// ============================================================
// DERIVED EXPORTS (backwards-compat helpers)
// ============================================================
export const ALL_PROVIDERS = Object.keys(PROVIDER_CONFIG) as Exclude<Provider, 'auto'>[];

export const ALL_MODELS = ALL_PROVIDERS.flatMap(p =>
  PROVIDER_CONFIG[p].models.map(m => ({ ...m, provider: p as Provider }))
);

export const MODELS_BY_PROVIDER = Object.fromEntries(
  ALL_PROVIDERS.map(p => [p, PROVIDER_CONFIG[p].models.map(m => ({ ...m, provider: p as Provider }))])
) as Record<Exclude<Provider, 'auto'>, typeof ALL_MODELS>;

export const PROVIDER_INFO = Object.fromEntries(
  ALL_PROVIDERS.map(p => [p, { name: PROVIDER_CONFIG[p].name, color: PROVIDER_CONFIG[p].color }])
) as Record<Exclude<Provider, 'auto'>, { name: string; color: string }>;

// Include 'auto' in the display map
export const PROVIDERS: Record<Provider, { name: string; color: string; apiKeyEnv?: string }> = {
  auto:       { name: 'Automático', color: '#A855F7' },
  openai:     { name: 'OpenAI',     color: '#10A37F', apiKeyEnv: 'OPENAI_API_KEY' },
  groq:       { name: 'Groq',       color: '#F55036', apiKeyEnv: 'GROQ_API_KEY' },
  openrouter: { name: 'OpenRouter', color: '#6366F1', apiKeyEnv: 'OPENROUTER_API_KEY' },
  gemini:     { name: 'Gemini',     color: '#4285F4', apiKeyEnv: 'GEMINI_API_KEY' },
  cerebras:   { name: 'Cerebras',   color: '#00D9FF', apiKeyEnv: 'CEREBRAS_API_KEY' },
};

export const PROVIDER_ORDER: Provider[] = ['auto', 'groq', 'gemini', 'openrouter', 'cerebras', 'openai'];

export function getDefaultModel(): { id: string; provider: Provider } {
  const groqDefault = PROVIDER_CONFIG.groq.models.find(m => m.isDefault)!;
  return { id: groqDefault.id, provider: 'groq' };
}

export function getProviderDefaultModel(provider: Exclude<Provider, 'auto'>): string {
  const cfg = PROVIDER_CONFIG[provider];
  return (cfg.models.find(m => m.isDefault) ?? cfg.models[0]).id;
}

export function getModelInfo(modelId: string) {
  for (const p of ALL_PROVIDERS) {
    const m = PROVIDER_CONFIG[p].models.find(m => m.id === modelId);
    if (m) return { ...m, provider: p as Provider };
  }
  return null;
}

export function getProviderFromModel(modelId: string): Provider | null {
  for (const p of ALL_PROVIDERS) {
    if (PROVIDER_CONFIG[p].models.some(m => m.id === modelId)) return p;
  }
  return null;
}

export function detectTaskType(content: string): TaskType {
  const lower = content.toLowerCase();
  if (/\b(genera|crea|dibuja|imagen de|image of|dall-?e)\b/.test(lower)) return 'image_gen';
  if (/\b(analiza|describe|ocr|texto de (esta|la) imagen|extrae texto|lee (esta|la) imagen|qué (ves|hay) en)\b/.test(lower)) return 'image_read';
  if (/\b(código|programar|function|clase|debug|error en|python|javascript|typescript|sql)\b/.test(lower)) return 'code';
  if (/\b(matemática|ecuación|calcula|resuelve|integral|derivada|álgebra|geometría)\b/.test(lower)) return 'math';
  if (/\b(traduc|translate|en (inglés|español|francés|portugués))\b/.test(lower)) return 'translate';
  if (/\b(resume|resumen|sintetiza|resumir)\b/.test(lower)) return 'summarize';
  if (/\b(analiza|análisis|compara|evalúa|diagnostica)\b/.test(lower)) return 'analyze';
  if (/\b(escribe|redacta|carta|ensayo|artículo|blog)\b/.test(lower)) return 'write';
  if (/\b(pdf|documento|archivo|doc|docx|contrato)\b/.test(lower)) return 'document';
  return 'chat';
}

// ============================================================
// ERROR HANDLING
// ============================================================
export function shouldFallback(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase();
  if (lower.includes('invalid') && lower.includes('key')) return false;
  if (lower.includes('invalid_api_key')) return false;
  return true; // fallback on all other errors
}

export function getFriendlyError(errorMsg: string): string {
  const lower = errorMsg.toLowerCase();
  if (lower.includes('quota') || lower.includes('insufficient_quota')) return '';  // silent — fallback handles it
  if (lower.includes('rate') || lower.includes('429')) return '';
  if (lower.includes('invalid') && lower.includes('key')) return 'La API key no es válida. Verifica tu configuración.';
  return '';
}

// ============================================================
// COST ESTIMATION (per 1k tokens)
// ============================================================
export const COST_PER_1K: Record<Exclude<Provider, 'auto'>, number> = {
  openai:     0.005,
  groq:       0,
  gemini:     0.000075,
  openrouter: 0.0005,
  cerebras:   0,
};
