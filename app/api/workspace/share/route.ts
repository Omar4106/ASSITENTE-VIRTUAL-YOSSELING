import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const MAX_CONTENT_BYTES = 1_000_000;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Inicia sesión para publicar un proyecto.' }, { status: 401 });
    }

    const body = await request.json() as {
      artifactId?: unknown;
      name?: unknown;
      type?: unknown;
      path?: unknown;
      content?: unknown;
    };
    if (
      typeof body.artifactId !== 'string' || body.artifactId.length < 1 || body.artifactId.length > 200
      || typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.length > 160
      || (body.type !== 'document' && body.type !== 'web')
      || typeof body.path !== 'string' || body.path.length < 1 || body.path.length > 500
      || typeof body.content !== 'string'
      || Buffer.byteLength(body.content, 'utf8') > MAX_CONTENT_BYTES
    ) {
      return NextResponse.json({ error: 'El artefacto no es válido o supera el límite de 1 MB.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('workspace_projects')
      .upsert({
        owner_id: user.id,
        artifact_id: body.artifactId,
        name: body.name.trim(),
        artifact_type: body.type,
        path: body.path,
        content: body.content,
        is_public: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_id,artifact_id' })
      .select('id, public_id')
      .single();

    if (error || !data) {
      console.error('[Workspace share] Could not publish artifact:', error);
      return NextResponse.json({ error: 'No se pudo guardar el proyecto compartido. Verifica que la migración del Workspace esté aplicada.' }, { status: 500 });
    }

    return NextResponse.json({ publicId: data.public_id });
  } catch (error) {
    console.error('[Workspace share] Request failed:', error);
    return NextResponse.json({ error: 'No se pudo publicar el proyecto.' }, { status: 500 });
  }
}
