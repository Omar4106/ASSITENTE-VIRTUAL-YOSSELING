"use client";

import { createBrowserClient, type CookieOptions } from '@supabase/ssr';

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase no está configurado: faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      sameSite: 'lax',
      secure: window.location.protocol === 'https:',
    } satisfies CookieOptions,
  });
  return browserClient;
}
