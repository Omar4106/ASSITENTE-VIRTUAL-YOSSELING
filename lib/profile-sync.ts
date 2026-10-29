"use client";

import { createClient } from '@/lib/supabase/client';

export async function syncCurrentUserProfile() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const metadata = user.user_metadata ?? {};
  const { data: existing } = await createClient()
    .from('profiles')
    .select('name, nickname, avatar_url, animated_background')
    .eq('id', user.id)
    .maybeSingle();

  const profile = {
    id: user.id,
    email: user.email ?? null,
    name:
      typeof existing?.name === 'string' && existing.name.trim()
        ? existing.name
        : typeof metadata.full_name === 'string'
        ? metadata.full_name
        : typeof metadata.name === 'string'
          ? metadata.name
          : user.email?.split('@')[0] ?? 'Usuario',
    avatar_url:
      typeof existing?.avatar_url === 'string' && existing.avatar_url
        ? existing.avatar_url
        : typeof metadata.avatar_url === 'string'
        ? metadata.avatar_url
        : typeof metadata.picture === 'string'
          ? metadata.picture
          : null,
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
