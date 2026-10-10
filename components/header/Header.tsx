'use client';

import { Sun, Moon, Bell, User, PanelRight, Menu } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { ModelSelector } from './ModelSelector';
import { cn } from '@/lib/utils';
import { OfflineStatus } from '@/components/offline/OfflineStatus';

export function Header() {
  const {
    settings, updateSettings,
    rightPanelOpen, setRightPanelOpen,
    sidebarOpen, setSidebarOpen,
  } = useAppStore();
  const isDark = settings.theme === 'dark';

  const toggleTheme = () => {
    updateSettings({ theme: isDark ? 'light' : 'dark' });
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('light', isDark);
    }
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#111218]/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden p-2 rounded-lg text-[#B3B3B3] hover:text-white hover:bg-white/5 transition-colors"
        >
          <Menu size={18} />
        </button>

        <ModelSelector />
      </div>

      <div className="flex items-center gap-2">
        <OfflineStatus />

        <button onClick={toggleTheme} className="p-2 rounded-lg text-[#B3B3B3] hover:text-white hover:bg-white/5 transition-colors">
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button className="relative p-2 rounded-lg text-[#B3B3B3] hover:text-white hover:bg-white/5 transition-colors">
          <Bell size={16} />
          <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-purple-500" />
        </button>

        <button onClick={() => setRightPanelOpen(!rightPanelOpen)} className={cn('p-2 rounded-lg transition-colors', rightPanelOpen ? 'text-white bg-white/10' : 'text-[#B3B3B3] hover:text-white hover:bg-white/5')}>
          <PanelRight size={16} />
        </button>

        <div className="flex items-center gap-2">
          {settings.userAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.userAvatar} alt={settings.userName} className="w-8 h-8 rounded-full object-cover border border-white/10" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center border border-white/10">
              <User size={14} className="text-white" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
