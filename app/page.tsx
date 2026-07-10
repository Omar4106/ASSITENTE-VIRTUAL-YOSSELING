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
import { CinematicBackground } from '@/components/background/CinematicBackground';
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
      transition={{ duration: 0.25 }}
      className="absolute left-[260px] top-0 bottom-0 w-[320px] z-30 overflow-hidden flex flex-col shadow-2xl"
      style={{
        background: 'rgba(10,8,20,0.82)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderRight: '1px solid rgba(124,58,237,0.15)',
        borderLeft: '1px solid rgba(255,255,255,0.04)',
      }}
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
    <>
      {/* Cinematic background — fixed, behind everything */}
      <CinematicBackground />

      {/* App shell — sits above background, transparent panels */}
      <main className="relative flex h-dvh w-full overflow-hidden" style={{ zIndex: 1, background: 'transparent' }}>
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
              <div
                className="h-full"
                style={{
                  background: 'rgba(8,6,18,0.78)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  borderRight: '1px solid rgba(124,58,237,0.12)',
                }}
              >
                <Sidebar />
              </div>
              <AnimatePresence>
                <SidebarOverlayPanel />
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center content */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Header with glass effect */}
          <div
            style={{
              background: 'rgba(8,6,18,0.72)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderBottom: '1px solid rgba(124,58,237,0.1)',
            }}
          >
            <Header />
          </div>

          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Chat area — semi-transparent glass */}
            <div className="flex-1 min-w-0 overflow-hidden relative">
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

            {/* Tools panel with glass effect */}
            <div
              style={{
                background: 'rgba(8,6,18,0.78)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderLeft: '1px solid rgba(124,58,237,0.12)',
              }}
            >
              <ToolsPanel />
            </div>
          </div>

          <MobileNav />
        </div>
      </main>
    </>
  );
}
