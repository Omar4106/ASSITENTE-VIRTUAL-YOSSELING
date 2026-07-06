import { NextResponse } from 'next/server';
import { getEnvVar, checkEnvVars } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET() {
  const keys = ['GROQ_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'];
  const status = checkEnvVars(keys);

  // Log missing keys to server console
  for (const [key, present] of Object.entries(status)) {
    if (!present) {
      console.warn(`[Yosseling] Missing env var: ${key}`);
    } else {
      console.log(`[Yosseling] Found env var: ${key}`);
    }
  }

  // Sanity-check: show first 8 chars of Groq key (never full value)
  const groqKey = getEnvVar('GROQ_API_KEY');
  const groqPreview = groqKey
    ? `${groqKey.slice(0, 8)}...`
    : 'NOT FOUND';

  return NextResponse.json({
    groq: status['GROQ_API_KEY'],
    openai: status['OPENAI_API_KEY'],
    gemini: status['GEMINI_API_KEY'],
    groq_key_preview: groqPreview,
    node_env: process.env.NODE_ENV,
    cwd: process.cwd(),
  });
}
