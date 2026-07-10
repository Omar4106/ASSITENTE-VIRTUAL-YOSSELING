'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Loader as Loader2, Zap } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { PROVIDER_ORDER, PROVIDERS, MODELS_BY_PROVIDER, PROVIDER_CONFIG } from '@/lib/ai-providers';
import type { Provider } from '@/types';
import { cn } from '@/lib/utils';

export function ModelSelector() {
  const { selectedModel, selectedProvider, setSelectedModel } = useAppStore();
  const [open, setOpen] = useState(false);
  const [dynamicModels, setDynamicModels] = useState<Record<string, { id: string; name: string }[]>>({});
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const fetched = useRef(new Set<Provider>());

  const fetchDynamic = async (prov: Exclude<Provider, 'auto'>) => {
    if (fetched.current.has(prov)) return;
    fetched.current.add(prov);
    setLoadingProvider(prov);
    try {
      const res = await fetch(`/api/models?provider=${prov}`);
      const data = await res.json();
      if (Array.isArray(data.models) && data.models.length > 0) {
        setDynamicModels(prev => ({ ...prev, [prov]: data.models }));
      }
    } catch { /* use static */ }
    finally { setLoadingProvider(null); }
  };

  useEffect(() => {
    if (open && selectedProvider !== 'auto') {
      fetchDynamic(selectedProvider as Exclude<Provider, 'auto'>);
    }
  }, [open, selectedProvider]);

  const getModels = (prov: Exclude<Provider, 'auto'>) =>
    dynamicModels[prov] ?? MODELS_BY_PROVIDER[prov] ?? [];

  const currentLabel = selectedProvider === 'auto'
    ? 'Automático'
    : (getModels(selectedProvider as Exclude<Provider, 'auto'>).find(m => m.id === selectedModel)?.name ?? selectedModel);

  const providerColor = PROVIDERS[selectedProvider]?.color ?? '#A855F7';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#171923] border border-white/[0.06] hover:border-purple-500/30 hover:bg-purple-500/5 transition-all"
      >
        {selectedProvider === 'auto' && <Zap size={13} className="text-purple-400" />}
        <span className="text-xs font-medium text-[#B3B3B3]">Modelo</span>
        <span className="text-sm font-semibold text-white max-w-[140px] truncate">{currentLabel}</span>
        {selectedProvider !== 'auto' && (
          <span className="text-xs px-1.5 py-0.5 rounded-md font-medium hidden sm:block"
            style={{ background: providerColor + '25', color: providerColor }}>
            {PROVIDERS[selectedProvider]?.name}
          </span>
        )}
        <ChevronDown size={14} className={cn('text-[#B3B3B3] transition-transform shrink-0', open && 'rotate-180')} />
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
              className="absolute left-0 top-full mt-2 z-50 bg-[#1A1B26] border border-white/10 rounded-2xl shadow-2xl w-[300px] max-h-[420px] overflow-y-auto"
            >
              {PROVIDER_ORDER.map(prov => {
                const info = PROVIDERS[prov];
                const isAuto = prov === 'auto';

                return (
                  <div key={prov} className="border-b border-white/[0.06] last:border-0">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.02]">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: info.color }} />
                      <span className="text-xs font-semibold text-white">{info.name}</span>
                      {!isAuto && loadingProvider === prov && (
                        <Loader2 size={11} className="text-[#B3B3B3] animate-spin ml-auto" />
                      )}
                    </div>

                    {isAuto ? (
                      <button
                        onClick={() => { setSelectedModel('auto', 'auto'); setOpen(false); }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left',
                          selectedProvider === 'auto' && 'bg-purple-500/10'
                        )}
                      >
                        <Zap size={14} className="text-purple-400 shrink-0" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">Selección automática</div>
                          <div className="text-xs text-[#B3B3B3]">Mejor proveedor según la tarea</div>
                        </div>
                        {selectedProvider === 'auto' && <Check size={13} className="text-purple-400" />}
                      </button>
                    ) : (
                      getModels(prov as Exclude<Provider, 'auto'>).map(model => {
                        const active = selectedModel === model.id && selectedProvider === prov;
                        return (
                          <button
                            key={model.id}
                            onClick={() => {
                              setSelectedModel(model.id, prov);
                              setOpen(false);
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left',
                              active && 'bg-purple-500/10'
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate">{model.name}</div>
                              {'description' in model && (model as { description?: string }).description && (
                                <div className="text-xs text-[#B3B3B3] truncate">{(model as { description: string }).description}</div>
                              )}
                            </div>
                            {active && <Check size={13} className="text-purple-400 shrink-0" />}
                          </button>
                        );
                      })
                    )}
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
