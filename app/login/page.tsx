"use client";

import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { createClient } from '@/lib/supabase/client';
import { syncCurrentUserProfile } from '@/lib/profile-sync';
import dynamic from 'next/dynamic';

const CinematicBackground = dynamic(
  () => import('@/components/background/CinematicBackground').then((component) => component.CinematicBackground),
  { ssr: false }
);

const NebulaCanvas = dynamic(
  () => import('@/components/background/NebulaCanvas').then((component) => component.NebulaCanvas),
  { ssr: false }
);

export default function LoginPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';
  const [error, setError] = useState(searchParams.get('error') || '');
  const [message, setMessage] = useState(searchParams.get('message') || '');
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({
        email: String(form.get('email') || '').trim(),
        password: String(form.get('password') || ''),
      });
      if (authError) throw authError;
      await syncCurrentUserProfile().catch((syncError) => {
        console.error('[Yosseling] Profile sync failed:', syncError);
      });
      window.location.assign(nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const redirectTo = Capacitor.isNativePlatform()
        ? 'yosseling://auth/callback'
        : `${window.location.origin}/auth/callback`;
      const { error: authError } = await createClient().auth.signUp({
        email: String(form.get('email') || '').trim(),
        password: String(form.get('password') || ''),
        options: {
          data: { name: String(form.get('name') || '').trim() },
          emailRedirectTo: redirectTo,
        },
      });
      if (authError) throw authError;
      await syncCurrentUserProfile().catch((syncError) => {
        console.error('[Yosseling] Profile sync failed:', syncError);
      });
      setMessage('Revisa tu correo para confirmar la cuenta.');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'No se pudo crear la cuenta.');
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError('');
    try {
      const native = Capacitor.isNativePlatform();
      const redirectTo = native ? 'yosseling://auth/callback' : `${window.location.origin}/auth/callback`;
      const { data, error: authError } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: native },
      });
      if (authError) throw authError;
      if (native && data.url) await Browser.open({ url: data.url });
      else if (data.url) window.location.assign(data.url);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'No se pudo iniciar Google.');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-[#0f0a1e] px-4 text-white">
      <section className="w-full max-w-md rounded-2xl border border-purple-400/20 bg-black/40 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 text-center"><h1 className="text-2xl font-semibold">Yosseling</h1><p className="mt-1 text-sm text-purple-200/70">Inicia sesión o crea tu cuenta</p></div>
        {error && <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
        {message && <div className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div>}
        <form onSubmit={signIn} className="space-y-3">
          <label className="block text-sm text-zinc-300">Correo<input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-purple-400" /></label>
          <label className="block text-sm text-zinc-300">Contraseña<input name="password" type="password" required minLength={8} maxLength={128} autoComplete="current-password" className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-purple-400" /></label>
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-purple-600 py-2.5 font-medium hover:bg-purple-500 disabled:opacity-60">Entrar</button>
        </form>
        <button type="button" onClick={() => void signInWithGoogle()} disabled={busy} className="mt-3 w-full rounded-lg border border-white/15 bg-white/5 py-2.5 font-medium hover:bg-white/10 disabled:opacity-60">Continuar con Google</button>
        <button
          type="button"
          onClick={() => window.location.assign('/')}
          className="mt-3 w-full rounded-lg py-2 text-sm text-purple-200/80 hover:text-white"
        >
          Continuar como invitado
        </button>
        <details className="mt-5 border-t border-white/10 pt-4"><summary className="cursor-pointer text-sm text-purple-200">Crear una cuenta</summary>
          <form onSubmit={signUp} className="mt-3 space-y-3">
            <label className="block text-sm text-zinc-300">Nombre<input name="name" required minLength={2} maxLength={100} autoComplete="name" className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-purple-400" /></label>
            <label className="block text-sm text-zinc-300">Correo<input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-purple-400" /></label>
            <label className="block text-sm text-zinc-300">Contraseña<input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-purple-400" /></label>
            <button type="submit" disabled={busy} className="w-full rounded-lg border border-purple-400/40 py-2.5 font-medium text-purple-100 hover:bg-purple-500/10 disabled:opacity-60">Registrarme</button>
          </form>
        </details>
      </section>
    </main>
  );
}
