'use client';

import { MessageSquare, Brain, Settings, Zap } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { icon: <MessageSquare size={20} />, label: 'Chat', view: 'chats' as const },
  { icon: <Brain size={20} />,         label: 'Memoria', view: 'memory' as const },
  { icon: <Settings size={20} />,      label: 'Config', view: 'settings' as const },
  { icon: <Zap size={20} />,           label: 'Atajos', view: 'shortcuts' as const },
];

export function MobileNav() {
  const { sidebarView, setSidebarView, setSidebarOpen } = useAppStore();

  const handleNav = (view: typeof NAV_ITEMS[number]['view']) => {
    setSidebarView(view);
    setSidebarOpen(true);
  };

  return (
    <nav aria-label="Navegación principal" className="grid shrink-0 grid-cols-4 justify-items-center gap-2 border-t border-emerald-300/[0.08] bg-gradient-to-r from-[#080d10] via-[#111218] to-[#111018] px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
      {NAV_ITEMS.map(item => (
        <button
          type="button"
          key={item.view}
          onClick={() => handleNav(item.view)}
          className={cn(
            'flex w-full max-w-24 flex-col items-center gap-1.5 rounded-xl px-2 py-1.5 text-center transition-colors',
            sidebarView === item.view ? 'bg-purple-400/10 text-purple-300' : 'text-[#B3B3B3] hover:bg-white/5 hover:text-white'
          )}
        >
          {item.icon}
          <span className="text-[10px] leading-none">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
