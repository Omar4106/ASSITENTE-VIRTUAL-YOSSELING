import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PROMPT } from '@/lib/ai-providers';
import { getEnvVar } from '@/lib/env';

// Force Node.js runtime — required for fs-based env fallback and process.env access
export const runtime = 'nodejs';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, model, provider } = await req.json();

    const apiMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
    ];

    if (provider === 'groq') {
      const apiKey = getEnvVar('GROQ_API_KEY');

      console.log('[Yosseling] GROQ provider selected, key found:', Boolean(apiKey));

      if (!apiKey) {
        console.error('[Yosseling] GROQ_API_KEY not found in process.env or .env files');
        return streamError(
          'GROQ_API_KEY no configurada. Agrega la clave en el archivo .env del proyecto.'
        );
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'llama-3.3-70b-versatile',
          messages: apiMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('[Yosseling] Groq API error:', err);
        return streamError(`Error de Groq: ${err}`);
      }

      return new NextResponse(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // OpenAI
    const apiKey = getEnvVar('OPENAI_API_KEY');

    console.log('[Yosseling] OpenAI provider selected, key found:', Boolean(apiKey));

    if (!apiKey) {
      console.error('[Yosseling] OPENAI_API_KEY not found in process.env or .env files');
      return streamError(
        'OPENAI_API_KEY no configurada. Agrega la clave en el archivo .env del proyecto.'
      );
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: apiMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Yosseling] OpenAI API error:', err);
      return streamError(`Error de OpenAI: ${err}`);
    }

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[Yosseling] Chat API unexpected error:', err);
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
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
