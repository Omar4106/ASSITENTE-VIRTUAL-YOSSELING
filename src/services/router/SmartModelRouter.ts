/**
 * SmartModelRouter — picks the best provider/model for a given task.
 *
 * Rules:
 *  - Simple chat / quick Q&A      → Groq (fastest, free)
 *  - Complex reasoning / analysis → OpenAI (most capable)
 *  - Documents / long context     → Gemini (1M context window)
 *  - Large logs / huge inputs      → Cerebras (fast on long sequences)
 *  - Images / vision               → Gemini (vision-capable)
 *  - Image generation              → OpenAI (DALL-E)
 *
 * Falls back to the existing FALLBACK_ORDER when a preferred provider is not
 * configured.
 */
import {
  FALLBACK_ORDER, PROVIDER_CONFIG, TASK_ROUTING,
  getProviderDefaultModel, detectTaskType,
} from '@/lib/ai-config';
import { getEnvVar } from '@/lib/env';
import type { Provider, TaskType } from '@/types';

export interface RouterDecision {
  provider: Exclude<Provider, 'auto'> | null;
  model: string | null;
  taskType: TaskType;
  chain: Exclude<Provider, 'auto'>[];
  reason: string;
}

function isConfigured(provider: Exclude<Provider, 'auto'>): boolean {
  const envKey = PROVIDER_CONFIG[provider]?.envKey;
  return Boolean(envKey && getEnvVar(envKey));
}

/**
 * Decide which provider/model to use for a given user message.
 *
 * @param userText   Last user message text (used for task detection).
 * @param hasImages  Whether the latest user message carries image attachments.
 * @param forcedProvider If the user explicitly selected a provider, honor it.
 */
export function routeModel(
  userText: string,
  hasImages = false,
  forcedProvider: Exclude<Provider, 'auto'> | null = null,
): RouterDecision {
  const taskType = hasImages ? 'image_read' : detectTaskType(userText);

  // Image generation is handled by the ImageService, not the chat router.
  if (taskType === 'image_gen') {
    return {
      provider: null,
      model: null,
      taskType,
      chain: [],
      reason: 'image_gen is handled by ImageService, not the chat router',
    };
  }

  const preferred = (TASK_ROUTING[taskType] ?? 'groq') as Exclude<Provider, 'auto'>;

  // Build the fallback chain starting with the preferred provider.
  const chain: Exclude<Provider, 'auto'>[] = forcedProvider
    ? [forcedProvider, ...FALLBACK_ORDER.filter(p => p !== forcedProvider) as Exclude<Provider, 'auto'>[]]
    : [preferred, ...FALLBACK_ORDER.filter(p => p !== preferred) as Exclude<Provider, 'auto'>[]];

  const available = chain.filter(isConfigured);

  if (available.length === 0) {
    return {
      provider: null,
      model: null,
      taskType,
      chain: [],
      reason: 'No AI provider API key is configured',
    };
  }

  const provider = available[0];
  const model = getProviderDefaultModel(provider);

  let reason = `task=${taskType} → preferred=${preferred}`;
  if (forcedProvider) reason = `forced=${forcedProvider} → task=${taskType}`;
  if (provider !== preferred && !forcedProvider) reason += ` (fell back to ${provider})`;

  return { provider, model, taskType, chain: available, reason };
}
