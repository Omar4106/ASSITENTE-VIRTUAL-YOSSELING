/**
 * ImageRouter — central orchestrator for image generation, editing, and analysis.
 *
 * Responsibilities:
 *  - Detect whether a user message requests an image action (IntentDetector).
 *  - Select the appropriate provider (OpenAI for generation/edit, Gemini for analysis).
 *  - Delegate to ImageService for the actual API call.
 *  - Track cost and timing for each operation.
 *  - Manage a per-instance history of operations.
 *
 * The AI Chat Router never contacts the image APIs directly — when the user
 * intent is image-related, the Chat Router returns a redirect to this service.
 */
import { getEnvVar } from '@/lib/env';
import type {
  AnalyzeImageRequest, GenerateImageRequest, EditImageRequest,
  GeneratedImage, ImageAnalysisResult, ImageHistoryEntry, ImageIntent,
  ImageMode, ImageProviderId, ImageRouterDecision,
} from './types';
import { enhancePrompt, buildNegativePrompt } from './PromptEnhancer';

// ── Intent detection ──────────────────────────────────────────────────────

const GENERATE_KEYWORDS = [
  'crea una imagen', 'crea imagen', 'genera una imagen', 'genera imagen',
  'crea un logo', 'crea logo', 'diseña un logo', 'diseña logo',
  'crea una ilustración', 'crea ilustracion', 'crea una ilustracion',
  'crea una portada', 'crea portada',
  'crea un banner', 'crea banner',
  'crea un flyer', 'crea flyer',
  'crea un póster', 'crea un poster', 'crea póster', 'crea poster',
  'crea una fotografía', 'crea una fotografia', 'crea fotografía', 'crea fotografia',
  'crea una imagen realista', 'crea una imagen anime',
  'dibuja', 'diseña', 'renderiza', 'genera una foto', 'genera foto',
  'crea un dibujo', 'crea dibujo',
];

const EDIT_KEYWORDS = [
  'quita el fondo', 'quitar fondo', 'remover fondo', 'remove background',
  'cambia el color', 'cambiar color', 'mejora la calidad', 'mejorar calidad',
  'agrega', 'elimina el objeto', 'eliminar objeto', 'elimina objeto',
  'transforma el estilo', 'transformar estilo', 'convierte a anime',
  'convierte a dibujo', 'convierte la foto', 'restaura la foto', 'restaura foto',
  'edita la imagen', 'edita imagen', 'editar imagen', 'edita esta',
];

const ANALYZE_KEYWORDS = [
  'qué ves en esta imagen', 'que ves en esta imagen',
  'qué ves en la imagen', 'que ves en la imagen',
  'qué hay en esta imagen', 'que hay en esta imagen',
  'describe la imagen', 'describe esta imagen',
  'analiza la imagen', 'analiza esta imagen', 'analiza imagen',
  'lee la imagen', 'lee esta imagen', 'extrae el texto',
  'ocr', 'reconoce', 'reconocimiento',
  'qué hay en la foto', 'que hay en la foto',
];

const GENERATE_PATTERNS = [
  /crea\w*\s+(una\s+)?imagen\s+de/i,
  /genera\w*\s+(una\s+)?imagen\s+de/i,
  /dibuja\s+\w+/i,
  /diseña\s+\w+/i,
  /renderiza\s+\w+/i,
];

const EDIT_PATTERNS = [
  /convierte\w*\s+(esta\s+)?(foto|imagen)\s+a\s+(anime|dibujo|pintura|óleo|oleo)/i,
  /edita\w*\s+(la\s+)?(imagen|foto)/i,
  /quita\w*\s+el\s+fondo/i,
];

const ANALYZE_PATTERNS = [
  /qu[eé]\s+(ves|hay)\s+en\s+(esta\s+)?(imagen|foto)/i,
  /describe\s+(la|esta)\s+imagen/i,
  /analiza\s+(la|esta)\s+imagen/i,
];

