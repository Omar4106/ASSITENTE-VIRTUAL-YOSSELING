/**
 * YOSSELING SECURITY MODULE
 * Input sanitization, XSS prevention, prompt injection detection, rate limiting.
 */

// ── HTML Entity Escaping ───────────────────────────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"'`/]/g, ch => HTML_ENTITIES[ch] ?? ch);
}

// ── Input Sanitization ─────────────────────────────────────────────────────

const DANGEROUS_HTML_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^>]*>/gi,
  /on\w+\s*=\s*"[^"]*"/gi,
  /on\w+\s*=\s*'[^']*'/gi,
  /on\w+\s*=\s*[^\s>]+/gi,
  /javascript:\s*[^\s>]*/gi,
  /data:\s*text\/html[^\s>]*/gi,
  /vbscript:\s*[^\s>]*/gi,
];

export function sanitizeHtml(text: string): string {
  let result = text;
  for (const pattern of DANGEROUS_HTML_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result;
}

export function sanitizeInput(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let result = text.slice(0, 50000);
  result = sanitizeHtml(result);
  return result;
}

export function sanitizeCodeBlock(code: string): string {
  if (!code || typeof code !== 'string') return '';
  return code.slice(0, 100000);
}

// ── Prompt Injection Detection ─────────────────────────────────────────────

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
  /forget\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
  /you\s+are\s+(?:now|actually)\s+(?:not\s+)?(?:an?\s+)?(?:ai|assistant|chatbot|gpt|claude|gemini|llama)/i,
  /(?:reveal|show|print|output|display)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|rules?)/i,
  /(?:reveal|show|expose|leak)\s+(?:your\s+)?(?:api\s+)?(?:key|keys|secret|token|password)/i,
  /(?:what|which)\s+(?:are|is)\s+your\s+(?:system\s+)?(?:prompt|instructions?|rules?)/i,
  /(?:act|pretend|roleplay)\s+as\s+(?:if\s+you\s+(?:are|were)\s+)?(?:not\s+)?(?:an?\s+)?(?:ai|assistant|chatbot)/i,
  /(?:override|bypass|disable|deactivate)\s+(?:your\s+)?(?:safety|security|content|filter)\s+(?:filter|guard|rules?|measures?)/i,
  /\[\s*system\s*\]/i,
  /#{1,3}\s*system\s*(?:prompt|instruction|message)/i,
  /(?:enter|switch|go)\s+(?:to\s+)?(?:developer|admin|root|debug|jailbreak)\s+mode/i,
  /(?:do\s+anything\s+now|DAN)/i,
];

export interface PromptInjectionResult {
  detected: boolean;
  patterns: string[];
}

export function detectPromptInjection(text: string): PromptInjectionResult {
  if (!text || typeof text !== 'string') return { detected: false, patterns: [] };
  const matched: string[] = [];
  for (let i = 0; i < PROMPT_INJECTION_PATTERNS.length; i++) {
    if (PROMPT_INJECTION_PATTERNS[i].test(text)) {
      matched.push(`pattern_${i}`);
    }
  }
  return { detected: matched.length > 0, patterns: matched };
}

export const PROMPT_INJECTION_RESPONSE =
  'Entiendo lo que intentas, pero no puedo cambiar mis reglas básicas de comportamiento ni revelar información interna sobre mi configuración. Estoy aquí para ayudarte de la mejor manera posible dentro de mis normas de seguridad. ¿En qué más puedo apoyarte?';

// ── Rate Limiting (in-memory) ──────────────────────────────────────────────

interface RateBucket {
  count: number;
  resetAt: number;
}

const RATE_BUCKETS = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 30;
const RATE_MAX_IMAGE = 10;

export function checkRateLimit(
  identifier: string,
  maxRequests: number = RATE_MAX_REQUESTS,
  windowMs: number = RATE_WINDOW_MS,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(identifier);

  if (!bucket || now > bucket.resetAt) {
    RATE_BUCKETS.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  bucket.count += 1;
  const allowed = bucket.count <= maxRequests;
  return { allowed, remaining: Math.max(0, maxRequests - bucket.count), resetAt: bucket.resetAt };
}

export function getImageRateLimit(identifier: string) {
  return checkRateLimit(identifier, RATE_MAX_IMAGE, RATE_WINDOW_MS);
}

// ── File Safety ────────────────────────────────────────────────────────────

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_TEXT_LENGTH = 120_000;

const EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'dll', 'bin', 'msi', 'so', 'dylib', 'app',
  'sh', 'bat', 'cmd', 'ps1', 'vbs', 'scr', 'com', 'jar',
]);

const CODE_EXTENSIONS = new Set([
  'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'rs', 'go', 'java',
  'py', 'js', 'jsx', 'ts', 'tsx', 'rb', 'php', 'pl', 'lua',
  'sql', 'html', 'css', 'xml', 'yaml', 'yml', 'json', 'toml',
]);

export function isExecutableFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return EXECUTABLE_EXTENSIONS.has(ext);
}

export function isCodeFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return CODE_EXTENSIONS.has(ext);
}

export function safeFileContent(name: string, content: string): string {
  if (isExecutableFile(name)) {
    return `[Archivo binario: ${name}]\nEl contenido se trata como texto estático. No se ejecutará ni compilará.\n\n${escapeHtml(content.slice(0, MAX_TEXT_LENGTH))}`;
  }
  return content.slice(0, MAX_TEXT_LENGTH);
}

// ── Client IP Extraction ───────────────────────────────────────────────────

export function getClientIp(request: Request): string {
  const headers = new Headers(request.headers);
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  );
}
