/**
 * YOSSELING AI CONFIGURATION
 * Single source of truth for all AI providers, models, and routing.
 *
 * IMPORTANT: Types are defined in types/index.ts
 * This file imports from types to avoid circular dependencies.
 */

import type { Provider, ModelId } from '@/types';

// Re-export for convenience
export type { Provider, ModelId };

// ============================================================
// GENERATION SETTINGS
// ============================================================

export const AI_SETTINGS = {
  temperature: 0.7,
  maxTokens: 4096,
  stream: true,
  timeout: 60000,
} as const;

// ============================================================
// SYSTEM PROMPT
// ============================================================

export const SYSTEM_PROMPT = `Eres Yosseling, una asistente virtual inteligente, amable, profesional y muy capaz.
Fuiste creada para ayudar a las personas con cualquier tarea que necesiten.
Respondes de forma clara, natural, precisa y útil.
Cuando no sabes algo, lo admites honestamente.
Eres empática, creativa y eficiente.
Tu personalidad es cálida pero profesional.`;

// ============================================================
// FALLBACK CHAIN (Priority Order)
// OpenAI -> Groq -> OpenRouter -> Gemini -> Cerebras
// ============================================================

export const FALLBACK_ORDER: Provider[] = [
  'openai',
  'groq',
  'openrouter',
  'gemini',
  'cerebras',
];

// ============================================================
// PROVIDER CONFIGURATION
// ============================================================

interface ProviderModel {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  isDefault?: boolean;
}

interface ProviderConfigType {
  name: string;
  color: string;
  apiBaseUrl: string;
  envKey: string;
  models: ProviderModel[];
}

