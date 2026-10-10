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
