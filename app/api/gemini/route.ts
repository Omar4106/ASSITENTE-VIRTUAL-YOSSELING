import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PROMPT } from '@/lib/ai-providers';
import { getEnvVar } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { messages, model } = await req.json();

    const apiKey = getEnvVar('GEMINI_API_KEY');

    console.log('[Yosseling] Gemini provider selected, key found:', Boolean(apiKey));

    if (!apiKey) {
      console.error('[Yosseling] GEMINI_API_KEY not found');
      return streamError(
        'GEMINI_API_KEY no configurada. Agrega la clave en el archivo .env del proyecto.'
      );
    }

    const geminiModel =
      model === 'gemini-2.5-pro' ? 'gemini-2.0-flash-exp' : 'gemini-2.0-flash';

    const contents = messages
      .filter((m: { role: string; content: string }) => m.role !== 'system')
      .map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const requestBody = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[Yosseling] Gemini API error:', err);
      return streamError(`Error de Gemini: ${err}`);
    }

    const encoder = new TextEncoder();
    const reader = response.body?.getReader();
    if (!reader) return streamError('No response body from Gemini');

    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  const text =
                    parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                  if (text) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          choices: [{ delta: { content: text } }],
                        })}\n\n`
                      )
                    );
                  }
                } catch {}
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[Yosseling] Gemini API unexpected error:', err);
    return streamError('Error interno del servidor');
  }
}

function streamError(msg: string): NextResponse {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const payload = `data: ${JSON.stringify({
        choices: [{ delta: { content: msg } }],
      })}\n\ndata: [DONE]\n\n`;
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
