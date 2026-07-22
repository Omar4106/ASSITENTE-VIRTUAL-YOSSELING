/**
 * Image Service — shared types.
 *
 * All API keys are server-side only. No key material ever crosses to the
 * frontend. These types describe the public surface of the image pipeline.
 */

export type ImageProviderId = 'openai' | 'gemini';

export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';
export type ImageQuality = 'low' | 'medium' | 'high';
export type ImageStyle =
  | 'realista' | 'anime' | 'disney' | 'pixel-art' | 'cyberpunk'
  | 'futurista' | 'minimalista' | 'fotografia' | 'arquitectura'
  | 'logo' | 'vector' | '3d' | 'concept-art';

export type ImageMode = 'generate' | 'edit' | 'analyze';

export interface GenerateImageRequest {
  prompt: string;
  enhancedPrompt?: string;
  size?: ImageSize;
  quality?: ImageQuality;
  style?: ImageStyle;
  n?: 1 | 2 | 4;
}

export interface EditImageRequest {
  prompt: string;
  imageB64: string;
  mimeType: string;
  maskB64?: string;
  style?: ImageStyle;
  quality?: ImageQuality;
}

export interface AnalyzeImageRequest {
  prompt: string;
  imageB64: string;
  mimeType?: string;
}

export interface GeneratedImage {
  b64: string;
  mimeType: string;
  revisedPrompt?: string;
  provider: ImageProviderId;
  costEstimate: number;
  generationMs: number;
}

export interface ImageAnalysisResult {
  text: string;
  provider: ImageProviderId;
  costEstimate: number;
  generationMs: number;
}

export interface ImageHistoryEntry {
  id: string;
  kind: ImageMode;
  prompt: string;
  enhancedPrompt?: string;
  createdAt: number;
  provider: ImageProviderId;
  size?: ImageSize;
  quality?: ImageQuality;
  style?: ImageStyle;
  result?: GeneratedImage;
  analysis?: string;
  error?: string;
  generationMs?: number;
}

export interface ImageIntent {
  needsImage: boolean;
  mode: ImageMode | null;
  prompt: string;
  matchedKeywords: string[];
  confidence: number;
}

export interface ImageProviderInfo {
  id: ImageProviderId;
  name: string;
  supportsGeneration: boolean;
  supportsEditing: boolean;
  supportsAnalysis: boolean;
  isConfigured: boolean;
}

export interface ImageRouterDecision {
  provider: ImageProviderId | null;
  reason: string;
  fallback: ImageProviderId | null;
}
