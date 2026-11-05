'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { ChatArea } from '@/components/chat/ChatArea';
import { FileExplorer } from '@/components/workspace/FileExplorer';
import { CodeEditor } from '@/components/workspace/CodeEditor';
import { PreviewPanel } from '@/components/workspace/PreviewPanel';
import { SidebarView } from '@/types';
import { Header } from '@/components/header/Header';
import { cn } from '@/lib/utils';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { motion, AnimatePresence } from 'framer-motion';

export default function WorkspacePage() {
  const { initStore, sidebarOpen, rightPanelOpen, workspacePanelTab } = useAppStore();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    initStore().then(() => setIsLoaded(true));
  }, [initStore]);

  if (!isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0d0e14]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
          <p className="text-purple-300 font-medium animate-pulse">Iniciando Workspace de Yosseling...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0d0e14] text-white overflow-hidden">
      {/* Universal Header */}
      <Header onOpenTools={() => undefined} isToolsOpen={false} />

      <main className="flex-1 overflow-hidden relative">
        <PanelGroup direction="horizontal">
          {/* Left Panel: Chat area */}
          <Panel defaultSize={30} minSize={20} className="flex flex-col border-r border-white/5 bg-black/20">
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="px-4 py-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                  💬 Chat Asistente
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatArea />
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-white/0 hover:bg-purple-500/30 transition-colors" />

          {/* Central Panel: Workspace Area (Preview / Code) */}
          <Panel defaultSize={50} minSize={30} className="flex flex-col bg-[#050505]">
            <div className="flex-1 overflow-hidden relative">
              <AnimatePresence mode="wait">
                {workspacePanelTab === 'preview' && (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0"
                  >
                    <PreviewPanel />
                  </motion.div>
                )}
                {workspacePanelTab === 'code' && (
                  <motion.div
                    key="code"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0"
                  >
                    <div className="flex flex-col h-full">
                      <div className="px-4 py-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          💻 Editor de Código
                        </span>
                      </div>
                      <div className="flex-1">
                        <CodeEditor readOnly={false} />
                      </div>
                    </div>
                  </motion.div>
                )}
                {workspacePanelTab === 'exports' && (
                  <motion.div
                    key="exports"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center"
                  >
                    <div className="p-8 text-center bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl max-w-md">
                      <h3 className="text-xl font-bold mb-2">Módulo de Exportación</h3>
                      <p className="text-sm text-slate-400 mb-6">
                        Aquí podrás descargar tu código como PDF, Markdown o un repositorio completo próximamente.
                      </p>
                      <button className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-xl font-bold transition-all">
                        Preparar Descarga (ZIP)
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-white/0 hover:bg-purple-500/30 transition-colors" />

          {/* Right Panel: File explorer / Navigator */}
          <Panel defaultSize={20} minSize={15} className="flex flex-col border-l border-white/5 bg-black/20">
            <div className="flex-1 overflow-hidden">
              <FileExplorer />
            </div>
          </Panel>
        </PanelGroup>
      </main>
    </div>
  );
}