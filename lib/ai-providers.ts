/**
 * Backwards-compatibility re-exports from lib/ai-config.
 * New code should import directly from lib/ai-config.
 */
export {
  PROVIDERS,
  PROVIDER_ORDER,
  PROVIDER_CONFIG,
  PROVIDER_INFO,
  MODELS_BY_PROVIDER,
  ALL_MODELS as MODELS,
  getDefaultModel,
  getProviderDefaultModel as getProviderFirstModel,
  getModelInfo as getModel,
} from '@/lib/ai-config';
