import type { MemoryItem, MemoryCategory, MemoryImportance, MemoryType } from '@/types';

export interface DetectedMemory {
  title: string;
  content: string;
  category: MemoryCategory;
  type: MemoryType;
  importance: MemoryImportance;
  tags: string[];
}

const CATEGORY_KEYWORDS: [MemoryCategory, string[]][] = [
  ['personal',     ['me llamo', 'mi nombre es', 'tengo ... años', 'soy de', 'vivo en', 'nací en', 'cumpleaños']],
  ['trabajo',      ['trabajo en', 'mi trabajo', 'mi empresa', 'mi jefe', 'mi cargo', 'soy ... en']],
  ['estudios',     ['estudio', 'universidad', 'carrera', 'examen', 'tarea', 'curso', 'escuela']],
  ['familia',      ['mi esposa', 'mi esposo', 'mi pareja', 'mi hijo', 'mi hija', 'mi madre', 'mi padre', 'mi hermano', 'mi hermana']],
  ['mascotas',     ['mi perro', 'mi gato', 'mi mascota', 'mi conejo', 'mi tortuga']],
  ['preferencias', ['me gusta', 'no me gusta', 'prefiero', 'odio', 'amo', 'mi favorito', 'mi favorita', 'detesto', 'disfruto']],
  ['proyectos',    ['estoy construyendo', 'estoy desarrollando', 'mi proyecto', 'estoy creando', 'estoy trabajando en']],
  ['objetivos',    ['mi meta', 'mi objetivo', 'quiero aprender', 'planeo', 'aspiración']],
  ['hobbies',      ['mi hobby', 'juego', 'toco', 'instrumento', 'pintar', 'leer', 'cocinar', 'viajar', 'fotografía']],
];

const MEMORY_PATTERNS: Array<[RegExp, string]> = [
  [/(?:mi nombre es|me llamo)\s+([^\.,;!\?\n]{2,40})/i, 'nombre'],
  [/tengo\s+(\d{1,3})\s+años/i, 'edad'],
  [/(?:vivo en|soy de|nací en)\s+([^\.,;!\?\n]{2,40})/i, 'lugar'],
  [/trabajo en\s+([^\.,;!\?\n]{2,40})/i, 'trabajo'],
  [/(?:estudio|estudio en)\s+([^\.,;!\?\n]{2,40})/i, 'estudios'],
  [/(?:mi perro|mi gato|mi mascota)\s+(?:se llama|es)\s+([^\.,;!\?\n]{2,40})/i, 'mascota'],
  [/(?:me gusta(?:n)?|amo)\s+(?:el|la|los|las|mucho)?\s*([^\.,;!\?\n]{2,40})/i, 'gusto'],
  [/(?:no me gusta(?:n)?|odio|detesto)\s+([^\.,;!\?\n]{2,40})/i, 'disgusto'],
  [/(?:mi meta|mi objetivo)\s+(?:es|para)\s+([^\.,;!\?\n]{2,60})/i, 'objetivo'],
  [/(?:estoy trabajando en|estoy construyendo|estoy desarrollando)\s+([^\.,;!\?\n]{2,60})/i, 'proyecto'],
  [/(?:mi esposa|mi esposo|mi pareja|mi novio|mi novia)\s+(?:se llama|es)\s+([^\.,;!\?\n]{2,40})/i, 'pareja'],
  [/(?:mi hijo|mi hija|mi madre|mi padre|mi hermano|mi hermana)\s+(?:se llama|es)\s+([^\.,;!\?\n]{2,40})/i, 'familia'],
];

function inferCategory(text: string): MemoryCategory {
  const lower = text.toLowerCase();
  for (const [cat, kws] of CATEGORY_KEYWORDS) {
    if (kws.some(kw => lower.includes(kw.replace('...', '')))) return cat;
  }
  return 'otros';
}

function inferImportance(text: string): MemoryImportance {
  const lower = text.toLowerCase();
  const highKw = ['alergia', 'alérgico', 'medicamento', 'condición médica', 'urgente', 'crítico'];
  const lowKw  = ['quizás', 'tal vez', 'a veces', 'ocasionalmente'];
  if (highKw.some(k => lower.includes(k))) return 'high';
  if (lowKw.some(k => lower.includes(k))) return 'low';
  return 'medium';
}

function inferType(text: string): MemoryType {
  const lower = text.toLowerCase();
  const temporalKw = ['hoy', 'mañana', 'esta semana', 'este mes', 'temporalmente', 'por ahora', 'próximo'];
  const prefKw = ['me gusta', 'no me gusta', 'prefiero', 'odio', 'favorito'];
  if (temporalKw.some(k => lower.includes(k))) return 'temporal';
  if (prefKw.some(k => lower.includes(k))) return 'preference';
  return 'persistent';
}

export function detectMemory(text: string, existing: MemoryItem[]): DetectedMemory[] {
  const results: DetectedMemory[] = [];
  const seen = new Set<string>();

  for (const [pattern] of MEMORY_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const fullMatch = match[0].trim();
    const key = fullMatch.toLowerCase().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    // Skip if already stored
    if (existing.some(m =>
      m.content.toLowerCase().includes((match[1] ?? '').trim().toLowerCase()) &&
      (match[1] ?? '').trim().length > 3
    )) continue;

    const title = fullMatch.length > 55 ? fullMatch.slice(0, 52) + '...' : fullMatch;
    results.push({
      title,
      content: fullMatch,
      category: inferCategory(fullMatch),
      type: inferType(fullMatch),
      importance: inferImportance(fullMatch),
      tags: CATEGORY_KEYWORDS
        .filter(([, kws]) => kws.some(kw => fullMatch.toLowerCase().includes(kw.replace('...', ''))))
        .map(([cat]) => cat),
    });
  }
  return results;
}

export function isDuplicate(item: MemoryItem, existing: MemoryItem[]): boolean {
  return existing.some(m =>
    m.title.toLowerCase() === item.title.toLowerCase() ||
    (m.content.toLowerCase() === item.content.toLowerCase() && m.content.length > 3)
  );
}

export function createMemoryItem(d: DetectedMemory, source: 'auto' | 'manual' = 'auto'): MemoryItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: d.title,
    content: d.content,
    category: d.category,
    type: d.type,
    importance: d.importance,
    tags: d.tags,
    source,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function buildMemoryContext(memory: MemoryItem[]): string {
  if (memory.length === 0) return '';
  const sorted = [...memory].sort((a, b) => {
    const ord: Record<MemoryImportance, number> = { high: 0, medium: 1, low: 2 };
    return ord[a.importance] - ord[b.importance];
  });
  const lines = sorted.map(m => `- ${m.title}: ${m.content}`);
  return lines.join('\n');
}

export function exportMemory(memory: MemoryItem[], format: 'json' | 'txt' | 'md'): string {
  if (format === 'json') return JSON.stringify(memory, null, 2);
  if (format === 'md') {
    return `# Memorias de Yosseling\n\n` + memory.map(m =>
      `### ${m.title}\n- **Categoría:** ${m.category}\n- **Importancia:** ${m.importance}\n- **Tipo:** ${m.type}\n- **Contenido:** ${m.content}\n`
    ).join('\n');
  }
  return memory.map(m => `[${m.category}] ${m.title}: ${m.content}`).join('\n');
}

export function parseMemoryImport(json: string): Partial<MemoryItem>[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((i: unknown): i is Partial<MemoryItem> =>
      typeof i === 'object' && i !== null && ('title' in i || 'content' in i)
    );
  } catch { return []; }
}
