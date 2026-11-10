import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SharedMarkdown } from '@/components/workspace/SharedMarkdown';

export const dynamic = 'force-dynamic';

type SharedProject = {
  name: string;
  artifact_type: 'document' | 'web';
  path: string;
  content: string;
};

function wrapWebPreview(content: string) {
  const documentLike = /<!doctype html|<html[\s>]/i.test(content);
  let source = documentLike
    ? content
    : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${content}</body></html>`;
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src https: data: blob:; font-src https: data:; connect-src https:;">`;
  if (/<head[^>]*>/i.test(source)) return source.replace(/<head([^>]*)>/i, `<head$1>${policy}`);
  if (/<html[^>]*>/i.test(source)) return source.replace(/<html([^>]*)>/i, `<html$1><head>${policy}</head>`);
  return `<!doctype html><html><head>${policy}</head><body>${source}</body></html>`;
}

export default async function SharedProjectPage({ params }: { params: { projectId: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.projectId)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_public_workspace_project', { p_public_id: params.projectId });

  if (error) {
    console.error('[Workspace preview] Could not load shared project:', error);
    throw new Error('No se pudo cargar el proyecto compartido.');
  }
  const publicProject = Array.isArray(data) ? data[0] : data;
  if (!publicProject) notFound();

  const project = publicProject as SharedProject;
  return (
    <main className="flex min-h-screen flex-col bg-[#0a0a0c] text-slate-100">
      <header className="flex items-center justify-between border-b border-white/10 bg-[#0d0d12] px-5 py-3">
        <div>
          <h1 className="text-sm font-semibold text-white">{project.name}</h1>
          <p className="mt-1 text-[10px] text-slate-400">{project.path} · Compartido con Yosseling</p>
        </div>
        <span className="rounded-full border border-purple-400/20 bg-purple-500/10 px-2.5 py-1 text-[10px] text-purple-200">
          {project.artifact_type === 'web' ? 'Vista web aislada' : 'Documento'}
        </span>
      </header>

      {project.artifact_type === 'web' ? (
        <iframe
          title={project.name}
          srcDoc={wrapWebPreview(project.content)}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          className="min-h-0 flex-1 border-0 bg-white"
        />
      ) : (
        <article className="mx-auto my-8 w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0d0d12] px-6 py-8 shadow-2xl sm:px-12">
          <SharedMarkdown content={project.content} />
        </article>
      )}
    </main>
  );
}
