import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

// --- Supabase admin client (server-side, service role key) ---
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key);
}

// --- Validation schemas ---
export const registerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(50),
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
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

// --- Auth operations ---
export async function registerUser(input: RegisterInput) {
  const supabase = getSupabaseAdmin();

  // Check if email already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', input.email.toLowerCase())
    .maybeSingle();

  if (existing) {
    return { error: 'Este correo electrónico ya está registrado' };
  }

  // Hash password with bcrypt (10 rounds)
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(input.password, salt);

  // Insert user
  const { data, error } = await supabase
    .from('users')
    .insert({
      email: input.email.toLowerCase(),
      password_hash: passwordHash,
      name: input.name,
    })
    .select('id, email, name')
    .single();

  if (error || !data) {
    return { error: 'No se pudo crear la cuenta. Intenta de nuevo.' };
  }

  const token = signToken({ sub: data.id, email: data.email, name: data.name });
  return { token, user: data };
}

export async function loginUser(input: LoginInput) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, password_hash')
    .eq('email', input.email.toLowerCase())
    .maybeSingle();

  if (error || !data) {
    return { error: 'Credenciales inválidas' };
  }

  const valid = await bcrypt.compare(input.password, data.password_hash);
  if (!valid) {
    return { error: 'Credenciales inválidas' };
  }

  const token = signToken({ sub: data.id, email: data.email, name: data.name });
  return { token, user: { id: data.id, email: data.email, name: data.name } };
}

export async function getCurrentUser(): Promise<{ id: string; email: string; name: string } | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  return { id: payload.sub, email: payload.email, name: payload.name };
}
