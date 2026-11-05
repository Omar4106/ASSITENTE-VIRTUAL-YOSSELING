'use client';

import dynamic from 'next/dynamic';
import { useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { Header } from '@/components/header/Header';
import { MobileNav } from '@/components/mobile/MobileNav';
import { MemoryPanel } from '@/components/panels/MemoryPanel';
import { SettingsPanel } from '@/components/panels/SettingsPanel';
import { HelpPanel } from '@/components/panels/HelpPanel';
import { GalleryPanel } from '@/components/panels/GalleryPanel';
import { CinematicBackground } from '@/components/background/CinematicBackground';
import { ClientOnly } from '@/components/ui/ClientOnly';
import { WorkspaceCanvas } from '@/components/workspace/WorkspaceCanvas';
import { X } from 'lucide-react';

const AdvancedTools = dynamic(
  () => import('@/components/tools/AdvancedTools').then((module) => module.AdvancedTools),
  { loading: () => <div className="p-6 text-zinc-400">Cargando herramientas...</div> },
);

function PanelContent() {
  const { sidebarView } = useAppStore();

  if (sidebarView === 'memory') return <MemoryPanel />;
  if (sidebarView === 'settings') return <SettingsPanel />;
  if (sidebarView === 'help') return <HelpPanel />;
  if (sidebarView === 'gallery') return <GalleryPanel />;
  return null;
}

type ProjectArtifact = {
  id: string;
  name: string;
  type: 'document' | 'web';
  content: string;
  language: 'markdown' | 'html' | 'json' | 'typescript' | 'javascript' | 'css' | 'python' | 'jsx' | 'tsx' | 'py';
  path: string;
  createdAt: number;
  updatedAt: number;
};

function inferArtifactKind(content: string, pathHint?: string): { type: 'document' | 'web'; language: ProjectArtifact['language']; path: string } {
  const normalized = (content ?? '').trim();
  if (!normalized) {
    return { type: 'document', language: 'markdown', path: pathHint ?? 'document.md' };
  }

  const lowerPath = (pathHint ?? '').toLowerCase();
  const looksLikeWeb = /<!doctype html|<html|<body|<div|<section|<main|<script|document\.getElementById|window\./i.test(normalized) || lowerPath.includes('.html') || lowerPath.includes('.js');
  const looksLikeMarkdown = /^(#\s|\n#\s|[-*]\s|\d+\.\s)/m.test(normalized) || /```markdown/i.test(normalized) || /\b(?:documento|resumen|proyecto|instrucciones)\b/i.test(normalized);

  if (looksLikeWeb) {
    return { type: 'web', language: 'html', path: pathHint ?? 'web-page.html' };
  }

  if (looksLikeMarkdown || lowerPath.endsWith('.md')) {
    return { type: 'document', language: 'markdown', path: pathHint ?? 'document.md' };
  }

  if (/^\s*[\[{]/.test(normalized)) {
    return { type: 'document', language: 'json', path: pathHint ?? 'data.json' };
  }

  if (/^(from\s+\w+\s+import|import\s+\w+|def\s+\w+\s*\(|class\s+\w+\s*\()/m.test(normalized)) {
    return { type: 'document', language: 'python', path: pathHint ?? 'script.py' };
  }

  if (/export\s+(default\s+)?function|const\s+\w+\s*=\s*\(|return\s*\(\s*<|import\s+React/i.test(normalized)) {
    return { type: 'document', language: 'typescript', path: pathHint ?? 'component.tsx' };
  }

  return { type: 'document', language: 'markdown', path: pathHint ?? 'document.md' };
}

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [hasOpenedTools, setHasOpenedTools] = useState(false);
  const [projects, setProjects] = useState<ProjectArtifact[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<ProjectArtifact | null>(null);
  const {
    initStore, sidebarOpen, setSidebarOpen, sidebarView, createNewChat, settings,
    setConversationSection, workspaceFiles, isWorkspaceOpen, setIsWorkspaceOpen,
    setWorkspacePanelTab,
  } = useAppStore();

  const handleNewChat = useCallback(() => {
    setIsWorkspaceOpen(false);
    createNewChat();
  }, [createNewChat, setIsWorkspaceOpen]);

  const handleToggleWorkspace = useCallback(() => {
    setIsWorkspaceOpen(!isWorkspaceOpen);
  }, [isWorkspaceOpen, setIsWorkspaceOpen]);

  const handleProjectLoad = useCallback((project: { id: string; name: string; type: 'document' | 'web'; content: string; language: string; path: string; createdAt: number; updatedAt: number }) => {
    const selectedProject: ProjectArtifact = {
      ...project,
      language: project.language === 'html' || project.language === 'markdown' || project.language === 'json' || project.language === 'typescript' || project.language === 'javascript' || project.language === 'css' || project.language === 'python' || project.language === 'jsx' || project.language === 'tsx' || project.language === 'py'
        ? project.language
        : 'markdown',
    };
    setCurrentArtifact(selectedProject);
    setWorkspacePanelTab(selectedProject.type === 'web' ? 'preview' : 'preview');
    setIsWorkspaceOpen(true);
  }, [setIsWorkspaceOpen, setWorkspacePanelTab]);

  useEffect(() => {
    if (!workspaceFiles.length) return;
    const latest = [...workspaceFiles].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const artifactMeta = inferArtifactKind(latest.content, latest.path);
    const nextProject: ProjectArtifact = {
      id: latest.id,
      name: latest.path.split('/').pop() ?? 'artifact',
      type: artifactMeta.type,
      content: latest.content,
      language: artifactMeta.language,
      path: artifactMeta.path,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    };

    setCurrentArtifact((previous) => {
      if (!previous || previous.id !== nextProject.id || previous.content !== nextProject.content) {
        return nextProject;
      }
      return previous;
    });

    setProjects((previous) => {
      const filtered = previous.filter((project) => project.id !== nextProject.id);
      return [nextProject, ...filtered].slice(0, 8);
    });
  }, [workspaceFiles]);

  useEffect(() => {
    let cancelled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled) setIsMounted(true);
    }, 2500);

    try {
      const initialization = Promise.race([
        initStore(),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 2500);
        }),
      ]);

      void initialization
        .then(() => {
          if (!cancelled) setIsMounted(true);
        })
        .catch((error: unknown) => {
          console.error('[Yosseling] Failed to initialize local store:', error);
          if (!cancelled) setIsMounted(true);
        });
    } catch (error: unknown) {
      console.error('[Yosseling] Failed to start local store initialization:', error);
      if (!cancelled) setIsMounted(true);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [initStore]);

  // Apply theme, font size, and language to the DOM instantly when settings change.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', settings.theme === 'dark');
    root.classList.toggle('light', settings.theme === 'light');
    root.lang = settings.language;

    const fontSizes: Record<string, string> = { small: '14px', medium: '16px', large: '18px' };
    root.style.fontSize = fontSizes[settings.fontSize] ?? '16px';
  }, [settings.theme, settings.fontSize, settings.language]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      handleNewChat();
    }
  }, [handleNewChat]);

  const toggleTools = useCallback(() => {
    setIsToolsOpen((open) => !open);
    setHasOpenedTools(true);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const isPanelView = ['memory', 'settings', 'help', 'shortcuts', 'gallery'].includes(sidebarView);
  const shouldShowWorkspace = isWorkspaceOpen;

  return (
    <>
      <CinematicBackground />

      <main className="relative flex h-dvh w-full overflow-hidden" style={{ zIndex: 1, background: 'transparent' }}>
        {!isMounted ? (
          <div className="flex min-h-screen w-full items-center justify-center bg-[#0f0a1e] text-purple-300">
            Cargando Yosseling...
          </div>
        ) : (
          <ClientOnly>
        {/* ── Desktop sidebar (inline) ─────────────────────────────── */}
        <AnimatePresence mode="wait">
          {sidebarOpen && (
            <motion.div
              key="desktop-sidebar"
              initial={{ x: -260, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -260, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative hidden md:flex h-full shrink-0"
            >
              <div
                className="h-full"
                style={{
                  background: 'rgba(8,6,18,0.97)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  borderRight: '1px solid rgba(124,58,237,0.12)',
                }}
              >
                <Sidebar projects={projects} onLoadProject={handleProjectLoad} />
              </div>

              {/* Desktop: inline panel overlay to the right of sidebar */}
              <AnimatePresence>
                {isPanelView && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="absolute left-[260px] top-0 bottom-0 w-[340px] z-30 overflow-hidden flex flex-col shadow-2xl"
                    style={{
                      background: 'rgba(10,8,20,0.82)',
                      backdropFilter: 'blur(28px)',
                      WebkitBackdropFilter: 'blur(28px)',
                      borderRight: '1px solid rgba(124,58,237,0.15)',
                      borderLeft: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <PanelContent />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Mobile sidebar (slide-in overlay) ────────────────────── */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                key="mobile-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="md:hidden fixed inset-0 z-40"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              />
              {/* Sidebar panel */}
              <motion.div
                key="mobile-sidebar"
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px] overflow-hidden flex flex-col"
                style={{
                  background: 'rgba(8,6,18,0.98)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  borderRight: '1px solid rgba(124,58,237,0.15)',
                }}
              >
                <Sidebar mobileMode projects={projects} onLoadProject={handleProjectLoad} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Mobile panel overlay (settings/memory/help) ──────────── */}
        <AnimatePresence>
          {sidebarOpen && isPanelView && (
            <>
              {/* Backdrop for panel overlay */}
              <motion.div
                key="mobile-panel-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              />
              {/* Full-width centered panel modal */}
              <motion.div
                key="mobile-panel"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="md:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
              >
                <div
                  className="pointer-events-auto relative w-full sm:max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(10,8,20,0.95)',
                    backdropFilter: 'blur(28px)',
                    WebkitBackdropFilter: 'blur(28px)',
                    border: '1px solid rgba(124,58,237,0.15)',
                  }}
                >
                  {/* Close button */}
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="absolute top-3 right-3 z-10 p-2 rounded-lg text-[#B3B3B3] hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Cerrar"
                  >
                    <X size={20} />
                  </button>
                  <div className="overflow-y-auto">
                    <PanelContent />
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Center content ───────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <div
            style={{
              background: 'rgba(8,6,18,0.72)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderBottom: '1px solid rgba(124,58,237,0.1)',
            }}
          >
            <Header
              isToolsOpen={isToolsOpen}
              onOpenTools={toggleTools}
              onToggleWorkspace={handleToggleWorkspace}
            />
          </div>

          <div className={`flex flex-1 min-h-0 overflow-hidden transition-all duration-300 ease-in-out ${isToolsOpen ? 'hidden' : ''}`}>
            <div className={`flex flex-1 min-h-0 overflow-hidden transition-all duration-300 ease-in-out ${shouldShowWorkspace ? '' : 'w-full'}`}>
              <div
                className={`relative h-full min-w-0 overflow-hidden transition-all duration-300 ease-in-out ${shouldShowWorkspace ? 'w-[50%]' : 'w-full'}`}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'rgba(6,4,16,0.55)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                />
                <div className="relative h-full">
                  <ChatArea />
                </div>
              </div>

              <AnimatePresence>
                {shouldShowWorkspace && (
                  <motion.aside
                    key="workspace-panel"
                    initial={{ opacity: 0, x: 24, width: 0 }}
                    animate={{ opacity: 1, x: 0, width: '50%' }}
                    exit={{ opacity: 0, x: 24, width: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="hidden min-h-0 flex-col border-l border-white/10 bg-[#090b12]/90 backdrop-blur-xl transition-all duration-300 ease-in-out md:flex"
                    style={{ width: '50%' }}
                  >
                    <WorkspaceCanvas currentArtifact={currentArtifact} onArtifactChange={setCurrentArtifact} />
                  </motion.aside>
                )}
              </AnimatePresence>
            </div>
          </div>

          {hasOpenedTools && (
            <div className={`flex-1 min-h-0 overflow-hidden ${isToolsOpen ? 'flex' : 'hidden'}`}>
              <AdvancedTools
                isActive={isToolsOpen}
                setConversationSection={setConversationSection}
              />
            </div>
          )}

          <MobileNav />
        </div>
          </ClientOnly>
        )}
      </main>
    </>
  );
}
