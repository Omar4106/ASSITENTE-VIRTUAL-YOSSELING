/**
 * Image generation / edit / analyze endpoint.
 *
 * POST /api/images
 *   body: {
 *     action: 'generate' | 'edit' | 'analyze',
 *     prompt: string,
 *     imageB64?: string,   (required for edit/analyze)
 *     mimeType?: string,
 *     maskB64?: string,    (optional for edit)
 *     size?: '1024x1024' | '1024x1792' | '1792x1024',
 *     quality?: 'standard' | 'hd',
 *     style?: ImageStyle,
 *     n?: 1 | 2 | 4,
 *   }
 *
 * Returns:
 *   - generate/edit → { image: { b64, mimeType, revisedPrompt?, provider, costEstimate, generationMs } }
 *   - analyze       → { analysis: string, provider, costEstimate, generationMs }
 *
 * Security: all API keys are read server-side. No key material is exposed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { imageRouter } from '@/src/services/images';
import type { ImageSize, ImageQuality, ImageStyle } from '@/src/services/images';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = (body.action ?? 'generate') as 'generate' | 'edit' | 'analyze';
    const prompt = String(body.prompt ?? '').trim();
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    if (!imageRouter.isConfigured()) {
      return NextResponse.json({
        error: 'No image provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY in .env.',
      }, { status: 503 });
    }

    if (action === 'generate') {
      const result = await imageRouter.generate({
        prompt,
        size: body.size as ImageSize | undefined,
        quality: body.quality as ImageQuality | undefined,
        style: body.style as ImageStyle | undefined,
        n: body.n as 1 | 2 | 4 | undefined,
      });
      return NextResponse.json({
        image: {
          b64: result.b64,
          mimeType: result.mimeType,
          revisedPrompt: result.revisedPrompt,
          provider: result.provider,
          costEstimate: result.costEstimate,
          generationMs: result.generationMs,
        },
      });
    }

    if (action === 'edit') {
      const imageB64 = String(body.imageB64 ?? '');
      const mimeType = String(body.mimeType ?? 'image/png');
      if (!imageB64) {
        return NextResponse.json({ error: 'imageB64 is required for edit' }, { status: 400 });
      }
      const result = await imageRouter.edit({
        prompt,
        imageB64,
        mimeType,
        maskB64: body.maskB64,
        style: body.style as ImageStyle | undefined,
      });
      return NextResponse.json({
        image: {
          b64: result.b64,
          mimeType: result.mimeType,
          provider: result.provider,
          costEstimate: result.costEstimate,
          generationMs: result.generationMs,
        },
      });
    }

    if (action === 'analyze') {
      const imageB64 = String(body.imageB64 ?? '');
      if (!imageB64) {
        return NextResponse.json({ error: 'imageB64 is required for analyze' }, { status: 400 });
      }
      const result = await imageRouter.analyze({
        prompt,
        imageB64,
        mimeType: body.mimeType,
      });
      return NextResponse.json({
        analysis: result.text,
        provider: result.provider,
        costEstimate: result.costEstimate,
        generationMs: result.generationMs,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ImageRoute] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET /api/images — returns provider availability and history. */
export async function GET() {
  return NextResponse.json({
    configured: imageRouter.isConfigured(),
    providers: imageRouter.selectProvider('generate'),
    history: imageRouter.getHistory().slice(0, 20),
  });
}
