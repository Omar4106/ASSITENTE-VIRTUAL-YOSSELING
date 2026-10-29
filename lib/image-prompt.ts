import { sanitizeInput } from '@/lib/security';

export interface OptimizedImagePrompt {
  original: string;
  subject: string;
  prompt: string;
  category: 'multiplication-table' | 'text-layout' | 'general';
}

const TEXT_LAYOUT_QUALITY = [
  'ultra-detailed',
  'sharp focus',
  '8k resolution',
  'crisp typography',
  'highly legible clear Arabic numerals',
  'crisp vector grid',
  'high resolution 1024x1024',
  'clean layout',
  'optimized sampling',
  'typography focused',
].join(', ');

function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function extractSubject(prompt: string): string {
  return prompt
    .replace(/^\s*(?:(?:por favor|please)\s+)?(?:genera(?:r)?|crea(?:r)?|dibuja(?:r)?|ilustra(?:r)?|pinta(?:r)?|diseña(?:r)?|haz(?:me)?|hacer)\s+(?:una?\s+)?(?:(?:imagen|ilustracion|dibujo|retrato|foto|poster|grafico)\s+(?:de|sobre|que\s+muestre)\s+)?/i, '')
    .replace(/^\s*(?:una?\s+)?(?:imagen|ilustracion|dibujo|retrato|foto)\s+(?:de|sobre)\s+/i, '')
    .trim();
}

function makeMultiplicationTablePrompt(subject: string): string {
  const rows = Array.from({ length: 10 }, (_, row) =>
    Array.from({ length: 10 }, (_, column) => `${row + 1} × ${column + 1} = ${(row + 1) * (column + 1)}`).join(' | '),
  ).join('\n');

  return [
    `Create exactly the educational graphic requested by the user: "${subject}".`,
    'This is a multiplication table, not a map, antique document, landscape, or unrelated illustration.',
    `Design a clean, modern, classroom-ready multiplication chart from 1 to 10. clean mathematical multiplication table grid, perfectly aligned rows and columns, legible Arabic numerals, high contrast, minimalist educational chart, zero distortion, ${TEXT_LAYOUT_QUALITY}. Use a straight front-facing flat layout, a clear 10-by-10 grid, aligned rows and columns, large highly legible dark numerals, a simple title in Spanish ("Tabla de multiplicar"), and a restrained colorful accent palette on a bright uncluttered background. Prefer clean graphic-design styling, precise defined lines, and a flat vector-like finish; avoid abstract art, painterly, soft-focus, textured, blurry, garbled text, or deformed numerals.`, 
    'Reproduce these equations accurately and in this order; do not omit, reorder, alter, or invent entries:',
    rows,
    'No perspective, decoration over the equations, extra labels, maps, borders that obscure text, or unrelated objects.',
  ].join('\n');
}

export function optimizeImagePrompt(input: string): OptimizedImagePrompt {
  const original = sanitizeInput(input).trim();
  const subject = extractSubject(original) || original;
  const normalized = normalizeText(subject);
  const isMultiplicationTable = /\b(?:tabla(?:s)?\s+de\s+multiplicar|tablas?|multiplic(?:ar|acion)|multiplication\s+(?:table|chart)|numeros?|numbers?|esquema(?:s)?\s+estructurado(?:s)?|structured\s+(?:chart|diagram))\b/.test(normalized);
  const isTextLayout = /\b(?:table|tables|chart|charts|documento|documentos|document|documents|cartel|carteles|poster|posters|letrero|letreros|infografia|infografias|infographic|infographics|diagrama|diagramas|diagram|diagrams|esquema|esquemas|schematic|schematics|hoja de trabajo|worksheet|worksheets|texto|text|tipografia|typography|numerales?)\b/.test(normalized);
  const category = isMultiplicationTable
    ? 'multiplication-table'
    : isTextLayout
      ? 'text-layout'
      : 'general';

  const prompt = category === 'multiplication-table'
    ? makeMultiplicationTablePrompt(subject)
    : category === 'text-layout'
      ? [
        `Create a clean, precise graphic-design layout depicting exactly this user-requested subject: "${subject}".`,
        `The user's original wording is "${original}". Preserve its subject, requested wording, spelling, language, numbers, and constraints.`,
        `Render requested text and numbers prominently and accurately, with clear spacing and strong contrast. ${TEXT_LAYOUT_QUALITY}.`,
        'Use clean mathematical table grid structure for every tabular request: perfectly aligned rows and columns, crisp borders, high contrast, minimalist educational chart, zero distortion, and no abstract art. Use clean graphic-design styling, crisp defined lines, a flat front-facing composition, and a simple uncluttered background. Avoid painterly or textured rendering, blur, soft focus, perspective distortion, decorative elements behind text, illegible glyphs, deformed numerals, or unrelated content.',
      ].join('\n')
      : [
        `Create an image depicting exactly this user-requested subject: "${subject}".`,
        `The user's original wording is "${original}". Preserve its subject, named objects, requested text, language, and constraints.`,
        'Do not replace the requested subject with another topic, do not add unrelated themes (especially maps or antique documents unless explicitly requested), and do not use prior conversation or image context.',
        'Use a clear composition that makes the requested subject immediately recognizable.',
      ].join('\n');

  return { original, subject, prompt, category };
}

export function logImagePromptMetadata(
  route: string,
  requestId: string,
  optimized: OptimizedImagePrompt,
  provider: string,
): void {
  console.info(`[${route}] Prompt prepared`, {
    requestId,
    provider,
    category: optimized.category,
    inputCharacters: optimized.original.length,
    subjectCharacters: optimized.subject.length,
    optimizedPromptCharacters: optimized.prompt.length,
  });
}
