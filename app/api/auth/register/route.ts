import { NextResponse } from 'next/server';
import { registerSchema, registerUser, setSessionCookie } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Datos inválidos';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const result = await registerUser(parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    await setSessionCookie(result.token!);

    return NextResponse.json({
      user: result.user,
      message: 'Cuenta creada correctamente',
    });
  } catch {
    return NextResponse.json(
      { error: 'Ocurrió un error inesperado. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}
