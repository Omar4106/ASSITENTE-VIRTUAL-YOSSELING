'use client';

import { useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { ChevronRight, File, Folder, FolderOpen, Share2, MoreHorizontal, Trash2, Plus, Copy, Type } from 'lucide-react';
import type { WorkspaceFile } from '@/types';

interface FileExplorerProps {
  className?: string;
}

const BUILT_IN_EXTS = {
  tsx: 'component',
  jsx: 'component',
  ts: 'logic',
  js: 'logic',
  page: 'page',
  routes: 'route',
  styles: 'style',
  utils: 'logic',
  config: 'config',
  json: 'config',
  markdown: 'markdown',
} as const;

export function FileExplorer({ className }: FileExplorerProps) {
  const workspaceFiles = useAppStore(s => s.workspaceFiles);
  const activeWorkspaceFile = useAppStore(s => s.activeWorkspaceFile);
  const setActiveWorkspaceFile = useAppStore(s => s.setActiveWorkspaceFile);
  const selectedModel = useAppStore(s => s.selectedModel);

  const getFileIcon = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const type = BUILT_IN_EXTS[ext as keyof typeof BUILT_IN_EXTS] ?? 'other';

    if (type === 'component' || ext === 'tsx' || ext === 'jsx') {
      return <Type size={14} className="text-purple-400" />;
    } else if (type === 'page' || type === 'route') {
      return <Share2 size={14} className="text-blue-400" />;
    } else if (type === 'style') {
      return <Share2 size={14} className="text-cyan-400" />;
    } else if (type === 'config' || type === 'markdown') {
      return <File size={14} className="text-yellow-400" />;
    } else {
      return <File size={14} className="text-slate-400" />;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleCreateNewFile = () => {
    const newFile: WorkspaceFile = {
      id: crypto.randomUUID(),
      path: 'src/components/NewComponent.tsx',
      content: `// Nuevo componente creado por Yosseling
import React from 'react';

export function NewComponent() {
  return (
    <div>
      <h1>Aquí comienza tu componente</h1>
      <p>Edita este archivo y tu preview se actualizará en tiempo real</p>
    </div>
  );
}`,
      language: 'typescript',
      type: 'component',
      isModified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chatId: undefined,
    };

    useAppStore.getState().workspaceFiles.push(newFile);
    setActiveWorkspaceFile(newFile.id);
  };

  const groupedFiles = workspaceFiles.reduce((acc, file) => {
    const folderPath = file.path.split('/').slice(0, -1).join('/') || 'root';
    if (!acc[folderPath]) {
      acc[folderPath] = [];
    }
    acc[folderPath].push(file);
    return acc;
  }, {} as Record<string, WorkspaceFile[]>);

  const folders = Object.keys(groupedFiles).sort();
  const sortedFiles = workspaceFiles.sort((a, b) => {
    const aIsFolder = folders.includes(a.path.split('/').slice(0, -1).join('/'));
    const bIsFolder = folders.includes(b.path.split('/').slice(0, -1).join('/'));
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return a.path.localeCompare(b.path);
  });

  const createCopyOfActiveFile = () => {
    if (!activeWorkspaceFile) return;
    const original = workspaceFiles.find(f => f.id === activeWorkspaceFile);
    if (!original) return;

    const copy: WorkspaceFile = {
      ...original,
      id: crypto.randomUUID(),
      path: original.path.replace(/\.tsx?$/, '-copy.tsx').replace(/\.jsx?$/, '-copy.jsx'),
      content: `${original.content}\n\n// Copiado desde ${original.path}`,
      isModified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    useAppStore.getState().workspaceFiles.push(copy);
    setActiveWorkspaceFile(copy.id);
  };

  const deleteFile = (fileId: string) => {
    useAppStore.getState().workspaceFiles.filter(f => f.id !== fileId);
    if (activeWorkspaceFile === fileId) {
      setActiveWorkspaceFile(null);
    }
  };

  return (
    <div
      className={cn(
        'group flex flex-col h-full bg-black/40 border-r border-white/5 overflow-hidden'
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
          <Folder size={14} className="text-purple-400" />
          📁 Workspace
        </span>
        <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
          {sortedFiles.length} archivos
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5">
        <button
          onClick={handleCreateNewFile}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-purple-300 hover:bg-purple-500/10 hover:text-white rounded transition-colors"
          title="Crear nuevo arch"
        >
          <Plus size={12} />
          <span>Nuevo</span>
        </button>
        {activeWorkspaceFile && (
          <button
            onClick={createCopyOfActiveFile}
            className="flex items-center justify-center px-2 py-1.5 text-xs text-slate-400 hover:bg-white/10 hover:text-white rounded transition-colors"
            title="Copiar archivo activo"
          >
            <Copy size={12} />
          </button>
        )}
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Commited Files */}
        {sortedFiles.length > 0 && (
          <div>
            <div className="px-3 py-1.5 bg-white/5 border-b border-white/5">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                Archivos
              </span>
            </div>
            {sortedFiles.map(file => {
              const isActive = file.id === activeWorkspaceFile;
              return (
                <div
                  key={file.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors border-l-2',
                    isActive
                      ? 'bg-purple-500/10 border-purple-500 text-purple-300 font-medium'
                      : 'hover:bg-white/5 border-transparent text-slate-400'
                  )}
                  onClick={() => setActiveWorkspaceFile(file.id)}
                >
                  {getFileIcon(file.path)}
                  <span className="text-xs truncate flex-1">{file.path.split('/').pop()}</span>
                  {file.isModified && (
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-green-400" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {sortedFiles.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 px-4 text-center">
            <Folder size={32} className="text-slate-600 mb-2" />
            <p className="text-xs text-slate-500 mb-1">
              Tu workspace está vacío
            </p>
            <p className="text-[10px] text-slate-600">
              Usa el botón "Nuevo" para crear archivos
            </p>
          </div>
        )}
      </div>
    </div>
  );
}