"use client";

import { useEffect } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { syncCurrentUserProfile } from '@/lib/profile-sync';
import { useAppStore } from '@/lib/store';

export default function AuthSessionSync() {
  const setAuthUser = useAppStore((state) => state.setAuthUser);
  const updateSettings = useAppStore((state) => state.updateSettings);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const url = new URL(window.location.href);
    const authCode = url.searchParams.get('code');
    if (authCode) {
      void supabase.auth.exchangeCodeForSession(authCode)
        .then(async ({ data, error }: { data: { session: Session | null }; error: Error | null }) => {
          if (error) throw error;
          url.searchParams.delete('code');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
          await syncCurrentUserProfile().catch((syncError: unknown) => {
            console.error('[Yosseling] Root OAuth profile sync failed:', syncError);
          });
          await applySession(data.session);
        })
        .catch((error: unknown) => {
          console.error('[Yosseling] OAuth code exchange failed:', error);
        });
    }

    const applySession = async (session: Session | null) => {
      const user = session?.user;
      if (!active) return;
      if (!user) {
        setAuthUser(null);
        updateSettings({
          userName: 'Usuario',
          userNickname: '',
          userAvatar: null,
        });
        return;
      }

      const profile = await syncCurrentUserProfile().catch((error: unknown) => {
        console.error('[Yosseling] Auth profile sync failed:', error);
        return null;
      });
      if (!active) return;

      const metadata = user.user_metadata ?? {};
      const name =
        (profile as { name?: string } | null)?.name ??
        (typeof metadata.full_name === 'string' ? metadata.full_name : null) ??
        (typeof metadata.name === 'string' ? metadata.name : null) ??
        user.email?.split('@')[0] ??
        'Usuario';
      const avatarUrl =
        (profile as { avatar_url?: string | null } | null)?.avatar_url ??
        (typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null) ??
        (typeof metadata.picture === 'string' ? metadata.picture : null) ??
        null;

      setAuthUser({
        id: user.id,
        email: user.email ?? null,
        name,
        avatarUrl,
        role: typeof metadata.role === 'string' ? metadata.role : null,
      });
      const nickname = (profile as { nickname?: string | null } | null)?.nickname;
      updateSettings({
        userName: name,
        userAvatar: avatarUrl,
        ...(typeof nickname === 'string' ? { userNickname: nickname } : {}),
      });
    };

    void supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      void applySession(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        void applySession(session);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [setAuthUser, updateSettings]);

  return null;
}
