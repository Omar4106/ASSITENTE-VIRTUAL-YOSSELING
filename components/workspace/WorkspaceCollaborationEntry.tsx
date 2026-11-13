'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WorkspaceCanvas } from '@/components/workspace/WorkspaceCanvas';
import { useAppStore } from '@/lib/store';
import type { WorkspaceLanguage } from '@/types';

type JoinedCollaboration = {
  collaborationId: string;
  initialState: string;
  updates: Array<{ update_id: string; update_data: string }>;
  artifact: {
    name: string;
    artifact_type: 'document' | 'web';
    path: string;
    content: string;
  };
  user: { id: string; name: string };
};

export function WorkspaceCollaborationEntry({ inviteId }: { inviteId: string }) {
  const [collaboration, setCollaboration] = useState<JoinedCollaboration | null>(null);
  const [artifact, setArtifact] = useState<{
    id: string;
    name: string;
    type: 'document' | 'web';
    content: string;
    language: WorkspaceLanguage;
    path: string;
    createdAt: number;
    updatedAt: number;
  } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const setWorkspaceFiles = useAppStore((state) => state.setWorkspaceFiles);
  const setActiveWorkspaceFile = useAppStore((state) => state.setActiveWorkspaceFile);
  const setIsWorkspaceOpen = useAppStore((state) => state.setIsWorkspaceOpen);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/workspace/collaborate/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteId }),
          signal: controller.signal,
        });
        const result = await response.json() as JoinedCollaboration & { error?: string };
        if (!response.ok) throw new Error(result.error ?? 'No se pudo abrir la colaboración.');

        const now = Date.now();
        const language = result.artifact.path.toLowerCase().endsWith('.html') ? 'html' as const
          : result.artifact.path.toLowerCase().endsWith('.json') ? 'json' as const
            : result.artifact.path.toLowerCase().endsWith('.py') ? 'python' as const
              : 'markdown' as const;
        const currentArtifact = {
          id: `collaboration-${result.collaborationId}`,
          name: result.artifact.name,
          type: result.artifact.artifact_type,
          content: result.artifact.content,
          language,
          path: result.artifact.path,
          createdAt: now,
          updatedAt: now,
        };
        setWorkspaceFiles([{
          id: currentArtifact.id,
          path: currentArtifact.path,
          content: currentArtifact.content,
          language: currentArtifact.language,
          type: currentArtifact.type === 'web' ? 'page' : 'other',
          isModified: false,
          createdAt: now,
          updatedAt: now,
        }]);
        setActiveWorkspaceFile(currentArtifact.id);
        setIsWorkspaceOpen(true);
        setArtifact(currentArtifact);
        setCollaboration(result);
      } catch (reason) {
        if (controller.signal.aborted) return;
        console.error('[Workspace collaboration] Failed to open invitation:', reason);
        setError(reason instanceof Error ? reason.message : 'No se pudo abrir la invitación.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [inviteId, setActiveWorkspaceFile, setIsWorkspaceOpen, setWorkspaceFiles]);

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#0a0a0c] text-sm text-purple-200">Abriendo espacio colaborativo…</main>;
  }
  if (error || !collaboration || !artifact) {
    const loginUrl = `/login?next=${encodeURIComponent(`/collab/${inviteId}`)}`;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0c] p-6 text-slate-100">
        <section className="max-w-lg rounded-2xl border border-white/10 bg-[#0d0d12] p-6">
          <h1 className="text-lg font-semibold">No se pudo abrir la colaboración</h1>
          <p role="alert" className="mt-2 text-sm text-red-200">{error || 'La invitación ya no está disponible.'}</p>
          <Link href={loginUrl} className="mt-5 inline-flex rounded-xl bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-500">
            Iniciar sesión e intentarlo de nuevo
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="h-dvh bg-[#0a0a0c]">
      <WorkspaceCanvas
        currentArtifact={artifact}
        onArtifactChange={setArtifact}
        collaboration={{
          id: collaboration.collaborationId,
          initialState: collaboration.initialState,
          updates: collaboration.updates,
          user: collaboration.user,
        }}
      />
    </main>
  );
}
