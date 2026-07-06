'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { MODELS_BY_PROVIDER, PROVIDERS } from '@/lib/ai-providers';
import type { ModelId, Provider } from '@/types';
import { cn } from '@/lib/utils';

export function ModelSelector() {
  const { selectedModel, selectedProvider, setSelectedModel } = useAppStore();
  const [open, setOpen] = useState(false);

  const currentModel = Object.values(MODELS_BY_PROVIDER).flat().find(m => m.id === selectedModel);
  const provider = PROVIDERS[selectedProvider];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#171923] border border-white/[0.06] hover:border-purple-500/30 hover:bg-purple-500/5 transition-all"
      >
        <span className="text-xs font-medium text-[#B3B3B3]">Modelo</span>
        <span className="text-sm font-semibold text-white">{currentModel?.name ?? selectedModel}</span>
        <span className="text-xs px-1.5 py-0.5 rounded-md text-white font-medium" style={{ background: provider?.color + '30', color: provider?.color }}>
          {provider?.name}
        </span>
        <ChevronDown size={14} className={cn('text-[#B3B3B3] transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full mt-2 z-50 bg-[#1A1B26] border border-white/10 rounded-2xl shadow-2xl min-w-[260px] overflow-hidden"
            >
              {(Object.entries(MODELS_BY_PROVIDER) as [Provider, typeof MODELS_BY_PROVIDER[Provider]][]).map(([prov, models]) => {
                const provInfo = PROVIDERS[prov];
                return (
                  <div key={prov}>
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
                      <div className="w-2 h-2 rounded-full" style={{ background: provInfo.color }} />
                      <span className="text-xs font-semibold text-white">{provInfo.name}</span>
                    </div>
                    {models.map(model => (
                      <button
                        key={model.id}
                        onClick={() => { setSelectedModel(model.id as ModelId, prov); setOpen(false); }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left',
                          selectedModel === model.id && 'bg-purple-500/10'
                        )}
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">{model.name}</div>
                          {model.description && (
                            <div className="text-xs text-[#B3B3B3]">{model.description}</div>
                          )}
                        </div>
                        {selectedModel === model.id && (
                          <Check size={14} className="text-purple-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
