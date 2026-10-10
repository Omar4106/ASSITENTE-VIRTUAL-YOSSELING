'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Gauge, Check } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type ChatMode = 'auto' | 'fast';

export function ModelSelector() {
  const { selectedProvider, setSelectedModel } = useAppStore();
  const [open, setOpen] = useState(false);

  const currentMode: ChatMode = selectedProvider === 'groq' ? 'fast' : 'auto';

  const switchMode = (mode: ChatMode) => {
    if (mode === 'auto') {
      setSelectedModel('auto', 'auto');
    } else {
      setSelectedModel('llama-3.3-70b-versatile', 'groq');
    }
    setOpen(false);
  };

  const modes: { id: ChatMode; label: string; description: string; icon: React.ReactNode; color: string }[] = [
    { id: 'auto', label: 'Automático', description: 'Yosseling elige el mejor modelo para cada tarea', icon: <Zap size={14} />, color: '#A855F7' },
    { id: 'fast', label: 'Ultra Rápido', description: 'Respuestas instantáneas con Groq', icon: <Gauge size={14} />, color: '#F55036' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#171923] border border-white/[0.06] hover:border-purple-500/30 hover:bg-purple-500/5 transition-all"
      >
        {currentMode === 'auto' ? (
          <Zap size={13} className="text-purple-400" />
        ) : (
          <Gauge size={13} className="text-orange-400" />
        )}
        <span className="text-sm font-semibold text-white">
          {currentMode === 'auto' ? 'Automático' : 'Ultra Rápido'}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.13 }}
              className="absolute left-0 top-full mt-2 z-50 bg-[#1A1B26] border border-white/10 rounded-2xl shadow-2xl w-[280px] overflow-hidden"
            >
              {modes.map(m => (
                <button
                  key={m.id}
                  onClick={() => switchMode(m.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left border-b border-white/[0.04] last:border-0',
                    currentMode === m.id && 'bg-white/[0.03]'
                  )}
                >
                  <span style={{ color: m.color }}>{m.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{m.label}</div>
                    <div className="text-xs text-[#B3B3B3]">{m.description}</div>
                  </div>
                  {currentMode === m.id && <Check size={14} style={{ color: m.color }} />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
