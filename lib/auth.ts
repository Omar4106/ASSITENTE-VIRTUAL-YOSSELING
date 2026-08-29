import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

// --- Supabase client (server-side, anon key + RPC functions) ---
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key);
}

// --- Validation schemas ---
export const registerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(50),
  email: z.string().email('Correo electronico invalido'),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
});

export const loginSchema = z.object({
  email: z.string().email('Correo electronico invalido'),
  password: z.string().min(1, 'La contrasena es obligatoria'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// --- JWT helpers ---
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-only-secret-change-me';
const COOKIE_NAME = 'yosseling_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: MAX_AGE_SECONDS });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// --- Cookie helpers ---
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

// --- Auth operations (via Supabase RPC functions) ---
export async function registerUser(input: RegisterInput) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .rpc('register_user', {
      p_email: input.email,
      p_password: input.password,
      p_name: input.name,
    });

  if (error) {
    const msg = error.message;
    console.error('[Auth] register_user RPC error:', msg);
    if (msg.includes('ya esta registrado')) {
      return { error: 'Este correo electronico ya esta registrado' };
    }
    if (msg.includes('al menos 8')) {
      return { error: 'La contrasena debe tener al menos 8 caracteres' };
    }
    if (msg.includes('al menos 2')) {
      return { error: 'El nombre debe tener al menos 2 caracteres' };
    }
    return { error: `Error de base de datos: ${msg}` };
  }

  if (!data || data.length === 0) {
    return { error: 'No se pudo crear la cuenta. Intenta de nuevo.' };
  }

  const user = data[0];
  const token = signToken({ sub: user.id, email: user.email, name: user.name });
  return { token, user };
}

export async function loginUser(input: LoginInput) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .rpc('login_user', {
      p_email: input.email,
      p_password: input.password,
    });

  if (error || !data || data.length === 0) {
    return { error: 'Credenciales invalidas' };
  }

  const user = data[0];
  const token = signToken({ sub: user.id, email: user.email, name: user.name });
  return { token, user };
}

export async function getCurrentUser(): Promise<{ id: string; email: string; name: string } | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  return { id: payload.sub, email: payload.email, name: payload.name };
}
