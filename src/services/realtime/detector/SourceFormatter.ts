/**
 * Source Formatter — converts RealtimeResult[] into a compact, model-friendly
 * text block suitable for injection into the system prompt.
 */
import type { RealtimeResult } from '../types';
import { REALTIME_CONFIG, REALTIME_PROMPT_PREAMBLE } from '../config';
import { truncate } from '../utils';

export function formatSourcesForPrompt(results: RealtimeResult[]): string {
  if (!results.length) return '';

  const blocks: string[] = [];
  for (const r of results) {
    const header = `### ${r.domain.toUpperCase()} — "${r.query}" (confianza: ${r.confidence}, ${r.fetchedAt})`;
    const summary = r.summary ? `Resumen: ${truncate(r.summary, 600)}` : '';
    const srcs = r.sources.slice(0, REALTIME_CONFIG.maxSourcesInPrompt).map((s, i) => {
      const date = s.publishedAt ? ` (${s.publishedAt})` : '';
      const snip = s.snippet ? `\n   ${truncate(s.snippet, 400)}` : '';
      return `[${i + 1}] ${s.title}${date}\n   URL: ${s.url}${snip}`;
    });

    blocks.push([header, summary, srcs.join('\n')].filter(Boolean).join('\n'));
  }

  return [REALTIME_PROMPT_PREAMBLE, '', blocks.join('\n\n---\n\n')].join('\n');
}
