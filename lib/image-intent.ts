const IMAGE_REQUEST_PATTERN = /(?:genera(?:r)?|crear?|dibuja(?:r)?|imagina|ilustra(?:r)?|pinta(?:r)?|dise[ñn]a(?:r)?|haz(?:me)?|hacer).*?(?:imagen|ilustraci[oó]n|dibujo|retrato|escena|logo|p[oó]ster|poster|fondo|wallpaper|avatar|foto|gr[aá]fico|gr[aá]fica)|^(?:imagina|dibuja|pinta|ilustra)\b/i;

export function isImageGenerationRequest(text: string): boolean {
  return IMAGE_REQUEST_PATTERN.test(text.trim());
}

const OFFLINE_INTENT_PATTERN = /(?:sin\s*(?:conexi[oó]n|internet|se[ñn]al|red)|offline|modo\s*local|sin\s*red|desconectad|sin\s*internt|puedes?\s+(?:funcionar|responder|trabajar)\s+sin|usar\s+sin\s*(?:inter|conexi|se[ñn]al)|descarga\s+(?:el\s+)?modo\s*local|c[oó]mo\s+te\s+uso\s+sin)/i;

export function isOfflineModeIntent(text: string): boolean {
  return OFFLINE_INTENT_PATTERN.test(text.trim());
}

const AFFIRMATION_PATTERN = /^(?:s[ií]|dale|ok|okay|claro|por\s+supuesto|adelante|confirmo|afirmativo|s[ií]gueme|ve|hazlo|instal|descarga|quiero|acepto)\b/i;

export function isAffirmation(text: string): boolean {
  return AFFIRMATION_PATTERN.test(text.trim());
}

// ── Device optimization intent ─────────────────────────────────────────────

const OPTIMIZATION_PATTERN = /(?:mi\s+(?:pc|computadora|laptop|notebook|celular|m[oó]vil|tel[eé]fono|equipo|dispositivo|android|windows)).*?(?:lento|lenta|trabado|trabada|len)?|(?:lento|lenta|trabado|trabada|colgado|colgada|optimi[sz]ar|limpiar|acelerar|liberar\s+(?:memoria|espacio)|borrar\s+(?:cach[eé]|temp)|sin\s+espacio|poco\s+espacio|rendimiento|agilizar|velocidad\s+(?:de\s+)?(?:respuesta|t[aá]ctil))|(?:optimi[sz]a|acelera|limpia)\s+(?:mi\s+)?(?:pc|celular|m[oó]vil|tel[eé]fono|equipo|dispositivo|android|windows|laptop)/i;

export function isOptimizationRequest(text: string): boolean {
  return OPTIMIZATION_PATTERN.test(text.trim());
}

const PLATFORM_PATTERNS = {
  windows: /(?:windows|win(?:dows)?\s*(?:10|11)?|\.ps1|\.bat|powershell|cmd)/i,
  linux:   /(?:linux|ubuntu|debian|arch|fedora|\.sh|bash|shell)/i,
  android: /(?:android|celular|m[oó]vil|tel[eé]fono|adb\s+(?:shell|devices)|bloatware|t[aá]ctil)/i,
};

export type Platform = 'windows' | 'linux' | 'android' | 'unknown';

export function detectPlatform(text: string): Platform {
  const lower = text.toLowerCase();
  if (PLATFORM_PATTERNS.android.test(lower)) return 'android';
  if (PLATFORM_PATTERNS.windows.test(lower)) return 'windows';
  if (PLATFORM_PATTERNS.linux.test(lower))   return 'linux';
  return 'unknown';
}
