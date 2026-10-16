'use client';

import { MessageSquare, Brain, Settings, Zap } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const PANEL_VIEWS = ['memory', 'settings', 'help', 'shortcuts'];

const NAV_ITEMS = [
  { icon: <MessageSquare size={20} />, label: 'Chat', view: 'chats' as const },
  { icon: <Brain size={20} />,         label: 'Memoria', view: 'memory' as const },
  { icon: <Settings size={20} />,      label: 'Config', view: 'settings' as const },
  { icon: <Zap size={20} />,           label: 'Atajos', view: 'shortcuts' as const },
];

export function MobileNav() {
  const { sidebarView, setSidebarView, setSidebarOpen, sidebarOpen } = useAppStore();

  const handleNav = (view: typeof NAV_ITEMS[number]['view']) => {
    setSidebarView(view);
    if (PANEL_VIEWS.includes(view)) {
      // Panel views: open sidebar so the panel overlay can show
      setSidebarOpen(true);
    } else {
      // Non-panel: close sidebar so user sees the chat list, then select
      setSidebarOpen(true);
    }
  };

  return (
    <nav className="md:hidden flex items-center justify-around border-t border-white/[0.06] bg-[#111218] px-2 py-2 shrink-0">
      {NAV_ITEMS.map(item => (
        <button
          key={item.view}
          onClick={() => handleNav(item.view)}
          className={cn(
            'flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-colors',
            sidebarView === item.view ? 'text-purple-400' : 'text-[#B3B3B3]'
          )}
        >
          {item.icon}
          <span className="text-[9px]">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
