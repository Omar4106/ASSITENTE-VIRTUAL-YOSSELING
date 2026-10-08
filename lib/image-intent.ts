const IMAGE_REQUEST_PATTERN = /(?:genera(?:r)?|crear?|dibuja(?:r)?|imagina|ilustra(?:r)?|pinta(?:r)?|diseña(?:r)?|haz(?:me)?).*?(?:imagen|ilustraci[oó]n|dibujo|retrato|escena|logo|poster|p[oó]ster)|^(?:imagina|dibuja|pinta)\b/i;

export function isImageGenerationRequest(text: string): boolean {
  return IMAGE_REQUEST_PATTERN.test(text.trim());
}
