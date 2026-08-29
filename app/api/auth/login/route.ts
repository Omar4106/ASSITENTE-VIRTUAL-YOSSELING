import { NextResponse } from 'next/server';
import { loginSchema, loginUser, setSessionCookie } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Datos inválidos';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const result = await loginUser(parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    await setSessionCookie(result.token!);

    return NextResponse.json({
      user: result.user,
      message: 'Inicio de sesión exitoso',
    });
  } catch (err) {
    console.error('[Auth] Login endpoint error:', err);
    const message = err instanceof Error ? err.message : 'Ocurrio un error inesperado. Intenta de nuevo.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
