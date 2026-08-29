'use client';

import { MessageSquare, Cpu, Brain, Settings } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { icon: <MessageSquare size={20} />, label: 'Chat', view: 'chats' as const },
  { icon: <Cpu size={20} />, label: 'Modelos', view: 'pinned' as const },
  { icon: <Brain size={20} />, label: 'Memoria', view: 'memory' as const },
  { icon: <Settings size={20} />, label: 'Config', view: 'settings' as const },
];

export function MobileNav() {
  const { sidebarView, setSidebarView, setSidebarOpen } = useAppStore();

  return (
    <nav className="md:hidden flex items-center justify-around border-t border-white/[0.06] bg-[#111218] px-2 py-2 shrink-0">
      {NAV_ITEMS.map(item => (
        <button
          key={item.view}
          onClick={() => { setSidebarView(item.view); setSidebarOpen(true); }}
          className={cn(
            'flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all',
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
