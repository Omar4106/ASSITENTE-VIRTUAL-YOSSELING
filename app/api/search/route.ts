import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Endpoint de búsqueda web para Yosseling
 * Realiza búsquedas mediante DuckDuckGo API (gratuita y sin llave requerida) o un fallback de scraping.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Falta el parámetro de búsqueda "q"' }, { status: 400 });
  }

  try {
    // Usamos la API pública e instantánea de DuckDuckGo para resultados limpios en formato JSON
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

    const response = await fetch(ddgUrl, {
      headers: {
        'User-Agent': 'YosselingAssistant/2.0 (Educational/Productivity AI)'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      throw new Error(`Error en proveedor de búsqueda: ${response.status}`);
    }

    const data = await response.json();

    // Procesar resultados de DuckDuckGo
    const results = [];

    // 1. Añadir Abstract si existe
    if (data.AbstractText) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || '#',
        snippet: data.AbstractText,
        source: data.AbstractSource || 'DuckDuckGo Instant Answer'
      });
    }

    // 2. Añadir resultados relacionados (RelatedTopics)
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || query,
            url: topic.FirstURL,
            snippet: topic.Text,
            source: 'Web'
          });
        }
        if (results.length >= 6) break;
      }
    }

    // Fallback si no hay suficientes resultados estructurados
    if (results.length === 0) {
      results.push({
        title: `Resultados para: ${query}`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: `Se consultó la web para "${query}". No se encontraron resúmenes directos instantáneos, pero puedes explorar los enlaces relacionados.`,
        source: 'Web Search'
      });
    }

    return NextResponse.json({
      success: true,
      query,
      results
    });

  } catch (error: any) {
    console.error('[Search API Error]:', error);
    return NextResponse.json({
      success: false,
      error: 'No se pudo completar la búsqueda web en este momento.',
      results: []
    }, { status: 500 });
  }
}
