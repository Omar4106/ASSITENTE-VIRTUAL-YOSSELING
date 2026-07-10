'use client';

import { motion } from 'framer-motion';
import { Sun, Moon, Bell, User, PanelRight, Menu, Zap } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { ModelSelector } from './ModelSelector';
import { PROVIDERS, PROVIDER_ORDER, MODELS_BY_PROVIDER } from '@/lib/ai-providers';
import type { Provider } from '@/types';
import { cn } from '@/lib/utils';

export function Header() {
  const {
    selectedProvider, settings, updateSettings,
    rightPanelOpen, setRightPanelOpen,
    sidebarOpen, setSidebarOpen,
    setSelectedModel,
  } = useAppStore();

  const isDark = settings.theme === 'dark';

  const toggleTheme = () => {
    updateSettings({ theme: isDark ? 'light' : 'dark' });
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('light', isDark);
    }
  };

  const switchProvider = (p: Provider) => {
    if (p === 'auto') {
      setSelectedModel('auto', 'auto');
      return;
    }
    const models = MODELS_BY_PROVIDER[p];
    if (models?.[0]) setSelectedModel(models[0].id, p);
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

        <div className="hidden sm:flex items-center gap-1.5">
          {PROVIDER_ORDER.map(p => {
            const info = PROVIDERS[p];
            const isActive = p === selectedProvider;
            return (
              <motion.button
                key={p}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => switchProvider(p)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  isActive ? 'text-white' : 'text-[#B3B3B3] border-white/[0.06] hover:border-white/20'
                )}
                style={isActive ? {
                  borderColor: info.color + '50',
                  background: info.color + '15',
                  color: info.color,
                } : {}}
              >
                {p === 'auto'
                  ? <Zap size={10} style={{ color: isActive ? info.color : '#B3B3B3' }} />
                  : <div className="w-1.5 h-1.5 rounded-full" style={{ background: isActive ? info.color : '#B3B3B3' }} />
                }
                {info.name}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400 font-medium">Conectado</span>
        </div>

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

        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <User size={14} className="text-white" />
        </div>
      </div>
    </header>
  );
}
