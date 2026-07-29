'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface SealUser {
  id: string;
  display_name: string;
  avatar_emoji: string;
}

interface AuthState {
  user: SealUser | null;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;

  init: () => Promise<void>;
  register: (displayName: string, seal: string[], avatarEmoji: string) => Promise<{ success: boolean; error?: string }>;
  login: (displayName: string, seal: string[]) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  clearError: () => void;
}

const STORAGE_KEY = 'yosseling-seal-user';

async function hashSeal(seal: string[]): Promise<string> {
  const text = seal.join('::');
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isReady: false,
  isLoading: false,
  error: null,

  init: async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const user = JSON.parse(raw) as SealUser;
        set({ user, isReady: true });
        return;
      }
    } catch { /* ignore */ }
    set({ isReady: true });
  },

  register: async (displayName, seal, avatarEmoji) => {
    set({ isLoading: true, error: null });
    try {
      const sealHash = await hashSeal(seal);

      const { data: existing } = await supabase
        .from('user_seals')
        .select('id')
        .eq('display_name', displayName)
        .maybeSingle();

      if (existing) {
        set({ isLoading: false, error: 'Ese nombre ya está registrado. Elige otro.' });
        return { success: false, error: 'Ese nombre ya está registrado.' };
      }

      const { data, error } = await supabase
        .from('user_seals')
        .insert({
          display_name: displayName,
          seal_hash: sealHash,
          seal_emoji_count: seal.length,
          seal_first_emoji: seal[0],
          avatar_emoji: avatarEmoji,
        })
        .select('id, display_name, avatar_emoji')
        .single();

      if (error || !data) {
        set({ isLoading: false, error: 'No se pudo registrar. Intenta de nuevo.' });
        return { success: false, error: 'No se pudo registrar.' };
      }

      const user: SealUser = { id: data.id, display_name: data.display_name, avatar_emoji: data.avatar_emoji };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      set({ user, isLoading: false });
      return { success: true };
    } catch {
      set({ isLoading: false, error: 'Error de conexión. Intenta de nuevo.' });
      return { success: false, error: 'Error de conexión.' };
    }
  },

  login: async (displayName, seal) => {
    set({ isLoading: true, error: null });
    try {
      const sealHash = await hashSeal(seal);

      const { data, error } = await supabase
        .from('user_seals')
        .select('id, display_name, avatar_emoji, seal_hash')
        .eq('display_name', displayName)
        .maybeSingle();

      if (error || !data) {
        set({ isLoading: false, error: 'No encontramos ese nombre. ¿Está bien escrito?' });
        return { success: false, error: 'No encontramos ese nombre.' };
      }

      if (data.seal_hash !== sealHash) {
        set({ isLoading: false, error: 'El sello no coincide. Intenta de nuevo.' });
        return { success: false, error: 'El sello no coincide.' };
      }

      await supabase
        .from('user_seals')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', data.id);

      const user: SealUser = { id: data.id, display_name: data.display_name, avatar_emoji: data.avatar_emoji };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      set({ user, isLoading: false });
      return { success: true };
    } catch {
      set({ isLoading: false, error: 'Error de conexión. Intenta de nuevo.' });
      return { success: false, error: 'Error de conexión.' };
    }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null });
  },

  clearError: () => set({ error: null }),
}));
