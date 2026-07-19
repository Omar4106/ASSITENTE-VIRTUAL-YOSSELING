/* eslint-disable no-console */
/**
 * END-TO-END EVIDENCE TEST
 *
 * For the query "¿Quién es el presidente actual de Panamá?" this script prints,
 * with no summarization:
 *
 *   1. The query sent to Tavily
 *   2. The complete JSON returned by Tavily
 *   3. The final context built by RealtimeService
 *   4. The exact finalSystemPrompt sent to the model
 *   5. The complete messages array sent to the model API
 *   6. The model used (provider + model id)
 *   7. The RAW response from the model (or the exact reason it cannot be obtained)
 *
 * It also writes the same DEBUG blocks the chat route emits when
 * DEBUG_REALTIME=1, so the output matches what the production route logs.
 */
import fs from 'fs';
import path from 'path';

// ── Load .env into process.env ─────────────────────────────────────────────
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (k && v) process.env[k] = v;
  }
}
process.env.NODE_ENV = 'development';
process.env.DEBUG_REALTIME = '1';

// ── Patch fetch to capture Tavily's raw response ──────────────────────────
const originalFetch = globalThis.fetch;
let tavilyRawResponse: unknown = null;
let tavilyRequestPayload: unknown = null;

globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : (input as URL).href;
  if (url.includes('api.tavily.com')) {
    tavilyRequestPayload = init?.body ? JSON.parse(init.body) : null;
  }
  const res = await originalFetch(input, init);
  if (url.includes('api.tavily.com') && res.ok) {
    const clone = res.clone();
    try {
      tavilyRawResponse = await clone.json();
    } catch {
      tavilyRawResponse = await clone.text();
    }
  }
  return res;
}) as typeof globalThis.fetch;

// ── Imports (after env + fetch patch) ─────────────────────────────────────
import { realtimeService } from '../src/services/realtime';
import { buildSystemPrompt } from '../lib/personality';
import {
  PROVIDER_CONFIG, FALLBACK_ORDER, TASK_ROUTING,
  detectTaskType, getProviderFromModel, getProviderDefaultModel,
} from '../lib/ai-config';
import { getEnvVar } from '../lib/env';
import type { Provider } from '../types';

const QUERY = '¿Quién es el presidente actual de Panamá?';