export function detectImageIntent(message: string, hasImageAttachment = false): ImageIntent {
  const text = message.trim();
  if (!text) {
    return { needsImage: false, mode: null, prompt: text, matchedKeywords: [], confidence: 0 };
  }

  const lower = text.toLowerCase();
  const matched: string[] = [];
  let mode: ImageMode | null = null;
  let confidence = 0;

  // Edit must be checked before generate — "edita la imagen" would otherwise
  // not match generate keywords, but "convierte esta foto a anime" contains
  // "anime" which could be confused. We prioritize edit when the user already
  // attached an image AND uses edit keywords.
  const editKwHits = EDIT_KEYWORDS.filter(k => lower.includes(k));
  const editPatHits = EDIT_PATTERNS.filter(p => p.test(text));
  if (editKwHits.length || editPatHits.length) {
    matched.push(...editKwHits, ...editPatHits.map(p => p.source));
    const score = editKwHits.length + editPatHits.length * 2;
    if (score > confidence) {
      confidence = score;
      mode = 'edit';
    }
  }

  const analyzeKwHits = ANALYZE_KEYWORDS.filter(k => lower.includes(k));
  const analyzePatHits = ANALYZE_PATTERNS.filter(p => p.test(text));
  if (analyzeKwHits.length || analyzePatHits.length) {
    matched.push(...analyzeKwHits, ...analyzePatHits.map(p => p.source));
    const score = analyzeKwHits.length + analyzePatHits.length * 2;
    if (score > confidence) {
      confidence = score;
      mode = 'analyze';
    }
  }

  // If the user attached an image and asked a question about it, default to analyze.
  if (hasImageAttachment && !mode && /\b(qu[eé]|describe|analiza|lee|explica)\b/i.test(text)) {
    mode = 'analyze';
    confidence = Math.max(confidence, 2);
    matched.push('imagen adjunta');
  }

  const genKwHits = GENERATE_KEYWORDS.filter(k => lower.includes(k));
  const genPatHits = GENERATE_PATTERNS.filter(p => p.test(text));
  if (genKwHits.length || genPatHits.length) {
    matched.push(...genKwHits, ...genPatHits.map(p => p.source));
    const score = genKwHits.length + genPatHits.length * 2;
    if (score > confidence) {
      confidence = score;
      mode = 'generate';
    }
  }

  const needsImage = Boolean(mode) && confidence > 0;

  return {
    needsImage,
    mode,
    prompt: text,
    matchedKeywords: Array.from(new Set(matched)).filter(k => k.length > 1).slice(0, 12),
    confidence,
  };
}

// ── Provider selection ────────────────────────────────────────────────────

function hasOpenAI(): boolean {
  return Boolean(getEnvVar('OPENAI_API_KEY'));
}
function hasGemini(): boolean {
  return Boolean(getEnvVar('GEMINI_API_KEY'));
}

export function selectProvider(mode: ImageMode | null): ImageRouterDecision {
  if (mode === 'generate') {
    if (hasOpenAI()) return { provider: 'openai', reason: 'OpenAI DALL-E available for generation', fallback: hasGemini() ? 'gemini' : null };
    if (hasGemini()) return { provider: 'gemini', reason: 'Gemini image generation (OpenAI not configured)', fallback: null };
    return { provider: null, reason: 'No image generation provider configured (need OPENAI_API_KEY or GEMINI_API_KEY)', fallback: null };
  }
  if (mode === 'edit') {
    if (hasOpenAI()) return { provider: 'openai', reason: 'OpenAI image edit endpoint available', fallback: null };
    if (hasGemini()) return { provider: 'gemini', reason: 'Gemini fallback for edit (OpenAI not configured)', fallback: null };
    return { provider: null, reason: 'No image edit provider configured (need OPENAI_API_KEY or GEMINI_API_KEY)', fallback: null };
  }
  if (mode === 'analyze') {
    if (hasGemini()) return { provider: 'gemini', reason: 'Gemini vision available for analysis', fallback: hasOpenAI() ? 'openai' : null };
    if (hasOpenAI()) return { provider: 'openai', reason: 'OpenAI GPT-4o vision (Gemini not configured)', fallback: null };
    return { provider: null, reason: 'No image analysis provider configured (need GEMINI_API_KEY or OPENAI_API_KEY)', fallback: null };
  }
  return { provider: null, reason: 'No image mode detected', fallback: null };
}

