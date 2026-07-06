import type { ModelConfig, Provider } from '@/types';

export const MODELS: ModelConfig[] = [
  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Most capable OpenAI model', contextWindow: 128000 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: 'Fast and efficient', contextWindow: 128000 },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', description: 'Powerful reasoning', contextWindow: 128000 },
  // Gemini
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini', description: 'Google\'s most capable', contextWindow: 1000000 },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', description: 'Fast multimodal', contextWindow: 1000000 },
  // Groq
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', description: 'Ultra-fast Llama', contextWindow: 32768, isDefault: true },
  { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1', provider: 'groq', description: 'Advanced reasoning', contextWindow: 32768 },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq', description: 'Mixture of experts', contextWindow: 32768 },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B', provider: 'groq', description: 'Google open model', contextWindow: 8192 },
  { id: 'qwen-qwq-32b', name: 'Qwen QwQ 32B', provider: 'groq', description: 'Reasoning model', contextWindow: 32768 },
];

export const PROVIDERS: Record<Provider, { name: string; color: string }> = {
  openai: { name: 'OpenAI', color: '#10A37F' },
  gemini: { name: 'Gemini', color: '#4285F4' },
  groq: { name: 'Groq', color: '#F55036' },
};

export const MODELS_BY_PROVIDER: Record<Provider, ModelConfig[]> = {
  openai: MODELS.filter(m => m.provider === 'openai'),
  gemini: MODELS.filter(m => m.provider === 'gemini'),
  groq: MODELS.filter(m => m.provider === 'groq'),
};

export function getModel(id: string): ModelConfig | undefined {
  return MODELS.find(m => m.id === id);
}

export function getDefaultModel(): ModelConfig {
  return MODELS.find(m => m.isDefault) ?? MODELS[0];
}

export const SYSTEM_PROMPT = `Eres Yosseling, una asistente virtual inteligente, amable, profesional y muy capaz.
Fuiste creada para ayudar a las personas con cualquier tarea que necesiten.
Respondes de forma clara, natural, precisa y útil.
Cuando no sabes algo, lo admites honestamente.
Eres empática, creativa y eficiente.
Tu personalidad es cálida pero profesional.`;