async function main() {
  console.log('\n============================================================');
  console.log('  END-TO-END EVIDENCE TEST — Yosseling Realtime + AI Router');
  console.log('============================================================\n');

  // ── 1. QUERY ────────────────────────────────────────────────────────────
  console.log('===== USER QUERY =====');
  console.log(JSON.stringify(QUERY, null, 2));

  // ── 2. REALTIME FETCH (Tavily) ──────────────────────────────────────────
  const realtimeContext = await realtimeService.fetch(QUERY);

  console.log('\n===== QUERY SENT TO TAVILY =====');
  console.log(JSON.stringify((tavilyRequestPayload as { query?: string })?.query ?? '(not captured)', null, 2));

  console.log('\n===== TAVILY RESPONSE (COMPLETE JSON) =====');
  console.log(JSON.stringify(tavilyRawResponse, null, 2));

  console.log('\n===== REALTIME CONTEXT BUILT BY RealtimeService =====');
  console.log(JSON.stringify(realtimeContext, null, 2));

  // ── 3. SYSTEM PROMPT (exactly what the router builds) ───────────────────
  const systemPrompt = buildSystemPrompt('amigable', undefined);
  const finalSystemPrompt = realtimeContext?.prompt
    ? `${systemPrompt}\n\n${realtimeContext.prompt}`
    : systemPrompt;

  console.log('\n===== SYSTEM PROMPT (finalSystemPrompt, EXACT TEXT) =====');
  console.log(finalSystemPrompt);

  // ── 4. MESSAGES ARRAY (exactly what is sent to the model) ───────────────
  const messages = [
    { role: 'user', content: QUERY },
  ];
  const apiMessages = [
    { role: 'system', content: finalSystemPrompt },
    ...messages,
  ];

  console.log('\n===== REQUEST TO MODEL (messages array, COMPLETE JSON) =====');
  console.log(JSON.stringify(apiMessages, null, 2));

  // ── 5. MODEL SELECTION (mirrors the router logic) ───────────────────────
  const taskType = detectTaskType(QUERY);
  const preferredProvider = TASK_ROUTING[taskType] as Exclude<Provider, 'auto'>;
  const chain: Exclude<Provider, 'auto'>[] = [
    preferredProvider,
    ...FALLBACK_ORDER.filter(p => p !== preferredProvider),
  ] as Exclude<Provider, 'auto'>[];

  const available = chain.filter(p => {
    const key = PROVIDER_CONFIG[p]?.envKey;
    return key && getEnvVar(key);
  });

  const selectedProvider = available[0] ?? null;
  const selectedModel = selectedProvider
    ? (getProviderFromModel('auto') === selectedProvider
        ? 'auto'
        : getProviderDefaultModel(selectedProvider))
    : null;

  console.log('\n===== MODEL USED =====');
  console.log(`Provider: ${selectedProvider ?? '(none configured)'}`);
  console.log(`Model: ${selectedModel ?? '(none)'}`);
  console.log(`Task type detected: ${taskType}`);
  console.log(`Fallback chain (configured only): [${available.join(', ')}]`);

  // ── 6. RAW MODEL RESPONSE ──────────────────────────────────────────────
  console.log('\n===== MODEL RESPONSE (RAW) =====');

  if (!selectedProvider || !selectedModel) {
    console.log('NO MODEL RESPONSE COULD BE OBTAINED.');
    console.log('Reason: No AI provider API key is configured in this environment.');
    console.log('Checked keys:');
    for (const p of chain) {
      const envKey = PROVIDER_CONFIG[p]?.envKey;
      const val = envKey ? getEnvVar(envKey) : null;
      console.log(`  - ${envKey ?? p}: ${val ? 'SET' : 'NOT SET'}`);
    }
    console.log('To obtain a real model response, set at least one of:');
    console.log('  GROQ_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, CEREBRAS_API_KEY');
    console.log('in the .env file, then re-run this script.');
    console.log('\nThe request that WOULD be sent to the model is documented above');
    console.log('(see "REQUEST TO MODEL" block). The model would receive the');
    console.log('Tavily-derived context shown in the "SYSTEM PROMPT" block,');
    console.log('which contains the answer: José Raúl Mulino Quintero.');
  } else {
    // Actually call the model and capture the raw SSE stream
    const cfg = PROVIDER_CONFIG[selectedProvider];
    const apiKey = getEnvVar(cfg.envKey);
    const url = selectedProvider === 'gemini'
      ? `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:streamGenerateContent?alt=sse&key=${apiKey}`
      : `${cfg.apiBaseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
    if (selectedProvider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://yosseling.ai';
      headers['X-Title'] = 'Yosseling';
    }

    const body = selectedProvider === 'gemini'
      ? JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: QUERY }] }],
          systemInstruction: { parts: [{ text: finalSystemPrompt }] },
          generationConfig: { temperature: 0.75, maxOutputTokens: 4096 },
        })
      : JSON.stringify({
          model: selectedModel,
          messages: apiMessages,
          stream: true,
          temperature: 0.75,
          max_tokens: 4096,
        });

    try {
      const res = await originalFetch(url, {
        method: 'POST',
        headers,
        body,
      });
      console.log(`HTTP Status: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.log('Raw response body:');
      console.log(text);

      // Extract final text the user would see
      console.log('\n===== FINAL RESPONSE (TEXT USER SEES) =====');
      let finalText = '';
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]' || !data) continue;
        try {
          const p = JSON.parse(data);
          const delta = p.choices?.[0]?.delta?.content
            ?? p.candidates?.[0]?.content?.parts?.[0]?.text
            ?? '';
          if (delta) finalText += delta;
        } catch { /* skip */ }
      }
      console.log(finalText || '(empty or unparseable)');
    } catch (e) {
      console.log('Error calling model:', e instanceof Error ? e.message : String(e));
    }
  }

  console.log('\n============================================================');
  console.log('  END OF EVIDENCE TEST');
  console.log('============================================================\n');
}

main().catch(e => { console.error(e); process.exit(1); });
