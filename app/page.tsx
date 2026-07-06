'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { ToolsPanel } from '@/components/tools/ToolsPanel';
import { Header } from '@/components/header/Header';
import { MobileNav } from '@/components/mobile/MobileNav';
import { MemoryPanel } from '@/components/panels/MemoryPanel';
import { SettingsPanel } from '@/components/panels/SettingsPanel';
import { HelpPanel } from '@/components/panels/HelpPanel';
import { cn } from '@/lib/utils';

function SidebarOverlayPanel() {
  const { sidebarView, setSidebarView } = useAppStore();
  const isPanelView = ['memory', 'settings', 'help', 'shortcuts'].includes(sidebarView);

  if (!isPanelView) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute left-[260px] top-0 bottom-0 w-[320px] z-30 bg-[#0E0F14] border-r border-white/[0.06] overflow-hidden flex flex-col shadow-2xl"
    >
      {sidebarView === 'memory' && <MemoryPanel />}
      {sidebarView === 'settings' && <SettingsPanel />}
      {sidebarView === 'help' && <HelpPanel />}
    </motion.div>
  );
}

export default function Home() {
  const { initStore, sidebarOpen, createNewChat } = useAppStore();

  useEffect(() => {
    initStore();
  }, [initStore]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      createNewChat();
    }
  }, [createNewChat]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <main className="flex h-dvh w-full overflow-hidden bg-[#09090B]">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.div
            key="sidebar"
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative hidden md:flex h-full shrink-0"
          >
            <Sidebar />
            <AnimatePresence>
              <SidebarOverlayPanel />
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-hidden">
            <ChatArea />
          </div>
          <ToolsPanel />
        </div>
        <MobileNav />
      </div>
    </main>
  );
}
