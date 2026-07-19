/**
 * Image generation / edit / analyze endpoint.
 *
 * POST /api/images
 *   body: { action: 'generate' | 'edit' | 'analyze', prompt, imageB64?, mimeType?, size?, quality?, style? }
 *
 * Returns: { image: { b64, mimeType, revisedPrompt? } } for generate/edit,
 *          { analysis: string } for analyze.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  imageGenerationService,
  recordImageHistory,
  type ImageSize, type ImageQuality, type ImageStyle,
} from '@/src/services/images';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = (body.action ?? 'generate') as 'generate' | 'edit' | 'analyze';
    const prompt = String(body.prompt ?? '').trim();
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    if (!imageGenerationService.isConfigured()) {
      return NextResponse.json({
        error: 'No image provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY in .env.',
      }, { status: 503 });
    }

    const id = Math.random().toString(36).slice(2, 11);
    const createdAt = Date.now();

    if (action === 'generate') {
      const result = await imageGenerationService.generateImage({
        prompt,
        size: body.size as ImageSize | undefined,
        quality: body.quality as ImageQuality | undefined,
        style: body.style as ImageStyle | undefined,
      });
      recordImageHistory({
        id, kind: 'generate', prompt, createdAt,
        provider: result.provider, result,
      });
      return NextResponse.json({
        image: {
          b64: result.b64,
          mimeType: result.mimeType,
          revisedPrompt: result.revisedPrompt,
          provider: result.provider,
        },
      });
    }

    if (action === 'edit') {
      const imageB64 = String(body.imageB64 ?? '');
      const mimeType = String(body.mimeType ?? 'image/png');
      if (!imageB64) {
        return NextResponse.json({ error: 'imageB64 is required for edit' }, { status: 400 });
      }
      const result = await imageGenerationService.editImage(prompt, imageB64, mimeType, body.maskB64);
      recordImageHistory({
        id, kind: 'edit', prompt, createdAt,
        provider: result.provider, result,
      });
      return NextResponse.json({
        image: { b64: result.b64, mimeType: result.mimeType, provider: result.provider },
      });
    }

    if (action === 'analyze') {
      const imageB64 = String(body.imageB64 ?? '');
      if (!imageB64) {
        return NextResponse.json({ error: 'imageB64 is required for analyze' }, { status: 400 });
      }
      const analysis = await imageGenerationService.analyzeImage({
        prompt,
        imageB64,
        mimeType: body.mimeType,
      });
      recordImageHistory({
        id, kind: 'analyze', prompt, createdAt,
        provider: 'gemini', analysis,
      });
      return NextResponse.json({ analysis });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ImageRoute] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
