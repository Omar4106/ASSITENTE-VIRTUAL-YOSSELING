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
        const user = await loadOrCreateProfile(session.user.id, session.user.email ?? '');
        set({ user, isReady: true });
        return;
      }
    } catch { /* ignore */ }
    set({ isReady: true });
  },

  register: async (email, password, displayName, avatarEmoji) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Try to create the auth account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName, avatar_emoji: avatarEmoji } },
      });

      // 2. If "already registered", the account exists from a previous
      //    attempt but the profile (sello) may be missing. Try to sign
      //    in and recover by creating the profile.
      if (signUpError) {
        const lower = signUpError.message.toLowerCase();
        if (lower.includes('already registered') || lower.includes('already been registered')) {
          const { data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({ email, password });

          if (signInError) {
            const msg = 'Ese correo ya está registrado. Inicia sesión con tu contraseña anterior.';
            set({ isLoading: false, error: msg });
            return { success: false, error: msg };
          }

          // Signed in successfully — create the missing profile
          const user = await loadOrCreateProfile(
            signInData.user.id,
            signInData.user.email ?? email,
            displayName,
            avatarEmoji,
          );
          set({ user, isLoading: false });
          return { success: true };
        }

        const msg = translateError(signUpError.message);
        set({ isLoading: false, error: msg });
        return { success: false, error: msg };
      }

      if (!signUpData.user) {
        set({ isLoading: false, error: 'No se pudo crear la cuenta.' });
        return { success: false, error: 'No se pudo crear la cuenta.' };
      }

      // 3. Establish a session — signUp may not return one if email
      //    confirmation is enabled. Sign in explicitly.
      let session = signUpData.session;
      if (!session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          set({ isLoading: false, error: 'Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.' });
          return { success: false, error: 'Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.' };
        }
        session = signInData.session;
      }

      if (!session) {
        set({ isLoading: false, error: 'No se pudo establecer la sesión.' });
        return { success: false, error: 'No se pudo establecer la sesión.' };
      }

      // 4. Create the profile row via upsert (handles races)
      const user = await loadOrCreateProfile(
        signUpData.user.id,
        signUpData.user.email ?? email,
        displayName,
        avatarEmoji,
      );
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const msg = translateError(error.message);
        set({ isLoading: false, error: msg });
        return { success: false, error: msg };
      }

      if (!data.user) {
        set({ isLoading: false, error: 'No se pudo iniciar sesión.' });
        return { success: false, error: 'No se pudo iniciar sesión.' };
      }

      // Load (or auto-create) the profile, then update last_login
      const user = await loadOrCreateProfile(data.user.id, data.user.email ?? email);
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
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    set({ user: null });
  },

  clearError: () => set({ error: null }),
}));

/**
 * Loads an existing profile. If it doesn't exist, creates one with
 * the provided displayName/avatarEmoji (or defaults).
 * Uses upsert to handle race conditions (e.g. onAuthStateChange firing
 * while register/login is still running).
 */
async function loadOrCreateProfile(
  userId: string,
  email: string,
  displayName?: string,
  avatarEmoji?: string,
): Promise<AuthUser> {
  const { data: existing } = await supabase
    .from('user_seals')
    .select('display_name, avatar_emoji')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return {
      id: userId,
      email,
      displayName: existing.display_name ?? email.split('@')[0],
      avatarEmoji: existing.avatar_emoji ?? AVATAR_DEFAULT,
    };
  }

  // Profile missing — create it now via upsert
  const name = displayName ?? email.split('@')[0];
  const emoji = avatarEmoji ?? AVATAR_DEFAULT;

  const { error } = await supabase
    .from('user_seals')
    .upsert({
      user_id: userId,
      display_name: name,
      seal_hash: '',
      seal_emoji_count: 0,
      seal_first_emoji: null,
      avatar_emoji: emoji,
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('[auth] Failed to create profile:', error.message);
  }

  return { id: userId, email, displayName: name, avatarEmoji: emoji };
}

function translateError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'Ese correo ya está registrado. Inicia sesión con tu contraseña anterior.';
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
