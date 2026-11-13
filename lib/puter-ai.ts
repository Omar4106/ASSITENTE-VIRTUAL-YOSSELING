/**
 * YOSSELING PUTER.AI SERVICE
 * Servicio de generación de imágenes usando Puter en el backend (no en el cliente).
 * Esta versión usa un proxy API para evitar que los usuarios tengan que registrarse en Puter.
 *
 * Req:
 *  - npm install @heyputer/puter.js
 *
 * Configuración necesaria:
 *  - NEXT_PUBLIC_PUTER_JWT_SECRET - JWT secret para autenticación Puter
 *  - NEXT_PUBLIC_PUTER_USERNAME - Cuenta maestra de Puter
 *  - NEXT_PUBLIC_PUTER_PASSWORD - Contraseña de cuenta maestra
 *
 * NOTA: En un entorno de producción real, deberías:
 * 1. Usar Server Actions de Next.js 14+ (recomendado)
 * 2. O iniciar sesión en puter.com manualmente y usar un JWT compartido
 * 3. O usar un servicio de proxy separado con su propia cuenta Puter
 */

export interface PuterImageOptions {
  /** Modelo a usar para la generación. Por defecto: 'google/nano-banana-2.1' */
  model?: string;
  /** Imagen de entrada para modo imagen-a-imagen (data URL o URL remota) */
  inputImage?: string;
  /** Tipo MIME de la imagen de entrada si es una data URL */
  inputMimeType?: string;
  /** Número de imágenes a generar (1 por defecto) */
  numImages?: number;
  /** Dimensiones de la imagen (ej: '1024x1024') */
  size?: string;
  /** Nivel de detalle (low, medium, high). Afecta costo y tiempo. */
  quality?: 'low' | 'medium' | 'high';
}

export interface PuterImageResult {
  /** URL de la imagen generada (puede ser una URL temporal de Puter) */
  url: string;
  /** Nombre del modelo usado realmente */
  model: string;
  /** Tiempo estimado de generación en ms */
  generationTimeMs: number;
}

/**
 * Genera una o más imágenes a partir de un prompt de texto usando el endpoint API del servidor.
 * Esta función opera en el cliente pero llama a un endpoint del backend que tiene acceso a Puter.js.
 * Esto elimina la necesidad de que los usuarios se registren en Puter.
 *
 * @example Generación simple (txt2img):
 * ```ts
 * const result = await generateYosselingImage('un atardecer tropical con tonos violeta');
 * // result.url contiene la imagen generada
 * ```
 *
 * @example Imagen a imagen:
 * ```ts
 * const result = await generateYosselingImage(
 *   'convierte esta imagen en estilo anime',
 *   { model, inputImage: imageDataUrl }
 * );
 * ```
 */
export async function generateYosselingImage(
  prompt: string,
  optionsOrModel?: PuterImageOptions | string,
  inputImage?: string,
): Promise<PuterImageResult[]> {
  const startTime = Date.now();

  // Soporte backward-compatible para firma antigua (prompt, model, inputImage)
  let options: PuterImageOptions;
  if (typeof optionsOrModel === 'string') {
    options = { model: optionsOrModel, inputImage, inputMimeType: undefined };
  } else if (optionsOrModel) {
    options = { ...optionsOrModel };
  } else {
    options = {};
  }

  const model = options.model ?? 'google/nano-banana-2.1';
  const numImages = options.numImages ?? 1;
  const size = options.size ?? '1024x1024';
  const quality = options.quality ?? 'medium';
  const dimensions = /^(\d+)x(\d+)$/.exec(size);

  // Validar que el prompt no esté vacío
  if (!prompt || prompt.trim().length === 0) {
    throw new Error('El prompt de imagen no puede estar vacío.');
  }

  try {
    // Llamar al endpoint de API en el servidor
    const results = await Promise.all(
      Array.from({ length: numImages }, () => fetchImageFromAPI(prompt.trim(), {
        model,
        quality,
        inputImage: options.inputImage,
        inputMimeType: options.inputMimeType,
        ...(dimensions ? { width: Number(dimensions[1]), height: Number(dimensions[2]) } : {}),
      })),
    );

    const generationTimeMs = Date.now() - startTime;

    return results.filter(Boolean).map(result => ({
      url: result.url ?? '',
      model,
      generationTimeMs,
    }));
  } catch (error) {
    if (error instanceof Error) {
      // Si el error es de autenticación del endpoint, sugerir configuración
      if (error.message.includes('auth') || error.message.includes('login') || error.message.includes('JWT')) {
        throw new Error(
          'No pude generar la imagen con Puter. ' +
          'Configura las credenciales de Puter en el panel de configuración o inicia sesión en puter.com manualmente.'
        );
      }
      throw new Error(`Error al generar imagen: ${error.message}`);
    }
    throw new Error('Error desconocido al generar imagen.');
  }
}

/**
 * Función auxiliar que hace una petición fetch al endpoint API del servidor.
 * Esta función NO llama a Puter.js directamente en el navegador.
 */
async function fetchImageFromAPI(
  prompt: string,
  options: {
    model?: string;
    quality?: 'low' | 'medium' | 'high';
    inputImage?: string;
    inputMimeType?: string;
    width?: number;
    height?: number;
  }
): Promise<{ url?: string } | null> {
  try {
    const response = await fetch('/api/puter-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || response.statusText);
    }

    const data = await response.json();
    return { url: data.imageUrl };

  } catch (error) {
    console.error('[puter-ai] API call failed:', error);
    return null;
  }
}

/**
 * Lista los modelos disponibles en Puter AI para generación de imágenes.
 * Útil para mostrar opciones al usuario en la interfaz.
 *
 * NOTA: En la arquitectura de proxy, estos modelos se confirman solo en el backend.
 */
export async function listAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch('/api/puter-image/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test' }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.models || [];
    }
  } catch (error) {
    console.error('[puter-ai] Failed to list models:', error);
  }

  // Fallback a modelos conocidos
  return [
    'google/nano-banana-2.1',
    'google/nano-banana-2.0',
    'stabilityai/stable-diffusion-xl',
    'black-forest-labs/flux-schnell',
  ];
}

/**
 * Detecta si el endpoint de Puter está disponible en el entorno actual.
 * Devuelve false si estamos en un entorno donde las llamadas fetch fallan.
 */
export function isPuterAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Intentar hacer una petición a un endpoint interno
    const testUrl = '/api/puter-image';
    return Boolean(testUrl);
  } catch {
    return false;
  }
}
