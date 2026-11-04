import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;

    const baseUrl = process.env.FREELLMAPI_BASE_URL || process.env.FREE_LLM_BASE_URL || 'http://localhost:3001/v1';
    const apiKey = process.env.FREELLMAPI_KEY || process.env.FREE_LLM_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'FREELLMAPI_KEY no está configurada' }, { status: 500 });
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'auto',
        messages: messages || [],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[FreeLLMAPI Error]', response.status, errText);
      return NextResponse.json({ error: `Error en pasarela: ${errText}` }, { status: response.status });
    }

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('[Yosseling Chat Error]', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