export function listProviders(): Array<{ id: ImageProviderId; name: string; configured: boolean }> {
  return [
    { id: 'openai', name: 'OpenAI (DALL-E 3 / GPT-4o Vision)', configured: hasOpenAI() },
    { id: 'gemini', name: 'Gemini (Imagen / Vision)', configured: hasGemini() },
  ];
}

// ── Router class ──────────────────────────────────────────────────────────

class ImageRouter {
  private history: ImageHistoryEntry[] = [];
  private readonly maxHistory = 50;

  isConfigured(): boolean {
    return hasOpenAI() || hasGemini();
  }

  detect(message: string, hasImageAttachment = false): ImageIntent {
    return detectImageIntent(message, hasImageAttachment);
  }

  selectProvider(mode: ImageMode | null): ImageRouterDecision {
    return selectProvider(mode);
  }

  async generate(req: GenerateImageRequest): Promise<GeneratedImage> {
    const decision = selectProvider('generate');
    if (!decision.provider) throw new Error(decision.reason);

    const enhanced = req.enhancedPrompt ?? enhancePrompt(req.prompt, req.style, req.quality);
    const negative = buildNegativePrompt(req.style);

    console.log('[Image Router]');
    console.log('[Prompt Detected]');
    console.log(`  original: ${req.prompt.slice(0, 120)}`);
    console.log(`  enhanced: ${enhanced.slice(0, 200)}`);
    console.log('[Provider Selected]');
    console.log(`  provider: ${decision.provider}`);
    console.log(`  reason: ${decision.reason}`);
    console.log('[Generating Image]');
    console.log(`  size: ${req.size ?? '1024x1024'} quality: ${req.quality ?? 'standard'} n: ${req.n ?? 1}`);

    const start = Date.now();
    try {
      const result = await this.callGenerate(decision.provider, { ...req, enhancedPrompt: enhanced }, negative);
      result.generationMs = Date.now() - start;
      console.log('[Image Generated]');
      console.log(`  provider: ${result.provider} time: ${result.generationMs}ms cost: $${result.costEstimate.toFixed(6)}`);
      this.recordHistory({
        kind: 'generate',
        prompt: req.prompt,
        enhancedPrompt: enhanced,
        provider: result.provider,
        size: req.size,
        quality: req.quality,
        style: req.style,
        result,
        generationMs: result.generationMs,
      });
      return result;
    } catch (e) {
      console.error('[Image Router] generation failed:', e);
      if (decision.fallback && decision.fallback !== decision.provider) {
        console.log(`[Image Router] falling back to ${decision.fallback}`);
        const fallbackResult = await this.callGenerate(decision.fallback, { ...req, enhancedPrompt: enhanced }, negative);
        fallbackResult.generationMs = Date.now() - start;
        this.recordHistory({
          kind: 'generate',
          prompt: req.prompt,
          enhancedPrompt: enhanced,
          provider: fallbackResult.provider,
          size: req.size,
          quality: req.quality,
          style: req.style,
          result: fallbackResult,
          generationMs: fallbackResult.generationMs,
        });
        return fallbackResult;
      }
      throw e;
    }
  }

