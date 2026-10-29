"use client";

import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { createClient } from '@/lib/supabase/client';
import { syncCurrentUserProfile } from '@/lib/profile-sync';

export default function CapacitorAuthListener() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let handle: { remove: () => void | Promise<void> } | undefined;

    void App.addListener('appUrlOpen', async ({ url }) => {
      if (cancelled || !url.startsWith('yosseling://auth/callback')) return;

      try {
        await Browser.close().catch(() => undefined);
        const callbackUrl = new URL(url);
        const code = callbackUrl.searchParams.get('code');

        if (code) {
          const { error } = await createClient().auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const hashParams = new URLSearchParams(callbackUrl.hash.replace(/^#/, ''));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            const { error } = await createClient().auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
          }
        }

        await syncCurrentUserProfile().catch((error) => {
          console.error('[Yosseling] Mobile profile sync failed:', error);
        });

        window.location.replace('/');
      } catch (error) {
        console.error('[Yosseling] Mobile OAuth callback failed:', error);
        window.location.replace('/login?error=No%20se%20pudo%20completar%20Google');
      }
    }).then((listener) => {
      if (cancelled) void listener.remove();
      else handle = listener;
    });

    return () => {
      cancelled = true;
      if (handle) void handle.remove();
    };
  }, []);

  return null;
}
