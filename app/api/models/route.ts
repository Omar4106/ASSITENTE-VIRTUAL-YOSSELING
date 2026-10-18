import { NextRequest, NextResponse } from 'next/server';
import { PROVIDER_CONFIG, ALL_MODELS } from '@/lib/ai-config';
import { getEnvVar } from '@/lib/env';
import type { Provider } from '@/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const prov = new URL(req.url).searchParams.get('provider') as Provider | null;
  if (!prov || prov === 'auto') {
    return NextResponse.json({ error: 'Provider required', models: ALL_MODELS });
  }

  const cfg = PROVIDER_CONFIG[prov as Exclude<Provider, 'auto'>];
  if (!cfg) return NextResponse.json({ error: 'Unknown provider', models: [] });

  const apiKey = getEnvVar(cfg.envKey);
  if (!apiKey) return NextResponse.json({ models: cfg.models }); // return static models

  // For most providers, just return static list (dynamic listing is optional)
  // Only attempt dynamic listing for OpenRouter (has a public models endpoint)
  if (prov === 'openrouter') {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        const models = (data.data as Array<{ id: string; name?: string; context_length?: number }>)
          .slice(0, 50)
          .map(m => ({ id: m.id, name: m.name ?? m.id.split('/').pop() ?? m.id, contextWindow: m.context_length }));
        return NextResponse.json({ models });
      }
    } catch { /* fall through */ }
  }

  return NextResponse.json({ models: cfg.models });
}
