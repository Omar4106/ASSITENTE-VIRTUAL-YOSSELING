'use client';

import { useEffect, useMemo, useState } from 'react';
import { Code2, Copy, Download, FileText, MonitorPlay } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { CodeEditor } from '@/components/workspace/CodeEditor';
import { cn } from '@/lib/utils';

const TAB_ITEMS = [
  { key: 'preview', label: 'Preview' },
  { key: 'code', label: 'Code / Edit' },
  { key: 'exports', label: 'Exports' },
] as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markdownToHtml(md: string) {
  const safe = escapeHtml(md)
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br />');

  return `
    <html>
      <body style="margin:0;background:#0a0a0c;color:#e5e7eb;font-family:Inter,Segoe UI,sans-serif;padding:24px;line-height:1.6;">
        <div style="max-width:900px; margin:0 auto;">
          <div style="white-space:pre-wrap;">${safe}</div>
        </div>
      </body>
    </html>
  `;
}

export function WorkspaceCanvas() {
  const {
    workspaceFiles,
    activeWorkspaceFile,
    workspacePanelTab,
    setWorkspacePanelTab,
    setWorkspaceFiles,
    setIsWorkspaceOpen,
  } = useAppStore();

  const activeFile = workspaceFiles.find((file) => file.id === activeWorkspaceFile) ?? workspaceFiles[0] ?? null;

  const [copied, setCopied] = useState(false);

  const previewDoc = useMemo(() => {
    if (!activeFile) return '';

    const content = activeFile.content.trim();
    if (!content) return '<html><body style="padding:24px;color:#e5e7eb;background:#0a0a0c;">Sin contenido</body></html>';

    const lower = activeFile.path.toLowerCase();
    if (lower.endsWith('.html') || content.startsWith('<!DOCTYPE') || content.startsWith('<html')) {
      return content;
    }

    if (lower.endsWith('.md') || content.includes('# ') || content.includes('```')) {
      return markdownToHtml(content);
    }

    return `
      <html>
        <body style="margin:0;background:#0a0a0c;color:#e5e7eb;font-family:ui-monospace,monospace;padding:24px;">
          <pre style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(content)}</pre>
        </body>
      </html>
    `;
  }, [activeFile]);

  useEffect(() => {
    if (workspaceFiles.length > 0 && !activeWorkspaceFile) {
      const first = workspaceFiles[0];
      useAppStore.getState().setActiveWorkspaceFile(first.id);
    }
  }, [activeWorkspaceFile, workspaceFiles]);

  const updateActiveFile = (nextContent: string) => {
    if (!activeFile) return;
    const nextFiles = workspaceFiles.map((file) =>
      file.id === activeFile.id
        ? { ...file, content: nextContent, updatedAt: Date.now(), isModified: true }
        : file,
    );
    setWorkspaceFiles(nextFiles);
  };

  const handleCopy = async () => {
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // no-op: we keep fallback below through manual selection if clipboard is unavailable
    }
  };

  const handleDownload = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.path.split('/').pop() || 'yosseling-artifact.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!activeFile) {
    return (
      <div className="flex h-full flex-col bg-[#090b12] text-slate-300">
        <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-purple-300">Workspace</span>
          <button
            type="button"
            onClick={() => setIsWorkspaceOpen(false)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:text-white"
          >
            Cerrar
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <MonitorPlay className="mx-auto mb-3 h-8 w-8 text-purple-400/80" />
            <p className="text-sm font-medium text-white">Sin artefactos activos</p>
            <p className="mt-1 text-xs text-slate-400">La IA mostrará aquí un documento, fragmento de código o vista previa.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#090b12] text-white">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-purple-300">Workspace</span>
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[9px] text-purple-200">
            {activeFile.path.split('/').pop()}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsWorkspaceOpen(false)}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:text-white"
          aria-label="Cerrar Workspace"
        >
          Cerrar
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-white/5 bg-[#0d0d12] px-3 py-2">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setWorkspacePanelTab(tab.key as any)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors',
              workspacePanelTab === tab.key
                ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)]'
                : 'text-slate-300 hover:bg-white/5 hover:text-white',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {workspacePanelTab === 'preview' && (
          <div className="h-full overflow-hidden bg-[#0a0a0c]">
            <iframe
              title="Workspace preview"
              srcDoc={previewDoc}
              className="h-full w-full border-0 bg-[#0a0a0c]"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
        )}

        {workspacePanelTab === 'code' && (
          <div className="flex h-full flex-col overflow-hidden bg-[#0d0d12]">
            <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
              <span className="inline-flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-purple-300" />
                Editor
              </span>
              <span className="text-slate-500">{activeFile.language}</span>
            </div>
            <div className="min-h-0 flex-1">
              <CodeEditor readOnly={false} className="h-full" />
            </div>
          </div>
        )}

        {workspacePanelTab === 'exports' && (
          <div className="flex h-full flex-col justify-center gap-4 bg-[#0a0a0c] px-5 py-6 text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-300">
                <FileText className="h-3.5 w-3.5" />
                Exportar
              </div>
              <p className="mb-4 text-sm text-slate-400">
                Copia o descarga el contenido actual del artefacto activo.
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-purple-500/20"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copiado' : 'Copiar contenido'}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <Download className="h-4 w-4" />
                  Descargar archivo
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0d0d12] p-4">
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">Contenido</p>
              <textarea
                value={activeFile.content}
                onChange={(event) => updateActiveFile(event.target.value)}
                spellCheck={false}
                className="h-44 w-full resize-none rounded-xl border border-white/10 bg-[#0a0a0c] p-3 text-[12px] leading-6 text-slate-200 outline-none focus:border-purple-500/50"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
