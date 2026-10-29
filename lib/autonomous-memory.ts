export interface AutonomousMemory {
  category: string;
  content: string;
  importanceScore: number;
}

const NICKNAME_PATTERNS = [
  /(?:llámame|llamame|puedes llamarme)\s+([^\.,;!\?\n]{2,40})/i,
  /mi apodo(?: es)?\s+([^\.,;!\?\n]{2,40})/i,
];

export function detectPreferredNickname(text: string): string | null {
  for (const pattern of NICKNAME_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().slice(0, 40);
  }
  return null;
}

export function detectAutonomousMemories(text: string): AutonomousMemory[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const memories: AutonomousMemory[] = [];

  if (/(?:me llamo|mi nombre es)\s+([^\.,;!\?\n]{2,40})/i.test(trimmed)) {
    memories.push({ category: 'personal', content: trimmed, importanceScore: 85 });
  }
  if (/(?:me gusta(?:n)?|no me gusta(?:n)?|prefiero|mi favorito|mi favorita)\b/i.test(lower)) {
    memories.push({ category: 'preferences', content: trimmed, importanceScore: 70 });
  }
  if (/^(?:llámame|llamame|puedes llamarme|mi apodo)\b/i.test(trimmed)) {
    memories.push({ category: 'personal', content: trimmed, importanceScore: 90 });
  }
  if (/next\.js|react|typescript|javascript|python|desarrollo|programación|proyecto/i.test(lower)) {
    memories.push({ category: 'development', content: trimmed, importanceScore: 65 });
  }
  if (/(?:tengo|soy alérgico|soy alergico|mi número|mi email|mi correo)\b/i.test(lower)) {
    memories.push({ category: 'personal', content: trimmed, importanceScore: 95 });
  }

  const unique = new Map<string, AutonomousMemory>();
  for (const memory of memories) {
    unique.set(`${memory.category}:${memory.content.toLowerCase()}`, memory);
  }
  return Array.from(unique.values()).slice(0, 4);
}
