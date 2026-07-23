'use client';

import { motion } from 'framer-motion';
import { Chrome as Home, MessageSquare, Cpu, Wrench, Settings } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { SidebarView } from '@/types';
import { cn } from '@/lib/utils';

const NAV_ITEMS: { id: SidebarView; icon: React.ReactNode; label: string }[] = [
  { id: 'chats',    icon: <Home size={20} />,          label: 'Inicio' },
  { id: 'chats',    icon: <MessageSquare size={20} />,  label: 'Chats' },
  { id: 'pinned',   icon: <Cpu size={20} />,            label: 'Centro IA' },
  { id: 'images',   icon: <Wrench size={20} />,        label: 'Herramientas' },
  { id: 'settings', icon: <Settings size={20} />,       label: 'Config' },
];

export function MobileNav() {
  const { sidebarView, setSidebarView, setSidebarOpen, rightPanelOpen, setRightPanelOpen } = useAppStore();

  const handleNav = (item: typeof NAV_ITEMS[number]) => {
    if (item.id === 'pinned') {
      setRightPanelOpen(!rightPanelOpen);
      return;
    }
    setSidebarView(item.id);
    setSidebarOpen(true);
  };

  return (
    <nav
      className="md:hidden flex items-center justify-around px-2 py-2 shrink-0"
      style={{
        background: 'rgba(18, 9, 31, 0.82)',
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {NAV_ITEMS.map((item, i) => {
        const isActive = item.id === 'pinned' ? rightPanelOpen : sidebarView === item.id;
        return (
          <motion.button
            key={`${item.label}-${i}`}
            whileTap={{ scale: 0.92 }}
            onClick={() => handleNav(item)}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all',
              isActive ? 'text-white' : 'text-[#BDB7CC]/60'
            )}
            style={isActive ? {
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(255, 95, 215, 0.1) 100%)',
              boxShadow: '0 0 12px rgba(168, 85, 247, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            } : {}}
          >
            <span className={cn(isActive && 'text-purple-400')}>{item.icon}</span>
            <span className="text-[9px] font-medium">{item.label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
}
