'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarEmoji: string;
}

interface AuthState {
  user: AuthUser | null;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;

  init: () => Promise<void>;
  register: (email: string, password: string, displayName: string, avatarEmoji: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AVATAR_DEFAULT = '🌟';

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isReady: false,
  isLoading: false,
  error: null,

  init: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const user = await loadProfile(session.user.id, session.user.email ?? '');
        set({ user, isReady: true });
        return;
      }
    } catch { /* ignore */ }
    set({ isReady: true });
  },

  register: async (email, password, displayName, avatarEmoji) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Create the auth account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            avatar_emoji: avatarEmoji,
          },
        },
      });

      if (signUpError) {
        const msg = translateError(signUpError.message);
        set({ isLoading: false, error: msg });
        return { success: false, error: msg };
      }

      if (!signUpData.user) {
        set({ isLoading: false, error: 'No se pudo crear la cuenta.' });
        return { success: false, error: 'No se pudo crear la cuenta.' };
      }

      // 2. Establish a session — signUp may not return one if email
      //    confirmation is enabled. Sign in explicitly to get a session
      //    so the profile insert passes RLS (auth.uid() = user_id).
      let session = signUpData.session;
      if (!session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          // Email confirmation is likely required — the account was
          // created but we can't insert the profile yet. Tell the user
          // to check their email, then sign in.
          set({ isLoading: false, error: 'Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.' });
          return { success: false, error: 'Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.' };
        }
        session = signInData.session;
      }

      if (!session) {
        set({ isLoading: false, error: 'No se pudo establecer la sesión.' });
        return { success: false, error: 'No se pudo establecer la sesión.' };
      }

      // 3. Insert the profile row — now we have an active session so
      //    auth.uid() = user_id will pass RLS.
      const { error: profileError } = await supabase
        .from('user_seals')
        .insert({
          user_id: signUpData.user.id,
          display_name: displayName,
          seal_hash: '',
          seal_emoji_count: 0,
          seal_first_emoji: null,
          avatar_emoji: avatarEmoji,
        });

      if (profileError) {
        // Profile might already exist (trigger or retry) — try to read it
        const { data: existing } = await supabase
          .from('user_seals')
          .select('display_name, avatar_emoji')
          .eq('user_id', signUpData.user.id)
          .maybeSingle();

        if (!existing) {
          await supabase.auth.signOut();
          set({ isLoading: false, error: 'No se pudo crear tu perfil. Intenta de nuevo.' });
          return { success: false, error: 'No se pudo crear tu perfil.' };
        }
      }

      const user: AuthUser = {
        id: signUpData.user.id,
        email: signUpData.user.email ?? email,
        displayName,
        avatarEmoji,
      };
      set({ user, isLoading: false });
      return { success: true };
    } catch {
      set({ isLoading: false, error: 'Error de conexión. Intenta de nuevo.' });
      return { success: false, error: 'Error de conexión.' };
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const msg = translateError(error.message);
        set({ isLoading: false, error: msg });
        return { success: false, error: msg };
      }

      if (!data.user) {
        set({ isLoading: false, error: 'No se pudo iniciar sesión.' });
        return { success: false, error: 'No se pudo iniciar sesión.' };
      }

      const user = await loadProfile(data.user.id, data.user.email ?? email);

      await supabase
        .from('user_seals')
        .update({ last_login_at: new Date().toISOString() })
        .eq('user_id', data.user.id);

      set({ user, isLoading: false });
      return { success: true };
    } catch {
      set({ isLoading: false, error: 'Error de conexión. Intenta de nuevo.' });
      return { success: false, error: 'Error de conexión.' };
    }
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
    } catch { /* ignore */ }
    set({ user: null });
  },

  clearError: () => set({ error: null }),
}));

async function loadProfile(userId: string, email: string): Promise<AuthUser> {
  const { data } = await supabase
    .from('user_seals')
    .select('display_name, avatar_emoji')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    id: userId,
    email,
    displayName: data?.display_name ?? email.split('@')[0],
    avatarEmoji: data?.avatar_emoji ?? AVATAR_DEFAULT,
  };
}

function translateError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'Ese correo ya está registrado. Intenta con otro.';
  }
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (lower.includes('email rate limit')) {
    return 'Demasiados intentos. Espera unos minutos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Debes confirmar tu correo antes de iniciar sesión.';
  }
  if (lower.includes('password')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (lower.includes('email')) {
    return 'El correo no es válido.';
  }
  return msg;
}
