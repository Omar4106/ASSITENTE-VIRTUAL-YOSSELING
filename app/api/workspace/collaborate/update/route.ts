import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'La sesión expiró; inicia sesión para guardar cambios.' }, { status: 401 });

    const body = await request.json() as { collaborationId?: unknown; updateId?: unknown; updateData?: unknown };
    if (
      typeof body.collaborationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.collaborationId)
      || typeof body.updateId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.updateId)
      || typeof body.updateData !== 'string' || body.updateData.length < 1 || body.updateData.length > 1_000_000
    ) {
      return NextResponse.json({ error: 'El cambio colaborativo no es válido o supera el límite.' }, { status: 400 });
    }

    const { error } = await supabase.from('workspace_collaboration_updates').insert({
      collaboration_id: body.collaborationId,
      update_id: body.updateId,
      user_id: user.id,
      update_data: body.updateData,
    });
    if (error) {
      console.error('[Workspace collaboration] Could not persist update:', error);
      return NextResponse.json({ error: 'No se pudo guardar el cambio. Puede que el acceso haya sido revocado.' }, { status: 403 });
    }
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error('[Workspace collaboration] Update request failed:', error);
    return NextResponse.json({ error: 'No se pudo guardar el cambio colaborativo.' }, { status: 500 });
  }
}