export const PROVIDER_CONFIG: Record<Provider, ProviderConfigType> = {
  openai: {
    name: 'OpenAI',
    color: '#10A37F',
    apiBaseUrl: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable OpenAI model', contextWindow: 128000, isDefault: false },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and efficient', contextWindow: 128000, isDefault: true },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Powerful reasoning', contextWindow: 128000, isDefault: false },
    ],
  },
  groq: {
    name: 'Groq',
    color: '#F55036',
    apiBaseUrl: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Ultra-fast inference', contextWindow: 32768, isDefault: true },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1', description: 'Advanced reasoning', contextWindow: 32768, isDefault: false },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Mixture of experts', contextWindow: 32768, isDefault: false },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B', description: 'Google open model', contextWindow: 8192, isDefault: false },
      { id: 'qwen-qwq-32b', name: 'Qwen QwQ 32B', description: 'Reasoning model', contextWindow: 32768, isDefault: false },
    ],
  },
  gemini: {
    name: 'Gemini',
    color: '#4285F4',
    apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    envKey: 'GEMINI_API_KEY',
    // ONLY ACTUAL VALID MODELS - NO OLD/DEPRECATED MODELS
    models: [
      { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', description: 'Fast multimodal', contextWindow: 1000000, isDefault: true },
      { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro', description: 'Google most capable', contextWindow: 1000000, isDefault: false },
    ],
  },
  openrouter: {
    name: 'OpenRouter',
    color: '#6366F1',
    apiBaseUrl: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
    models: [
      { id: 'qwen/qwen3-coder', name: 'Qwen3 Coder', description: 'Advanced coding model', contextWindow: 131072, isDefault: true },
      { id: 'openrouter/gpt-oss-120b', name: 'GPT OSS 120B', description: 'Large open model', contextWindow: 32768, isDefault: false },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', description: 'Meta latest Llama', contextWindow: 131072, isDefault: false },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Anthropic via OpenRouter', contextWindow: 200000, isDefault: false },
      { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', description: 'Most powerful Claude', contextWindow: 200000, isDefault: false },
      { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', description: 'Google via OpenRouter', contextWindow: 1000000, isDefault: false },
    ],
  },
  cerebras: {
    name: 'Cerebras',
    color: '#00D9FF',
    apiBaseUrl: 'https://api.cerebras.ai/v1',
    envKey: 'CEREBRAS_API_KEY',
    models: [
      { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', description: 'Cerebras ultra-fast', contextWindow: 8192, isDefault: true },
      { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', description: 'Fast & efficient', contextWindow: 8192, isDefault: false },
    ],
  },
};

// ============================================================
// DERIVED EXPORTS
// ============================================================

export const ALL_PROVIDERS = Object.keys(PROVIDER_CONFIG) as Provider[];

export const ALL_MODELS = Object.entries(PROVIDER_CONFIG).flatMap(([provider, config]) =>
  config.models.map(m => ({
    ...m,
    provider: provider as Provider,
  }))
);

export const MODELS_BY_PROVIDER = Object.fromEntries(
  Object.entries(PROVIDER_CONFIG).map(([provider, config]) => [
    provider,
    config.models.map(m => ({ ...m, provider: provider as Provider })),
  ])
) as Record<Provider, typeof ALL_MODELS>;

export const PROVIDER_INFO = Object.fromEntries(
  Object.entries(PROVIDER_CONFIG).map(([provider, config]) => [
    provider,
    { name: config.name, color: config.color },
  ])
) as Record<Provider, { name: string; color: string }>;

export function getDefaultModel(): { id: ModelId; provider: Provider } {
  const groqDefault = PROVIDER_CONFIG.groq.models.find(m => m.isDefault);
  return { id: groqDefault!.id as ModelId, provider: 'groq' as Provider };
}

export function getProviderDefaultModel(provider: Provider): string {
  const config = PROVIDER_CONFIG[provider];
  const defaultModel = config.models.find(m => m.isDefault);
  return defaultModel?.id || config.models[0].id;
}

export function getModelInfo(modelId: string) {
  for (const [provider, config] of Object.entries(PROVIDER_CONFIG)) {
    const model = config.models.find(m => m.id === modelId);
    if (model) {
      return { ...model, provider: provider as Provider };
    }
  }
  return null;
}

export function getProviderFromModel(modelId: string): Provider | null {
  for (const [provider, config] of Object.entries(PROVIDER_CONFIG)) {
    if (config.models.some(m => m.id === modelId)) {
      return provider as Provider;
    }
  }
  return null;
}

export function getNextFallback(currentProvider: Provider): Provider | null {
  const idx = FALLBACK_ORDER.indexOf(currentProvider);
  if (idx < 0 || idx >= FALLBACK_ORDER.length - 1) return null;
  return FALLBACK_ORDER[idx + 1];
}

// ============================================================
// FRIENDLY ERROR MESSAGES
// ============================================================

export const FRIENDLY_ERRORS: Record<string, string> = {
  insufficient_quota: 'El proveedor no tiene cuota disponible. Usando proveedor alternativo...',
  rate_limit: 'Límite de peticiones alcanzado. Intentando con otro proveedor...',
  invalid_api_key: 'API key inválida. Verifica tu configuración.',
  model_not_found: 'Modelo no disponible. Usando alternativa...',
  service_unavailable: 'Servicio temporalmente no disponible. Intentando con otro proveedor...',
  timeout: 'Tiempo de espera agotado. Intentando con otro proveedor...',
  connection_error: 'Error de conexión. Intentando con otro proveedor...',
  default: 'Ocurrió un error. Por favor intenta de nuevo.',
};

export function getFriendlyError(errorText: string): string {
  const lower = errorText.toLowerCase();
  if (lower.includes('insufficient_quota') || lower.includes('quota')) return FRIENDLY_ERRORS.insufficient_quota;
  if (lower.includes('rate_limit') || lower.includes('rate limit') || lower.includes('429')) return FRIENDLY_ERRORS.rate_limit;
  if (lower.includes('invalid') && lower.includes('key')) return FRIENDLY_ERRORS.invalid_api_key;
  if (lower.includes('model') && (lower.includes('not found') || lower.includes('unavailable'))) return FRIENDLY_ERRORS.model_not_found;
  if (lower.includes('service') && lower.includes('unavailable')) return FRIENDLY_ERRORS.service_unavailable;
  if (lower.includes('timeout') || lower.includes('etimedout')) return FRIENDLY_ERRORS.timeout;
  if (lower.includes('econnrefused') || lower.includes('enotfound') || lower.includes('network')) return FRIENDLY_ERRORS.connection_error;
  return FRIENDLY_ERRORS.default;
}
