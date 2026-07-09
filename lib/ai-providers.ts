/**
 * YOSSELING AI PROVIDERS
 * Re-exports from centralized configuration.
 *
 * DEPRECATED: Use '@/lib/ai-config' directly.
 * This file exists only for backwards compatibility.
 */

import type { ModelConfig, Provider } from '@/types';
import {
  PROVIDER_CONFIG,
  ALL_MODELS,
  MODELS_BY_PROVIDER,
  PROVIDER_INFO,
  getDefaultModel,
  getProviderDefaultModel,
  SYSTEM_PROMPT,
  FALLBACK_ORDER,
  AI_SETTINGS,
} from './ai-config';

// Re-export everything from ai-config for backwards compatibility
export {
  SYSTEM_PROMPT,
  FALLBACK_ORDER,
  AI_SETTINGS,
  getDefaultModel,
  getProviderDefaultModel,
};

// Convert to legacy format
export const MODELS: ModelConfig[] = ALL_MODELS as ModelConfig[];

export const PROVIDERS: Record<Provider, { name: string; color: string }> = PROVIDER_INFO;

export const PROVIDER_ORDER: Provider[] = FALLBACK_ORDER;

export { MODELS_BY_PROVIDER };

export function getModel(id: string): ModelConfig | undefined {
  return ALL_MODELS.find(m => m.id === id) as ModelConfig | undefined;
}

export function getProviderFirstModel(provider: Provider): ModelConfig | undefined {
  return MODELS_BY_PROVIDER[provider]?.[0] as ModelConfig | undefined;
}
