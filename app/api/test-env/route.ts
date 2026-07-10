import { NextResponse } from 'next/server';
import { getEnvVar, checkEnvVars } from '@/lib/env';
import { FALLBACK_ORDER } from '@/lib/ai-config';

export const runtime = 'nodejs';

export async function GET() {
  const envKeys = ['GROQ_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'CEREBRAS_API_KEY'];
  const status = checkEnvVars(envKeys);

  console.log('[Yosseling] Environment check:');
  for (const [key, present] of Object.entries(status)) {
    console.log(`  ${key}: ${present ? 'OK' : 'MISSING'}`);
  }

  const previews: Record<string, string> = {};
  for (const key of envKeys) {
    const val = getEnvVar(key);
    previews[key] = val ? `${val.slice(0, 8)}***` : 'NOT SET';
  }

  return NextResponse.json({
    providers: FALLBACK_ORDER.map(p => ({
      name: p,
      configured: status[`${p.toUpperCase()}_API_KEY`] ?? false,
    })),
    keys: status,
    previews,
    fallbackOrder: FALLBACK_ORDER,
  });
}
