import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Inicia sesión para crear una colaboración.' }, { status: 401 });

    const body = await request.json() as {
      artifactId?: unknown;
      name?: unknown;
      type?: unknown;
      path?: unknown;
      content?: unknown;
      documentState?: unknown;
    };
    if (
      typeof body.artifactId !== 'string' || body.artifactId.length < 1 || body.artifactId.length > 200
      || typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.length > 160
      || (body.type !== 'document' && body.type !== 'web')
      || typeof body.path !== 'string' || body.path.length < 1 || body.path.length > 500
      || typeof body.content !== 'string' || Buffer.byteLength(body.content, 'utf8') > 1_000_000
      || typeof body.documentState !== 'string' || body.documentState.length < 1 || body.documentState.length > 2_000_000
    ) {
      return NextResponse.json({ error: 'El artefacto o estado CRDT no es válido o supera el límite.' }, { status: 400 });
    }

    const existingProjectResult = await supabase
      .from('workspace_projects')
      .select('id')
      .eq('owner_id', user.id)
      .eq('artifact_id', body.artifactId)
      .maybeSingle();
    if (existingProjectResult.error) {
      console.error('[Workspace collaboration] Project lookup failed:', existingProjectResult.error);
      return NextResponse.json({ error: 'No se pudo consultar el proyecto.' }, { status: 500 });
    }

    let projectId = existingProjectResult.data?.id;
    if (projectId) {
      const { error } = await supabase
        .from('workspace_projects')
        .update({
          name: body.name.trim(),
          artifact_type: body.type,
          path: body.path,
          content: body.content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
      if (error) {
        console.error('[Workspace collaboration] Project update failed:', error);
        return NextResponse.json({ error: 'No se pudo actualizar el proyecto.' }, { status: 500 });
      }
    } else {
      const { data: project, error } = await supabase
        .from('workspace_projects')
        .insert({
          owner_id: user.id,
          artifact_id: body.artifactId,
          name: body.name.trim(),
          artifact_type: body.type,
          path: body.path,
          content: body.content,
          is_public: false,
        })
        .select('id')
        .single();
      if (error || !project) {
        console.error('[Workspace collaboration] Project creation failed:', error);
        return NextResponse.json({ error: 'No se pudo guardar el proyecto privado.' }, { status: 500 });
      }
      projectId = project.id;
    }

    const { data: existing, error: existingError } = await supabase
      .from('workspace_collaborations')
      .select('id, invite_id')
      .eq('project_id', projectId)
      .maybeSingle();
    if (existingError) {
      console.error('[Workspace collaboration] Invite lookup failed:', existingError);
      return NextResponse.json({ error: 'No se pudo consultar la invitación.' }, { status: 500 });
    }
    if (existing) return NextResponse.json({ collaborationInviteId: existing.invite_id });

    const { data: collaboration, error: collaborationError } = await supabase
      .from('workspace_collaborations')
      .insert({
        project_id: projectId,
        owner_id: user.id,
        document_state: body.documentState,
      })
      .select('id, invite_id')
      .single();
    if (collaborationError || !collaboration) {
      console.error('[Workspace collaboration] Invite creation failed:', collaborationError);
      return NextResponse.json({ error: 'No se pudo crear el espacio colaborativo.' }, { status: 500 });
    }

    const { error: memberError } = await supabase
      .from('workspace_collaboration_members')
      .insert({ collaboration_id: collaboration.id, user_id: user.id, role: 'owner' });
    if (memberError) {
      console.error('[Workspace collaboration] Owner membership creation failed:', memberError);
      return NextResponse.json({ error: 'El enlace se creó, pero no se pudo registrar al propietario.' }, { status: 500 });
    }

    return NextResponse.json({ collaborationInviteId: collaboration.invite_id });
  } catch (error) {
    console.error('[Workspace collaboration] Create request failed:', error);
    return NextResponse.json({ error: 'No se pudo crear el enlace de coedición.' }, { status: 500 });
  }
}
