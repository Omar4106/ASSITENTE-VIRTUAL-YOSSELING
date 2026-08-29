import { NextResponse } from 'next/server';
import { getEnvVar } from '@/lib/env';

export const runtime = 'nodejs';

const KEYS = ['GROQ_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'CEREBRAS_API_KEY'];

export async function GET() {
  const status: Record<string, boolean> = {};
  for (const key of KEYS) {
    const val = getEnvVar(key);
    status[key] = Boolean(val);
    if (!val) console.warn(`[Yosseling] Missing env var: ${key}`);
    else console.log(`[Yosseling] Found env var: ${key} = ${val.slice(0, 8)}...`);
  }
  return NextResponse.json({
    status,
    node_env: process.env.NODE_ENV,
    configured: Object.values(status).filter(Boolean).length,
    total: KEYS.length,
  });
}
