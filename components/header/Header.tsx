'use client';

import Image from 'next/image';
import { Sun, Moon, Bell, User, Menu, Wrench } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { ModelSelector } from './ModelSelector';
import { cn } from '@/lib/utils';
import { OfflineStatus } from '@/components/offline/OfflineStatus';

interface HeaderProps {
  onOpenTools: () => void;
  isToolsOpen: boolean;
}

export function Header({ onOpenTools, isToolsOpen }: HeaderProps) {
  const {
    settings, updateSettings,
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
    <header className="flex min-w-0 items-center justify-between gap-2 border-b border-emerald-300/[0.08] bg-gradient-to-r from-[#080d10]/95 via-[#111218]/90 to-[#111018]/95 px-2 py-2.5 backdrop-blur-xl sm:px-4 sm:py-3">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
          className="shrink-0 rounded-lg p-2 text-[#B3B3B3] transition-colors hover:bg-white/5 hover:text-white md:hidden"
        >
          <Menu size={18} />
        </button>

        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
          <div className="relative h-7 w-7 shrink-0 sm:h-8 sm:w-8">
            <Image
              src="/assets/images/logo_de_yosseling_sin_fondo_.png"
              alt=""
              fill
              sizes="32px"
              className="object-contain"
            />
          </div>
          <span className="hidden truncate text-sm font-semibold tracking-wide text-white lg:inline">
            Yosseling
          </span>
        </div>

        <div className="min-w-0">
          <ModelSelector />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <OfflineStatus />

        <button
          type="button"
          onClick={onOpenTools}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-[#B3B3B3] transition-colors hover:bg-white/5 hover:text-white sm:px-3"
          aria-label={isToolsOpen ? 'Volver al chat' : 'Abrir herramientas'}
          aria-pressed={isToolsOpen}
        >
          <Wrench size={16} />
          <span className="hidden sm:inline">{isToolsOpen ? 'Volver al chat' : 'Herramientas'}</span>
        </button>

        <button type="button" onClick={toggleTheme} aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} className="rounded-lg p-2 text-[#B3B3B3] transition-colors hover:bg-white/5 hover:text-white">
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button type="button" aria-label="Notificaciones" className="relative hidden rounded-lg p-2 text-[#B3B3B3] transition-colors hover:bg-white/5 hover:text-white sm:inline-flex">
          <Bell size={16} />
          <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-purple-500" />
        </button>

        <div className="hidden items-center gap-2 sm:flex">
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
