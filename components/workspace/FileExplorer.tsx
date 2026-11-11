'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileJson2,
  FileText,
  Download,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { WorkspaceFile } from '@/types';

interface FileExplorerProps {
  className?: string;
}

interface FileTreeNode {
  name: string;
  path: string;
  file?: WorkspaceFile;
  children: FileTreeNode[];
}

function getFileIcon(path: string) {
  const extension = path.split('.').pop()?.toLowerCase();
  if (extension === 'xlsx') return <FileText size={14} className="shrink-0 text-emerald-300" />;
  if (extension === 'pptx') return <FileText size={14} className="shrink-0 text-orange-300" />;
  if (extension === 'docx') return <FileText size={14} className="shrink-0 text-blue-300" />;
  if (extension === 'json') return <FileJson2 size={14} className="shrink-0 text-amber-300" />;
  if (['tsx', 'ts', 'jsx', 'js', 'css', 'html'].includes(extension ?? '')) {
    return <FileCode2 size={14} className="shrink-0 text-sky-300" />;
  }
  if (['md', 'txt'].includes(extension ?? '')) return <FileText size={14} className="shrink-0 text-slate-400" />;
  return <FileText size={14} className="shrink-0 text-slate-500" />;
}

function createFileTree(files: WorkspaceFile[]) {
  const root: FileTreeNode = { name: '', path: '', children: [] };

  for (const file of files) {
    const parts = file.path.replace(/\\/g, '/').split('/').filter(Boolean);
    let node = root;
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('/');
      let child = node.children.find((entry) => entry.name === part);
      if (!child) {
        child = { name: part, path, children: [] };
        node.children.push(child);
      }
      if (index === parts.length - 1) child.file = file;
      node = child;
    });
  }

  const sortNodes = (node: FileTreeNode) => {
    node.children.sort((a, b) => {
      const aIsFolder = !a.file || a.children.length > 0;
      const bIsFolder = !b.file || b.children.length > 0;
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNodes);
  };
  sortNodes(root);
  return root.children;
}

export function FileExplorer({ className }: FileExplorerProps) {
  const workspaceFiles = useAppStore((state) => state.workspaceFiles);
  const activeWorkspaceFile = useAppStore((state) => state.activeWorkspaceFile);
  const setActiveWorkspaceFile = useAppStore((state) => state.setActiveWorkspaceFile);
  const setWorkspaceFiles = useAppStore((state) => state.setWorkspaceFiles);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  const tree = useMemo(() => createFileTree(workspaceFiles), [workspaceFiles]);

  const createNewFile = () => {
    const existingPaths = new Set(workspaceFiles.map((file) => file.path));
    let index = 1;
    let path = 'src/components/Component.tsx';
    while (existingPaths.has(path)) {
      index += 1;
      path = `src/components/Component${index}.tsx`;
    }

    const now = Date.now();
    const file: WorkspaceFile = {
      id: crypto.randomUUID(),
      path,
      content: `export function Component() {\n  return <main>Hello, Yosseling</main>;\n}\n`,
      language: 'tsx',
      type: 'component',
      isModified: true,
      createdAt: now,
      updatedAt: now,
    };
    setWorkspaceFiles([...workspaceFiles, file]);
    setActiveWorkspaceFile(file.id);
  };

  const deleteFile = (fileId: string) => {
    const nextFiles = workspaceFiles.filter((file) => file.id !== fileId);
    setWorkspaceFiles(nextFiles);
    if (activeWorkspaceFile === fileId) setActiveWorkspaceFile(nextFiles[0]?.id ?? null);
  };

  const renderNode = (node: FileTreeNode, depth: number): React.ReactNode => {
    const isFolder = !node.file || node.children.length > 0;
    const isCollapsed = collapsedFolders.has(node.path);

    if (isFolder) {
      return (
        <div key={node.path}>
          <button
            type="button"
            onClick={() => setCollapsedFolders((current) => {
              const next = new Set(current);
              if (next.has(node.path)) next.delete(node.path);
              else next.add(node.path);
              return next;
            })}
            className="flex h-7 w-full items-center gap-1.5 pr-2 text-left text-[11px] text-slate-300 transition hover:bg-white/[0.04]"
            style={{ paddingLeft: 8 + depth * 12 }}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            {isCollapsed
              ? <Folder size={14} className="shrink-0 text-violet-300" />
              : <FolderOpen size={14} className="shrink-0 text-violet-300" />}
            <span className="truncate">{node.name}</span>
          </button>
          {!isCollapsed && node.children.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    const file = node.file;
    if (!file) return null;
    const isActive = file.id === activeWorkspaceFile;
    return (
      <div
        key={file.id}
        className={cn(
          'group/file flex h-7 items-center border-l-2 pr-2 transition',
          isActive
            ? 'border-violet-400 bg-violet-500/10 text-violet-100'
            : 'border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
        )}
        style={{ paddingLeft: 30 + depth * 12 }}
      >
        <button
          type="button"
          onClick={() => setActiveWorkspaceFile(file.id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          title={file.path}
        >
          {getFileIcon(file.path)}
          <span className="truncate text-[11px]">{node.name}</span>
          {file.binaryData && <Download size={11} className="shrink-0 text-emerald-300" aria-label="Archivo descargable" />}
          {file.isModified && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />}
        </button>
        <button
          type="button"
          onClick={() => deleteFile(file.id)}
          aria-label={`Eliminar ${node.name}`}
          title="Eliminar archivo"
          className="ml-1 hidden rounded p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-300 group-hover/file:inline-flex"
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  };

  return (
    <aside className={cn('flex h-full min-h-0 flex-col overflow-hidden bg-[#101117]', className)}>
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.06] px-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">File Explorer</span>
        <button
          type="button"
          onClick={createNewFile}
          aria-label="Crear archivo"
          title="Crear archivo"
          className="rounded p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {tree.length ? (
          tree.map((node) => renderNode(node, 0))
        ) : (
          <div className="px-3 py-5 text-[11px] leading-5 text-slate-500">
            Aún no hay archivos. Usa + para empezar.
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-white/[0.06] px-3 py-2 text-[10px] text-slate-500">
        {workspaceFiles.length} {workspaceFiles.length === 1 ? 'archivo' : 'archivos'}
      </div>
    </aside>
  );
}
