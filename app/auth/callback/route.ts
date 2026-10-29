import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const requestedNext = request.nextUrl.searchParams.get('next') ?? '/';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=No%20se%20recibi%C3%B3%20el%20c%C3%B3digo%20de%20OAuth', request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const metadata = user.user_metadata ?? {};
    const { data: existing } = await supabase
      .from('profiles')
      .select('name, avatar_url, nickname, animated_background')
      .eq('id', user.id)
      .maybeSingle();

    await supabase.from('profiles').upsert({
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
    }, { onConflict: 'id' });
  }

  return NextResponse.redirect(new URL(next, request.url));
}
