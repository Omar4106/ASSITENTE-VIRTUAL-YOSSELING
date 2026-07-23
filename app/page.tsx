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
      className="absolute left-[280px] top-0 bottom-0 w-[320px] z-30 overflow-hidden flex flex-col"
      style={{
        background: 'rgba(18, 9, 31, 0.85)',
        backdropFilter: 'blur(28px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
        borderRight: '1px solid rgba(168, 85, 247, 0.12)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.04)',
        boxShadow: '8px 0 32px rgba(0, 0, 0, 0.3)',
      }}
    >
      {sidebarView === 'memory' && <MemoryPanel />}
      {sidebarView === 'settings' && <SettingsPanel />}
      {sidebarView === 'help' && <HelpPanel />}
    </motion.div>
  );
}

export default function Home() {
  const { initStore, sidebarOpen, rightPanelOpen, createNewChat } = useAppStore();

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
      <CinematicBackground />

      <main className="relative flex h-dvh w-full overflow-hidden" style={{ zIndex: 1 }}>
        {/* ── LEFT: Sidebar ── */}
        <AnimatePresence mode="wait">
          {sidebarOpen && (
            <motion.div
              key="sidebar"
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
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

        {/* ── CENTER: Chat ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Header */}
          <div
            className="shrink-0"
            style={{
              background: 'rgba(18, 9, 31, 0.65)',
              backdropFilter: 'blur(24px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <Header />
          </div>

          {/* Chat area */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <div
              className="absolute inset-0"
              style={{
                background: 'rgba(18, 9, 31, 0.35)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            />
            <div className="relative h-full">
              <ChatArea />
            </div>
          </div>

          {/* Mobile bottom nav */}
          <MobileNav />
        </div>

        {/* ── RIGHT: Intelligent Panel ── */}
        <div className="hidden md:flex h-full shrink-0">
          <ToolsPanel />
        </div>
      </main>
    </>
  );
}
