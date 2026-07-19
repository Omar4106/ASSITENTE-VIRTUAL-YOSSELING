/**
 * ContextManager — reduces token consumption before sending to the model.
 *
 * Responsibilities:
 *  - Drop unnecessary history (keep only the most relevant turns).
 *  - Summarize old conversation turns into a compact recap.
 *  - Enforce per-task-type token budgets.
 *  - Always preserve: the system prompt, realtime context, and the latest user message.
 */
import type { TaskType } from '@/types';

export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: { name: string; type: string; dataUrl?: string; content?: string }[];
}

export interface TokenBudget {
  maxInputTokens: number;
  maxHistoryTurns: number;
}

export const TASK_TOKEN_BUDGET: Record<TaskType, TokenBudget> = {
  chat:       { maxInputTokens: 4000,  maxHistoryTurns: 6 },
  code:       { maxInputTokens: 12000, maxHistoryTurns: 8 },
  math:       { maxInputTokens: 8000,  maxHistoryTurns: 6 },
  document:   { maxInputTokens: 16000, maxHistoryTurns: 6 },
  ocr:        { maxInputTokens: 12000, maxHistoryTurns: 4 },
  translate:  { maxInputTokens: 6000,  maxHistoryTurns: 4 },
  analyze:    { maxInputTokens: 16000, maxHistoryTurns: 8 },
  summarize:  { maxInputTokens: 8000,  maxHistoryTurns: 4 },
  write:      { maxInputTokens: 8000,  maxHistoryTurns: 6 },
  image_gen:   { maxInputTokens: 4000,  maxHistoryTurns: 4 },
  image_read: { maxInputTokens: 12000, maxHistoryTurns: 4 },
};

/** Rough token estimate: ~4 chars per token for mixed Spanish/English text. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(messages: ContextMessage[]): number {
  let total = 0;
  for (const m of messages) {
    total += 4; // per-message overhead
    if (typeof m.content === 'string') {
      total += estimateTokens(m.content);
    }
    if (m.attachments) {
      for (const a of m.attachments) {
        if (a.content) total += estimateTokens(a.content);
        if (a.dataUrl) total += 85; // image placeholder cost
      }
    }
  }
  return total;
}

/**
 * Compress conversation history into a short recap paragraph.
 * Keeps only the gist of each turn (first ~160 chars).
 */
function summarizeOldTurns(messages: ContextMessage[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    const text = typeof m.content === 'string' ? m.content : '';
    if (!text.trim()) continue;
    const role = m.role === 'user' ? 'Usuario' : 'Yosseling';
    const gist = text.length > 160 ? text.slice(0, 160).trim() + '…' : text.trim();
    lines.push(`- ${role}: ${gist}`);
  }
  return lines.join('\n');
}

export interface OptimizedContext {
  messages: ContextMessage[];
  inputTokens: number;
  budget: TokenBudget;
  summarized: boolean;
  droppedTurns: number;
}

/**
 * Optimize the message array before sending to the model.
 *
 * `systemPrompt` and `realtimePrompt` are always preserved and placed first.
 * The latest user message is always preserved verbatim.
 * Older history is truncated, then summarized if still over budget.
 */
export function optimizeContext(
  systemPrompt: string,
  realtimePrompt: string | null,
  history: ContextMessage[],
  taskType: TaskType,
): OptimizedContext {
  const budget = TASK_TOKEN_BUDGET[taskType] ?? TASK_TOKEN_BUDGET.chat;

  const systemMsg: ContextMessage = { role: 'system', content: systemPrompt };
  const realtimeMsg: ContextMessage | null = realtimePrompt
    ? { role: 'system', content: realtimePrompt }
    : null;

  // History excludes the system role (we add it ourselves).
  const cleanHistory = history.filter(m => m.role !== 'system');

  // Always keep the latest user message verbatim.
  const lastUserIdx = cleanHistory.map(m => m.role).lastIndexOf('user');
  const lastUserMsg = lastUserIdx >= 0 ? cleanHistory[lastUserIdx] : null;

  // Drop the latest user message from the slice we'll trim.
  const olderHistory = lastUserIdx >= 0
    ? cleanHistory.slice(0, lastUserIdx)
    : cleanHistory;

  // First pass: keep only the most recent N turns (excluding the latest user msg).
  const kept = olderHistory.slice(-budget.maxHistoryTurns);
  const droppedTurns = olderHistory.length - kept.length;

  // Build candidate messages array.
  const candidate: ContextMessage[] = [
    systemMsg,
    ...(realtimeMsg ? [realtimeMsg] : []),
    ...kept,
    ...(lastUserMsg ? [lastUserMsg] : []),
  ];

  let inputTokens = estimateMessagesTokens(candidate);
  let summarized = false;

  // Second pass: if still over budget, summarize the older turns.
  if (inputTokens > budget.maxInputTokens && kept.length > 0) {
    const recap = summarizeOldTurns(kept);
    const recapMsg: ContextMessage = {
      role: 'system',
      content: `━━ RESUMEN DE CONVERSACIÓN PREVIA ━━\n${recap}`,
    };
    const compact: ContextMessage[] = [
      systemMsg,
      ...(realtimeMsg ? [realtimeMsg] : []),
      recapMsg,
      ...(lastUserMsg ? [lastUserMsg] : []),
    ];
    const compactTokens = estimateMessagesTokens(compact);
    if (compactTokens < inputTokens) {
      summarized = true;
      inputTokens = compactTokens;
      return {
        messages: compact,
        inputTokens,
        budget,
        summarized,
        droppedTurns,
      };
    }
  }

  return {
    messages: candidate,
    inputTokens,
    budget,
    summarized,
    droppedTurns,
  };
}
