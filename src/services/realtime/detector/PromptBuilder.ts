/**
 * Prompt Builder — assembles the final system prompt with realtime context.
 */
import type { RealtimeContext } from '../types';
import { formatSourcesForPrompt } from './SourceFormatter';

export function buildRealtimePrompt(context: RealtimeContext): string {
  return formatSourcesForPrompt(context.results);
}

export function buildRealtimeContext(
  originalQuery: string,
  domain: NonNullable<RealtimeContext['detectedDomain']>,
  results: RealtimeContext['results'],
): RealtimeContext {
  const detectedAt = new Date().toISOString();
  const prompt = formatSourcesForPrompt(results);
  return {
    originalQuery,
    detectedDomain: domain,
    detectedAt,
    results,
    prompt,
  };
}
