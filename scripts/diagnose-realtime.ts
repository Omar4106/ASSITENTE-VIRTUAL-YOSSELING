/* eslint-disable no-console */
/**
 * Diagnostic script — exercises RealtimeService end-to-end and logs every
 * HTTP request made by any provider. Does NOT modify the service code.
 *
 * Run with:  npx tsx scripts/diagnose-realtime.ts
 */
import fs from 'fs';
import path from 'path';

// ── 1. Load .env into process.env so getEnvVar() (which reads process.env
//       first) sees the keys even in production-style execution. ─────────────
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

// Force non-production so getEnvVar's .env fallback also runs.
process.env.NODE_ENV = 'development';

// ── 2. Instrument global.fetch to log request + response. ─────────────────
type FetchImpl = typeof fetch;
const originalFetch: FetchImpl = globalThis.fetch;

let requestCounter = 0;

function redactHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (/auth|key|token|subscription|ocp-apim/i.test(k)) {
      out[k] = v ? `${v.slice(0, 6)}…${v.slice(-4)} (len=${v.length})` : '(empty)';
    } else {
      out[k] = v;
    }
  }
  return out;
}

const patchedFetch: FetchImpl = async (input, init) => {
  const id = ++requestCounter;
  const url = typeof input === 'string' ? input : (input as URL).href;
  const method = init?.method ?? 'GET';
  const headersRaw: Record<string, string> = {};
  const h = init?.headers;
  if (h) {
    if (h instanceof Headers) h.forEach((v, k) => { headersRaw[k] = v; });
    else if (Array.isArray(h)) h.forEach(([k, v]) => { headersRaw[k] = v; });
    else Object.assign(headersRaw, h as Record<string, string>);
  }
  const body = init?.body ? String(init.body) : '(no body)';

  console.log(`\n========== HTTP REQUEST #${id} ==========`);
  console.log(`Provider fetch detected`);
  console.log(`Method: ${method}`);
  console.log(`URL: ${url}`);
  console.log(`Headers: ${JSON.stringify(redactHeaders(headersRaw), null, 2)}`);
  console.log(`Request Body: ${body.slice(0, 1500)}`);

  try {
    const res = await originalFetch(input as RequestInfo, init as RequestInit);
    console.log(`HTTP Status: ${res.status} ${res.statusText}`);
    // Clone so the caller can still consume the body.
    const clone = res.clone();
    const text = await clone.text();
    console.log(`Response completa (raw text, primeros 2000 chars):\n${text.slice(0, 2000)}`);
    try {
      const json = JSON.parse(text);
      console.log(`JSON completo recibido (primeros 2000 chars):\n${JSON.stringify(json, null, 2).slice(0, 2000)}`);
    } catch {
      console.log(`(La respuesta no es JSON válido)`);
    }
    console.log(`========== fin request #${id} ==========\n`);
    return res;
  } catch (e) {
    console.log(`Error completo en request #${id}:`, e);
    if (e instanceof Error) console.log(`Stack completo:\n${e.stack}`);
    console.log(`========== fin request #${id} (error) ==========\n`);
    throw e;
  }
};

globalThis.fetch = patchedFetch as unknown as FetchImpl;

// ── 3. Now import the service (after patching fetch). ──────────────────────
import { realtimeService } from '../src/services/realtime';
import { getEnvVar } from '../lib/env';

// ── 4. Report which providers consider themselves configured. ─────────────
console.log('\n========== CONFIGURACIÓN DE PROVIDERS ==========');
const providers = realtimeService.getProviders();
for (const p of providers) {
  const cfg = p.isConfigured();
  console.log(`- ${p.id} (${p.name}) [domain=${p.domain}]: isConfigured=${cfg}`);
}

console.log('\n========== API KEYS PRESENTES EN .env ==========');
const keys = [
  'TAVILY_API_KEY', 'SERPER_API_KEY', 'BRAVE_API_KEY',
  'BING_SEARCH_API_KEY', 'GOOGLE_SEARCH_API_KEY', 'GOOGLE_CSE_ID',
  'NEWSAPI_KEY', 'OPENWEATHER_API_KEY',
];
for (const k of keys) {
  const v = getEnvVar(k);
  console.log(`- ${k}: ${v ? `presente (len=${v.length}, prefijo=${v.slice(0, 4)}…)` : 'AUSENTE'}`);
}

console.log(`realtimeService.isConfigured() = ${realtimeService.isConfigured()}`);

// ── 5. Run fetch() with a test query that should trigger realtime. ─────────
async function run() {
  const queries = [
    'noticias de hoy',
    'clima en Madrid hoy',
    'precio del bitcoin ahora',
  ];

  for (const q of queries) {
    console.log(`\n############ TEST QUERY: "${q}" ############`);
    const intent = realtimeService.detect(q);
    console.log('Intent:', JSON.stringify(intent, null, 2));

    let result: Awaited<ReturnType<typeof realtimeService.fetch>>;
    try {
      result = await realtimeService.fetch(q);
    } catch (e) {
      console.log('EXCEPCIÓN capturada fuera de fetch():', e);
      if (e instanceof Error) console.log('Stack:', e.stack);
      continue;
    }

    console.log('\n----- Resultado de realtimeService.fetch() -----');
    console.log('Es null?', result === null);
    if (result) {
      console.log('domain:', result.detectedDomain);
      console.log('results.length:', result.results.length);
      console.log('prompt (primeros 500):', result.prompt?.slice(0, 500));
      for (const r of result.results) {
        console.log(`  result: domain=${r.domain} sources=${r.sources.length} confidence=${r.confidence}`);
        for (const s of r.sources) console.log(`    - ${s.title} | ${s.url}`);
      }
      if (result.results.length === 0 || result.results.every(r => r.sources.length === 0)) {
        console.log('>>> "No search results" — el servicio devolvió contexto pero sin fuentes.');
      }
    } else {
      console.log('>>> realtimeService.fetch() devolvió null.');
    }
  }

  console.log(`\n========== RESUMEN ==========`);
  console.log(`Total de peticiones HTTP realizadas: ${requestCounter}`);
  if (requestCounter === 0) {
    console.log('>>> NINGUNA petición HTTP fue ejecutada.');
    console.log('>>> Causas posibles: ningún provider isConfigured=true, o el');
    console.log('>>> IntentDetector no detectó necesidad de realtime, o la');
    console.log('>>> respuesta fue servida desde caché.');
  }
}

run().catch((e) => {
  console.error('Error fatal en el script de diagnóstico:', e);
  if (e instanceof Error) console.error(e.stack);
  process.exit(1);
});
