import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Inicia sesión con Yosseling para unirte al proyecto.' }, { status: 401 });

    const body = await request.json() as { inviteId?: unknown };
    if (typeof body.inviteId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.inviteId)) {
      return NextResponse.json({ error: 'El enlace de invitación no es válido.' }, { status: 400 });
    }

    const { data: collaborationId, error: joinError } = await supabase
      .rpc('join_workspace_collaboration', { p_invite_id: body.inviteId });
    if (joinError || typeof collaborationId !== 'string') {
      return NextResponse.json({ error: 'La invitación expiró, está desactivada o no es válida.' }, { status: 404 });
    }

    const { data: collaboration, error: collaborationError } = await supabase
      .from('workspace_collaborations')
      .select('id, project_id, document_state')
      .eq('id', collaborationId)
      .single();
    if (collaborationError || !collaboration) {
      console.error('[Workspace collaboration] Failed to load room:', collaborationError);
      return NextResponse.json({ error: 'No se pudo cargar el espacio colaborativo.' }, { status: 500 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from('workspace_collaboration_members')
      .select('role')
      .eq('collaboration_id', collaboration.id)
      .eq('user_id', user.id)
      .single();
    if (membershipError || !membership) {
      console.error('[Workspace collaboration] Membership is not available:', membershipError);
      return NextResponse.json({ error: 'Tu cuenta no pudo unirse a esta colaboración.' }, { status: 403 });
    }

    const { data: project, error: projectError } = await supabase
      .from('workspace_projects')
      .select('name, artifact_type, path, content')
      .eq('id', collaboration.project_id)
      .single();
    if (projectError || !project) {
      console.error('[Workspace collaboration] Failed to load shared artifact:', projectError);
      return NextResponse.json({ error: 'No se pudo cargar el artefacto compartido.' }, { status: 500 });
    }

    const { data: updates, error: updatesError } = await supabase
      .from('workspace_collaboration_updates')
      .select('update_id, update_data')
      .eq('collaboration_id', collaboration.id)
      .order('created_at', { ascending: true })
      .limit(5000);
    if (updatesError) {
      console.error('[Workspace collaboration] Failed to load update history:', updatesError);
      return NextResponse.json({ error: 'No se pudo cargar el historial de coedición.' }, { status: 500 });
    }

    return NextResponse.json({
      collaborationId: collaboration.id,
      initialState: collaboration.document_state,
      updates: updates ?? [],
      artifact: project,
      role: membership?.role ?? 'editor',
      user: { id: user.id, name: user.user_metadata?.name ?? user.email ?? 'Colaborador' },
    });
  } catch (error) {
    console.error('[Workspace collaboration] Join failed:', error);
    return NextResponse.json({ error: 'No se pudo abrir la invitación de colaboración.' }, { status: 500 });
  }
}
