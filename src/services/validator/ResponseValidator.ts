/**
 * ResponseValidator — detects contradictions between realtime context and
 * the model's generated response.
 *
 * If a contradiction is detected, the caller should regenerate the response
 * with a stricter prompt that emphasizes the realtime data.
 *
 * Detection strategy:
 *  1. Extract "candidate facts" from the realtime context (names, numbers,
 *     dates) using lightweight regex heuristics.
 *  2. Check whether each candidate fact appears (or is contradicted) in the
 *     model response.
 *  3. A fact is "contradicted" if a different value of the same category
 *     appears in the response (e.g. realtime says "José Raúl Mulino" but the
 *     response mentions "Laurentino Cortizo").
 */
import type { RealtimeContext } from '@/src/services/realtime/types';

export interface ValidationFinding {
  category: 'person' | 'number' | 'date' | 'keyword';
  realtimeValue: string;
  responseValue: string | null;
  contradicted: boolean;
}

export interface ValidationResult {
  valid: boolean;
  findings: ValidationFinding[];
  reason: string | null;
}

// Capitalized multi-word names (1-4 words), each starting with a capital
// letter, accented vowels allowed. Used to spot person names in text.
const PERSON_RE = /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})\b/g;

// Numbers (including decimals and currency-like values).
const NUMBER_RE = /\b(\d+(?:[.,]\d+)?)\b/g;

// Years and short dates.
const DATE_RE = /\b(19\d{2}|20\d{2}|(?:\d{1,2}\s+de\s+[a-záéíóúñ]+(?:\s+de\s+\d{4})?))\b/gi;

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.map(s => s.trim()))).filter(Boolean);
}

function extractPersons(text: string): string[] {
  const matches = text.match(PERSON_RE) ?? [];
  // Filter out common false positives (sentence-start words).
  const stop = new Set(['El', 'La', 'Los', 'Las', 'Un', 'Una', 'Hoy', 'Ayer', 'Mañana', 'Esta', 'Este', 'Pero', 'Porque', 'Cuando', 'Donde', 'Como', 'Qué', 'Como', 'Y', 'O', 'A', 'En', 'De', 'Para', 'Con', 'Sin', 'Sobre', 'Tras']);
  return uniq(matches).filter(m => !stop.has(m.split(' ')[0]));
}

function extractNumbers(text: string): string[] {
  return uniq(text.match(NUMBER_RE) ?? []);
}

function extractDates(text: string): string[] {
  return uniq(text.match(DATE_RE) ?? []);
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Heuristic: a realtime person is contradicted if the response mentions a
 * different person of the same length (in words) that does NOT share any
 * token with the realtime person.
 */
function isPersonContradicted(realtimePerson: string, responsePersons: string[]): boolean {
  const rt = normalize(realtimePerson);
  const rtTokens = new Set(rt.split(/\s+/));
  for (const rp of responsePersons) {
    const r = normalize(rp);
    if (r === rt) return false; // exact match — no contradiction
    const rTokens = r.split(/\s+/);
    const overlap = rTokens.some(t => rtTokens.has(t));
    if (!overlap && rTokens.length >= 2) {
      // Different name with no shared token — likely a contradiction.
      return true;
    }
  }
  return false;
}

function isNumberContradicted(rt: string, responseNumbers: string[]): boolean {
  const r = normalize(rt);
  return responseNumbers.some(rn => normalize(rn) !== r);
}

export function validateResponse(
  userQuery: string,
  realtime: RealtimeContext | null,
  response: string,
): ValidationResult {
  if (!realtime) {
    return { valid: true, findings: [], reason: null };
  }

  const findings: ValidationFinding[] = [];

  // Build a single text blob from realtime summary + sources.
  const rtBlob = [
    realtime.results.map(r => r.summary ?? '').join('\n'),
    realtime.results.flatMap(r => r.sources.map(s => `${s.title} ${s.snippet ?? ''} ${s.content ?? ''}`)).join('\n'),
  ].join('\n');

  const rtPersons = extractPersons(rtBlob);
  const rtNumbers = extractNumbers(rtBlob);
  const rtDates = extractDates(rtBlob);

  const respPersons = extractPersons(response);
  const respNumbers = extractNumbers(response);
  const respDates = extractDates(response);

  for (const p of rtPersons) {
    const contradicted = isPersonContradicted(p, respPersons);
    findings.push({
      category: 'person',
      realtimeValue: p,
      responseValue: respPersons.find(rp => normalize(rp) !== normalize(p)) ?? null,
      contradicted,
    });
  }

  for (const n of rtNumbers.slice(0, 5)) {
    const contradicted = isNumberContradicted(n, respNumbers);
    if (contradicted) {
      findings.push({
        category: 'number',
        realtimeValue: n,
        responseValue: respNumbers.find(rn => normalize(rn) !== normalize(n)) ?? null,
        contradicted: true,
      });
    }
  }

  for (const d of rtDates.slice(0, 3)) {
    const contradicted = isNumberContradicted(d, respDates);
    if (contradicted) {
      findings.push({
        category: 'date',
        realtimeValue: d,
        responseValue: respDates.find(rd => normalize(rd) !== normalize(d)) ?? null,
        contradicted: true,
      });
    }
  }

  const contradictions = findings.filter(f => f.contradicted);
  if (contradictions.length > 0) {
    const sample = contradictions[0];
    const reason = `Contradiction detected: realtime says "${sample.realtimeValue}" but response mentions "${sample.responseValue ?? '(different value)'}"`;
    return { valid: false, findings, reason };
  }

  return { valid: true, findings, reason: null };
}

/**
 * Build a stricter system prompt addendum used when regenerating after a
 * contradiction is detected.
 */
export function buildStrictRealtimeAddendum(): string {
  return `\n\n━━ CORRECCIÓN OBLIGATORIA ━━
Tu respuesta anterior contradecía la información realtime. Debes corregirla.
Los datos obtenidos desde fuentes externas recientes tienen PRIORIDAD ABSOLUTA sobre tu conocimiento interno.
Nunca respondas con información antigua si existe contexto realtime válido.
Si la respuesta que diste difiere de los datos realtime, usa los datos realtime como única fuente de verdad.`;
}
