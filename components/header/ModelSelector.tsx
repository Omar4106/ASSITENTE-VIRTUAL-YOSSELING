'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Zap, Sparkles } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { MODELS_BY_PROVIDER, PROVIDER_INFO, FALLBACK_ORDER } from '@/lib/ai-config';
import type { ModelId, Provider } from '@/types';
import { cn } from '@/lib/utils';

export function ModelSelector() {
  const { selectedModel, selectedProvider, setSelectedModel } = useAppStore();
  const [open, setOpen] = useState(false);

  // Find current model info
  const currentModel = Object.values(MODELS_BY_PROVIDER)
    .flat()
    .find(m => m.id === selectedModel);
  const providerInfo = PROVIDER_INFO[selectedProvider];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#171923] border border-white/[0.06] hover:border-purple-500/30 hover:bg-purple-500/5 transition-all"
      >
        <Sparkles size={14} className="text-purple-400" />
        <span className="text-xs font-medium text-[#B3B3B3]">Modelo</span>
        <span className="text-sm font-semibold text-white">{currentModel?.name ?? selectedModel}</span>
        <span
          className="text-xs px-1.5 py-0.5 rounded-md text-white font-medium"
          style={{
            background: (providerInfo?.color ?? '#888') + '30',
            color: providerInfo?.color ?? '#888',
          }}
        >
          {providerInfo?.name ?? selectedProvider}
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
              className="absolute left-0 top-full mt-2 z-50 bg-[#1A1B26] border border-white/10 rounded-2xl shadow-2xl min-w-[300px] overflow-hidden max-h-[70vh] overflow-y-auto"
            >
              {/* Auto Mode */}
              <div className="border-b border-white/[0.06]">
                <button
                  onClick={() => {
                    // Set to Groq default for auto mode
                    const groqDefault = MODELS_BY_PROVIDER.groq?.find(m => m.isDefault);
                    if (groqDefault) {
                      setSelectedModel(groqDefault.id as ModelId, 'groq');
                    }
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left',
                    selectedProvider === 'groq' && selectedModel === 'llama-3.3-70b-versatile' && 'bg-purple-500/10'
                  )}
                >
                  <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                    <Zap size={14} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">Modo Automatico</div>
                    <div className="text-xs text-[#B3B3B3]">Usa fallback: Groq → OpenRouter → Gemini → Cerebras → OpenAI</div>
                  </div>
                  {selectedProvider === 'groq' && selectedModel === 'llama-3.3-70b-versatile' && (
                    <Check size={14} className="text-purple-400 shrink-0" />
                  )}
                </button>
              </div>

              {/* Providers in fallback order */}
              {FALLBACK_ORDER.map((prov: Provider) => {
                const models = MODELS_BY_PROVIDER[prov];
                const provInfo = PROVIDER_INFO[prov];
                if (!models || models.length === 0) return null;

                return (
                  <div key={prov} className="border-b border-white/[0.06] last:border-b-0">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.02] sticky top-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: provInfo.color }}
                      />
                      <span className="text-xs font-semibold text-white uppercase tracking-wide">
                        {provInfo.name}
                      </span>
                      <span className="text-[10px] text-[#B3B3B3] ml-auto">
                        {models.length} modelos
                      </span>
                    </div>
                    {models.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id as ModelId, prov);
                          setOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left',
                          selectedModel === model.id && 'bg-purple-500/10'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{model.name}</div>
                          {model.description && (
                            <div className="text-xs text-[#B3B3B3] truncate">{model.description}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {model.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                              Default
                            </span>
                          )}
                          {selectedModel === model.id && (
                            <Check size={14} className="text-purple-400" />
                          )}
                        </div>
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
