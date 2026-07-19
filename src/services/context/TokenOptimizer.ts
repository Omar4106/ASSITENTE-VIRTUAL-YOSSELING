/**
 * TokenOptimizer — token accounting + cost estimation.
 *
 * Provides:
 *  - estimateTokens / estimateMessagesTokens (re-exported from ContextManager).
 *  - cost estimation per provider.
 *  - a summary object suitable for logging or surfacing in the UI.
 */
import { COST_PER_1K, PROVIDER_CONFIG } from '@/lib/ai-config';
import { getEnvVar } from '@/lib/env';
import type { Provider } from '@/types';
import { estimateMessagesTokens, estimateTokens, type ContextMessage } from './ContextManager';

export interface TokenReport {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  provider: Provider;
  model: string;
}

export function countInputTokens(messages: ContextMessage[]): number {
  return estimateMessagesTokens(messages);
}

export function countOutputTokens(text: string): number {
  return estimateTokens(text);
}

export function buildTokenReport(
  messages: ContextMessage[],
  outputText: string,
  provider: Provider,
  model: string,
): TokenReport {
  const inputTokens = countInputTokens(messages);
  const outputTokens = countOutputTokens(outputText);
  const totalTokens = inputTokens + outputTokens;

  const costPer1k = provider === 'auto'
    ? 0
    : (COST_PER_1K[provider as Exclude<Provider, 'auto'>] ?? 0);

  const estimatedCostUsd = (totalTokens / 1000) * costPer1k;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
    provider,
    model,
  };
}

export function formatTokenReport(r: TokenReport): string {
  return [
    `[Tokens] input=${r.inputTokens} output=${r.outputTokens} total=${r.totalTokens}`,
    `[Cost] provider=${r.provider} model=${r.model} estimated=$${r.estimatedCostUsd.toFixed(6)} USD`,
  ].join('\n');
}

export function isProviderConfigured(provider: Exclude<Provider, 'auto'>): boolean {
  const envKey = PROVIDER_CONFIG[provider]?.envKey;
  return Boolean(envKey && getEnvVar(envKey));
}

export { estimateTokens, estimateMessagesTokens };
