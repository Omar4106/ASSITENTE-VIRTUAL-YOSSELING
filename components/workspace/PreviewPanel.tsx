'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw } from 'lucide-react';
import { CodeEditor } from '@/components/workspace/CodeEditor';

interface PreviewPanelProps {
  className?: string;
}

export function PreviewPanel({ className }: PreviewPanelProps) {
  const { workspaceFiles, activeWorkspaceFile, workspacePanelTab, setWorkspacePanelTab } = useAppStore();
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePreview = useCallback(async () => {
    if (workspaceFiles.length === 0) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: workspaceFiles.map(f => ({
            path: f.path,
            content: f.content,
            language: f.language
          })),
          mainFile: 'App.tsx'
        })
      });

      if (!res.ok) throw new Error('Error al generar el preview');
      const html = await res.text();
      setSrcDoc(html);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceFiles]);

  // Update preview when files change or tab becomes active
  useEffect(() => {
    if (workspacePanelTab === 'preview' && workspaceFiles.length > 0) {
      const timer = setTimeout(updatePreview, 800); // debounce
      return () => clearTimeout(timer);
    }
  }, [workspaceFiles, workspacePanelTab, updatePreview]);

  const activeFile = workspaceFiles.find(f => f.id === activeWorkspaceFile);
  const hasFiles = workspaceFiles.length > 0;

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-black/60',
        className
      )}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg">
          {['preview', 'code', 'exports'].map(tab => (
            <button
              key={tab}
              onClick={() => setWorkspacePanelTab(tab as any)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                workspacePanelTab === tab
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {hasFiles && activeFile && (
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <span className={cn(
                "w-2 h-2 rounded-full",
                isLoading ? "bg-yellow-400 animate-pulse" : "bg-green-400"
              )} />
              {isLoading ? 'Compilando...' : 'Live Preview'}
            </span>
          )}
          <button
            onClick={updatePreview}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Recargar preview"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 relative overflow-hidden bg-white">
        {workspacePanelTab === 'code' ? (
          <CodeEditor readOnly={false} className="h-full" />
        ) : workspacePanelTab === 'exports' ? (
          <div className="flex h-full items-center justify-center bg-[#0d0e14] px-6 text-center">
            <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
              <h3 className="mb-2 text-xl font-bold text-white">Módulo de exportación</h3>
              <p className="mb-6 text-sm text-slate-400">
                Aquí podrás descargar tu código como PDF, Markdown o un repositorio completo próximamente.
              </p>
              <button className="w-full rounded-xl bg-purple-600 px-4 py-3 font-bold text-white transition-all hover:bg-purple-500">
                Preparar descarga (ZIP)
              </button>
            </div>
          </div>
        ) : (
          <>
            {!hasFiles && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-[#0d0e14]">
                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Loader2 size={40} className="animate-spin text-purple-400" />
                </div>
                <p className="text-sm font-medium">Workspace vacío</p>
                <p className="text-xs mt-1">Crea o abre archivos para ver previews</p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 bg-red-950/20 z-20">
                <p className="text-sm font-bold">Error de Renderizado</p>
                <p className="text-xs mt-1 text-red-300/80">{error}</p>
                <button onClick={updatePreview} className="mt-4 text-xs underline">Reintentar</button>
              </div>
            )}

            {hasFiles && srcDoc && (
              <iframe
                srcDoc={srcDoc}
                className="w-full h-full border-0"
                title="Live Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
              />
            )}

            {/* Loading Overlay */}
            {isLoading && !srcDoc && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
                <Loader2 size={32} className="text-purple-400 animate-spin mb-2" />
                <p className="text-xs text-slate-300">Generando preview...</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}