  async edit(req: EditImageRequest): Promise<GeneratedImage> {
    const decision = selectProvider('edit');
    if (!decision.provider) throw new Error(decision.reason);

    const enhanced = enhancePrompt(req.prompt, req.style, 'standard');

    console.log('[Image Router]');
    console.log('[Edit Request]');
    console.log(`  prompt: ${req.prompt.slice(0, 120)}`);
    console.log('[Provider Selected]');
    console.log(`  provider: ${decision.provider}`);
    console.log('[Image Edited]');

    const start = Date.now();
    const result = await this.callEdit(decision.provider, { ...req, prompt: enhanced });
    result.generationMs = Date.now() - start;
    console.log(`  provider: ${result.provider} time: ${result.generationMs}ms`);
    this.recordHistory({
      kind: 'edit',
      prompt: req.prompt,
      enhancedPrompt: enhanced,
      provider: result.provider,
      style: req.style,
      result,
      generationMs: result.generationMs,
    });
    return result;
  }

  async analyze(req: AnalyzeImageRequest): Promise<ImageAnalysisResult> {
    const decision = selectProvider('analyze');
    if (!decision.provider) throw new Error(decision.reason);

    console.log('[Image Router]');
    console.log('[Image Analysis]');
    console.log(`  prompt: ${req.prompt.slice(0, 120)}`);
    console.log('[Provider Selected]');
    console.log(`  provider: ${decision.provider}`);

    const start = Date.now();
    try {
      const result = await this.callAnalyze(decision.provider, req);
      result.generationMs = Date.now() - start;
      console.log(`  provider: ${result.provider} time: ${result.generationMs}ms`);
      console.log(`[Image Analysis] OK — ${result.text.length} chars`);
      this.recordHistory({
        kind: 'analyze',
        prompt: req.prompt,
        provider: result.provider,
        analysis: result.text,
        generationMs: result.generationMs,
      });
      return result;
    } catch (e) {
      if (decision.fallback && decision.fallback !== decision.provider) {
        console.log(`[Image Router] analysis fallback to ${decision.fallback}`);
        const fallbackResult = await this.callAnalyze(decision.fallback, req);
        fallbackResult.generationMs = Date.now() - start;
        this.recordHistory({
          kind: 'analyze',
          prompt: req.prompt,
          provider: fallbackResult.provider,
          analysis: fallbackResult.text,
          generationMs: fallbackResult.generationMs,
        });
        return fallbackResult;
      }
      throw e;
    }
  }

  getHistory(): ImageHistoryEntry[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  // ── Private: provider dispatch ──────────────────────────────────────────

  private async callGenerate(
    provider: ImageProviderId,
    req: GenerateImageRequest,
    negativePrompt: string,
  ): Promise<GeneratedImage> {
    if (provider === 'openai') {
      const { generateWithOpenAI } = await import('./providers/openai');
      return generateWithOpenAI(req);
    }
    const { generateWithGemini } = await import('./providers/gemini');
    return generateWithGemini(req, negativePrompt);
  }

  private async callEdit(provider: ImageProviderId, req: EditImageRequest): Promise<GeneratedImage> {
    if (provider === 'openai') {
      const { editWithOpenAI } = await import('./providers/openai');
      return editWithOpenAI(req);
    }
    const { editWithGemini } = await import('./providers/gemini');
    return editWithGemini(req);
  }

  private async callAnalyze(provider: ImageProviderId, req: AnalyzeImageRequest): Promise<ImageAnalysisResult> {
    if (provider === 'openai') {
      const { analyzeWithOpenAI } = await import('./providers/openai');
      return analyzeWithOpenAI(req);
    }
    const { analyzeWithGemini } = await import('./providers/gemini');
    return analyzeWithGemini(req);
  }

  private recordHistory(entry: Omit<ImageHistoryEntry, 'id' | 'createdAt'>): void {
    this.history.unshift({
      ...entry,
      id: Math.random().toString(36).slice(2, 11),
      createdAt: Date.now(),
    });
    if (this.history.length > this.maxHistory) this.history.length = this.maxHistory;
  }
}

export const imageRouter = new ImageRouter();
export type { ImageRouter };
