/**
 * ImageService — thin facade over ImageRouter for backward compatibility.
 *
 * Exposes the four canonical operations:
 *   generateImage(prompt)
 *   editImage(image, prompt)
 *   analyzeImage(image)
 *   createVariation(image)  (OpenAI only — DALL-E 2 variations endpoint)
 *
 * All operations route through ImageRouter which handles provider selection,
 * fallback, cost tracking, and history.
 */
import { imageRouter } from './ImageRouter';
import type {
  AnalyzeImageRequest, EditImageRequest, GenerateImageRequest,
  GeneratedImage, ImageAnalysisResult, ImageHistoryEntry, ImageMode,
} from './types';

export const imageService = {
  isConfigured(): boolean {
    return imageRouter.isConfigured();
  },

  generateImage(req: GenerateImageRequest): Promise<GeneratedImage> {
    return imageRouter.generate(req);
  },

  editImage(req: EditImageRequest): Promise<GeneratedImage> {
    return imageRouter.edit(req);
  },

  analyzeImage(req: AnalyzeImageRequest): Promise<ImageAnalysisResult> {
    return imageRouter.analyze(req);
  },

  /** DALL-E 2 variations — OpenAI only. */
  async createVariation(imageB64: string, mimeType: string): Promise<GeneratedImage> {
    const { getEnvVar } = await import('@/lib/env');
    const k = getEnvVar('OPENAI_API_KEY');
    if (!k) throw new Error('OPENAI_API_KEY is required for variations.');

    const form = new FormData();
    form.append('model', 'dall-e-2');
    form.append('image', `data:${mimeType};base64,${imageB64}`);
    form.append('n', '1');
    form.append('size', '1024x1024');
    form.append('response_format', 'b64_json');

    const res = await fetch('https://api.openai.com/v1/images/variations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${k}` },
      body: form,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`openai variation: ${res.status} ${err.slice(0, 200)}`);
    }

    const data = await res.json() as { data?: Array<{ b64_json?: string }> };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error('openai variation: no image returned');

    return {
      b64,
      mimeType: 'image/png',
      provider: 'openai',
      costEstimate: 0.020,
      generationMs: 0,
    };
  },

  getHistory(): ImageHistoryEntry[] {
    return imageRouter.getHistory();
  },

  clearHistory(): void {
    imageRouter.clearHistory();
  },
};

export type { ImageMode };
