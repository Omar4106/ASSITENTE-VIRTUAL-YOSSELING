'use client';

import { Cloud, Cpu, Loader as Loader2 } from 'lucide-react';
import { useConnectivity } from '@/hooks/useConnectivity';
import { getOfflineConfig, getRuntimeMode } from '@/lib/yosseling-engine';
import { useAppStore } from '@/lib/store';
import { useState, useEffect } from 'react';

export function OfflineStatus() {
  const { ollamaAvailable, pinging } = useConnectivity();
  const { settings, updateSettings } = useAppStore();
  const [isMounted, setIsMounted] = useState(false);
  const [currentMode, setCurrentMode] = useState<'cloud' | 'local'>('cloud');
  const [config, setConfig] = useState({
    backend: 'ollama',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'qwen2.5:7b',
    configured: false,
  });

  useEffect(() => {
    setConfig(getOfflineConfig());
    setCurrentMode(getRuntimeMode());
    setIsMounted(true);
  }, [settings.runtimeMode]);

  const localReady = ollamaAvailable === true || config.configured;
  const canToggleLocal = localReady;

  const toggleMode = () => {
    const next = settings.runtimeMode === 'local' ? 'cloud' : 'local';
    if (next === 'local' && !canToggleLocal) return;
    updateSettings({ runtimeMode: next });
    setCurrentMode(next);
  };

  const isLocal = currentMode === 'local';

  if (!isMounted) return null;

  return (
    <button
      onClick={toggleMode}
      disabled={!canToggleLocal && !isLocal}
      title={
        isLocal
          ? 'Clic para cambiar a Modo Nube'
          : canToggleLocal
            ? 'Clic para cambiar a Modo Local (Ollama)'
            : pinging
              ? 'Buscando motor local…'
              : 'Motor local no disponible — configura Ollama en Ajustes'
      }
      className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
        isLocal
          ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20'
          : 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20'
      }`}
    >
      {pinging ? (
        <Loader2 size={11} className="text-cyan-300 animate-spin" />
      ) : isLocal ? (
        <Cpu size={11} className="text-amber-300" />
      ) : (
        <Cloud size={11} className="text-green-300" />
      )}
      <span className={`text-[10px] font-medium ${isLocal ? 'text-amber-300' : 'text-green-300'}`}>
        {isLocal ? 'Modo Local' : 'Modo Nube'}
      </span>
    </button>
  );
}
