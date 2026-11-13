/**
 * Endpoint de API para generación de imágenes usando Puter API REST.
 * NO requiere @heyputer/puter.js en el servidor - usa fetch nativo de Node.js.
 *
 * Configuración necesaria (NEXT_PUBLIC_ o env):
 *  - NEXT_PUBLIC_PUTER_AUTH_TOKEN - Token de autenticación de Puter (Bearer Token)
 *
 * API REST de Puter:
 * POST https://api.puter.com/drivers/call
 * Body: { driver: 'ai', cmd: 'txt2img', params: { prompt, model, width, height } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getClientIp, getImageRateLimit, imagePromptSchema } from '@/lib/security';
import { getEnvVar } from '@/lib/env';
import { logImagePromptMetadata, optimizeImagePrompt } from '@/lib/image-prompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const PUTER_API_URL = 'https://api.puter.com/drivers/call';

/**
 * Genera una imagen usando Puter API REST en el servidor.
 * Esta función usa fetch nativo, no requiere @heyputer/puter.js.
 */
async function generatePuterImage(prompt: string): Promise<{ blob: Blob | null; provider: string; url?: string } | null> {
  try {
    const authToken = getEnvVar('PUTER_AUTH_TOKEN') ?? getEnvVar('NEXT_PUBLIC_PUTER_AUTH_TOKEN');

    if (!authToken) {
      console.error('[puter-image] PUTER_AUTH_TOKEN no configurado');
      return null;
    }

    // Limpiar y validar prompt
    const cleanPrompt = prompt.trim().slice(0, 4000);
    if (!cleanPrompt) {
      return null;
    }

    // Optimizar prompt
    const optimized = optimizeImagePrompt(cleanPrompt);

    console.log('[puter-image] Generando con Puter API...', {
      model: 'google/nano-banana-2.1',
      params: optimized.prompt,
    });

    // Llamada a Puter API REST
    const response = await fetch(PUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        driver: 'ai',
        cmd: 'txt2img',
        params: {
          prompt: optimized.prompt,
          model: 'google/nano-banana-2.1',
          quality: 'medium',
          width: 1024,
          height: 1024,
        },
      }),
    });

    if (!response.ok) {
      console.error('[puter-image] Puter API failed', {
        status: response.status,
        statusText: response.statusText,
      });

      // Intentar obtener error detallado
      try {
        const errorData = await response.json();
        console.error('[puter-image] Error details:', errorData);
      } catch {
        // Error no JSON
      }

      return null;
    }

    // Ejemplo de respuesta de Puter API:
    // { result: { data_url: "https://..." } } o { result: { url: "https://..." } }
    const data = await response.json();

    if (!data?.result) {
      console.error('[puter-image] Puter API returned invalid response structure:', data);
      return null;
    }

    const imageUrl = data.result.data_url || data.result.url || data.result.src || null;

    if (!imageUrl) {
      console.error('[puter-image] Puter API returned no image URL:', data);
      return null;
    }

    // Descargar imagen y convertir a Blob para enviar al frontend
    try {
      const imgResponse = await fetch(imageUrl);

      if (!imgResponse.ok) {
        console.error('[puter-image] Failed to download image from Puter:', imgResponse.statusText);
        return null;
      }

      const blob = await imgResponse.blob();
      const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';

      return { blob, provider: 'puter-api-rest' };
    } catch (downloadError) {
      console.error('[puter-image] Failed to convert URL to blob:', downloadError);
      // Fallback: retornar URL directa
      return {
        blob: null,
        provider: 'puter-url-direct',
        url: imageUrl, // retornamos URL también como fallback
      };
    }

  } catch (error) {
    console.error('[puter-image] Puter REST generation failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = getImageRateLimit(`puter-image:${clientIp}`);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Has generado demasiadas imágenes. Espera un minuto e inténtalo de nuevo.',
      },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
    );
  }

  let userPrompt = '';
  try {
    const body = await request.json() as { prompt?: unknown };
    const parsed = imagePromptSchema.safeParse(body.prompt);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Describe la imagen que quieres crear (3 a 4000 caracteres).' },
        { status: 400 }
      );
    }

    userPrompt = parsed.data;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Solicitud inválida.' },
      { status: 400 }
    );
  }

  const optimized = optimizeImagePrompt(userPrompt);
  const requestId = randomUUID();
  logImagePromptMetadata('puter-image', requestId, optimized, 'puter-api');

  // Generar la imagen con Puter API REST
  const result = await generatePuterImage(optimized.prompt);

  if (!result) {
    return NextResponse.json(
      {
        success: false,
        error:
          'No pude generar la imagen ahora mismo (límite temporal del servido o token de Puter).' +
          ' Verifica que PUTER_AUTH_TOKEN esté configurado y sea válido.',
      },
      { status: 503 }
    );
  }

  // Preparar respuesta
  if (result.url) {
    // Fallback: retornar URL directa
    return NextResponse.json({
      success: true,
      imageUrl: result.url,
      provider: result.provider,
    });
  }

  if (result.blob) {
    // Blob directo para transferencia más rápida
    const buffer = Buffer.from(await result.blob.arrayBuffer());
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${result.blob.type};base64,${base64}`;

    return NextResponse.json({
      success: true,
      imageUrl: dataUrl,
      provider: result.provider,
      // Incluir blob en el headers para streaming si se necesita
      blob: base64,
    });
  }

  // Error inesperado
  return NextResponse.json(
    { success: false, error: 'No se pudo generar la imagen.' },
    { status: 500 }
  );
}