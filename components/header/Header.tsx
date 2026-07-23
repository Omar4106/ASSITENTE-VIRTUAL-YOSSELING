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
    <header
      className="flex items-center justify-between px-4 py-3 shrink-0"
      style={{
        background: 'rgba(18, 9, 31, 0.5)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden p-2 rounded-lg text-[#BDB7CC] hover:text-white hover:bg-white/5 transition-colors"
        >
          <Menu size={18} />
        </button>

        <ModelSelector />

        <div className="hidden lg:flex items-center gap-1.5">
          {PROVIDER_ORDER.map(p => {
            const info = PROVIDERS[p];
            const isActive = p === selectedProvider;
            return (
              <motion.button
                key={p}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => switchProvider(p)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  isActive ? 'text-white' : 'text-[#BDB7CC] border-white/[0.06] hover:border-white/20'
                )}
                style={isActive ? {
                  borderColor: info.color + '50',
                  background: info.color + '15',
                  color: info.color,
                  boxShadow: `0 0 12px ${info.color}20`,
                } : {}}
              >
                {p === 'auto'
                  ? <Zap size={10} style={{ color: isActive ? info.color : '#BDB7CC' }} />
                  : <div className="w-1.5 h-1.5 rounded-full" style={{ background: isActive ? info.color : '#BDB7CC' }} />
                }
                {info.name}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.15)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400 font-medium">Conectado</span>
        </div>

        <button onClick={toggleTheme} className="p-2 rounded-lg text-[#BDB7CC] hover:text-white hover:bg-white/5 transition-colors">
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button className="relative p-2 rounded-lg text-[#BDB7CC] hover:text-white hover:bg-white/5 transition-colors">
          <Bell size={16} />
          <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
        </button>

        <button
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className={cn(
            'p-2 rounded-lg transition-colors',
            rightPanelOpen ? 'text-white' : 'text-[#BDB7CC] hover:text-white hover:bg-white/5'
          )}
          style={rightPanelOpen ? { background: 'rgba(168, 85, 247, 0.1)', boxShadow: '0 0 8px rgba(168, 85, 247, 0.15)' } : {}}
        >
          <PanelRight size={16} />
        </button>

        <div
          className="w-8 h-8 rounded-full flex items-center justify-center border border-white/15"
          style={{ background: 'linear-gradient(135deg, #FF5FD7 0%, #A855F7 100%)', boxShadow: '0 0 12px rgba(168, 85, 247, 0.2)' }}
        >
          <User size={14} className="text-white" />
        </div>
      </div>
    </header>
  );
}
