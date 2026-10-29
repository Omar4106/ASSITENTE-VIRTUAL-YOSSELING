'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

const signUpSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(100),
});

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  });
  if (!parsed.success) redirect('/login?error=Datos%20de%20registro%20inv%C3%A1lidos');

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect('/login?message=Revisa%20tu%20correo%20para%20confirmar%20la%20cuenta');
}

export async function signIn(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) redirect('/login?error=Correo%20o%20contrase%C3%B1a%20inv%C3%A1lidos');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(formData.get('next')?.toString() === '/login' ? '/' : (formData.get('next')?.toString() || '/'));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http';
  if (!host) redirect('/login?error=No%20se%20pudo%20determinar%20la%20URL%20de%20autenticaci%C3%B3n');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${protocol}://${host}/auth/callback?next=/` },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(error?.message ?? 'No se pudo iniciar Google')}`);
  redirect(data.url);
}
