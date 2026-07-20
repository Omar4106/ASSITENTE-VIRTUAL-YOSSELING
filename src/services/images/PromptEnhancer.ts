/**
 * PromptEnhancer — transforms simple user prompts into professional,
 * model-friendly prompts by applying style presets, quality modifiers,
 * and composition rules.
 *
 * Example:
 *   "hotel frente al mar" + style "fotografia"
 *   →
 *   "Luxury beachfront hotel at sunset, modern architecture, palm trees,
 *    cinematic lighting, ultra realistic, 8k, professional photography,
 *    high detail"
 */
import type { ImageStyle } from './types';

interface StylePreset {
  id: ImageStyle;
  label: string;
  positive: string[];
  negative: string[];
}

const STYLE_PRESETS: Record<ImageStyle, StylePreset> = {
  'realista': {
    id: 'realista',
    label: 'Realista',
    positive: ['ultra realistic', 'photorealistic', 'natural lighting', 'high detail', '8k', 'professional photography'],
    negative: ['cartoon', 'anime', 'painting', 'illustration'],
  },
  'anime': {
    id: 'anime',
    label: 'Anime',
    positive: ['anime style', 'cel shading', 'vibrant colors', 'studio quality', 'detailed line art'],
    negative: ['photorealistic', '3d render', 'oil painting'],
  },
  'disney': {
    id: 'disney',
    label: 'Disney',
    positive: ['Disney Pixar style', '3d animation', 'soft lighting', 'expressive characters', 'cinematic'],
    negative: ['photorealistic', 'horror', 'dark'],
  },
  'pixel-art': {
    id: 'pixel-art',
    label: 'Pixel Art',
    positive: ['pixel art', '8-bit', 'retro game style', 'limited palette', 'crisp pixels'],
    negative: ['smooth gradients', 'photorealistic', '3d'],
  },
  'cyberpunk': {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    positive: ['cyberpunk aesthetic', 'neon lights', 'futuristic city', 'rain-soaked streets', 'blade runner mood', 'cinematic'],
    negative: ['pastoral', 'medieval', 'soft pastel'],
  },
  'futurista': {
    id: 'futurista',
    label: 'Futurista',
    positive: ['futuristic design', 'sleek surfaces', 'holographic elements', 'advanced technology', 'cinematic lighting'],
    negative: ['retro', 'vintage', 'worn'],
  },
  'minimalista': {
    id: 'minimalista',
    label: 'Minimalista',
    positive: ['minimalist composition', 'clean lines', 'negative space', 'subtle palette', 'elegant'],
    negative: ['cluttered', 'ornate', 'busy'],
  },
  'fotografia': {
    id: 'fotografia',
    label: 'Fotografía',
    positive: ['professional photography', 'depth of field', 'golden hour lighting', 'shot on Canon EOS R5', '50mm lens', 'ultra detailed'],
    negative: ['digital art', 'painting', 'cartoon'],
  },
  'arquitectura': {
    id: 'arquitectura',
    label: 'Arquitectura',
    positive: ['architectural visualization', 'modern building', 'clean geometry', 'ambient occlusion', 'v-ray render', 'professional'],
    negative: ['cluttered interior', 'low detail'],
  },
  'logo': {
    id: 'logo',
    label: 'Logo',
    positive: ['minimalist logo design', 'vector style', 'bold silhouette', 'clean typography', 'scalable', 'professional brand identity'],
    negative: ['photorealistic', 'gradient mesh', 'complex detail'],
  },
  'vector': {
    id: 'vector',
    label: 'Vector',
    positive: ['flat vector illustration', 'clean shapes', 'limited color palette', 'scalable', 'geometric'],
    negative: ['photorealistic', '3d', 'texture'],
  },
  '3d': {
    id: '3d',
    label: '3D',
    positive: ['3d render', 'octane render', 'subsurface scattering', 'physically based materials', 'ray tracing', 'cinematic lighting'],
    negative: ['flat', '2d', 'sketch'],
  },
  'concept-art': {
    id: 'concept-art',
    label: 'Concept Art',
    positive: ['concept art', 'matte painting', 'epic composition', 'dramatic lighting', 'ArtStation trending', 'highly detailed'],
    negative: ['snapshot', 'low detail'],
  },
};

const QUALITY_MODIFIERS: Record<string, string[]> = {
  hd: ['ultra high definition', 'sharp focus', 'maximum detail'],
  standard: ['high quality', 'well-composed'],
};

const COMPOSITION_TAIL = 'centered composition, professional color grading, masterpiece';

/**
 * Enhance a user prompt with style + quality modifiers.
 *
 * - Keeps the original text as the subject.
 * - Prepends style positive modifiers.
 * - Appends quality + composition tail.
 * - Returns a single comma-separated string suitable for DALL-E / Gemini.
 */
export function enhancePrompt(
  userPrompt: string,
  style?: ImageStyle,
  quality?: 'standard' | 'hd',
): string {
  const subject = userPrompt.trim();
  if (!subject) return '';

  const parts: string[] = [];

  const preset = style ? STYLE_PRESETS[style] : null;
  if (preset) {
    parts.push(...preset.positive);
  }

  parts.push(subject);

  const qMods = QUALITY_MODIFIERS[quality ?? 'standard'] ?? QUALITY_MODIFIERS.standard;
  parts.push(...qMods);
  parts.push(COMPOSITION_TAIL);

  return parts.join(', ');
}

/**
 * Build a negative-prompt string for providers that support it (Gemini image
 * generation accepts a separate "avoid" hint). OpenAI ignores this.
 */
export function buildNegativePrompt(style?: ImageStyle): string {
  if (!style) return '';
  const preset = STYLE_PRESETS[style];
  if (!preset || !preset.negative.length) return '';
  return `Avoid: ${preset.negative.join(', ')}`;
}

export function getStylePresets(): StylePreset[] {
  return Object.values(STYLE_PRESETS);
}

export function getPresetLabel(style: ImageStyle): string {
  return STYLE_PRESETS[style]?.label ?? style;
}
