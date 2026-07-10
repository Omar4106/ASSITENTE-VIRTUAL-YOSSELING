'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Eye, FileSearch, Volume2, Mic, Globe, Printer, FileText, ChevronDown, SlidersHorizontal, Gauge, Languages, Palette, Type, Brain, X, Zap, Activity, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, ArrowRight, Square, Play, Pause } from 'lucide-react';
import { useAppStore, useActiveChat } from '@/lib/store';
import { PROVIDERS } from '@/lib/ai-providers';
import { useVoice } from '@/hooks/useVoice';
import { cn } from '@/lib/utils';

const TOOLS = [
  { icon: <Eye size={16} />,        label: 'Analizar imagen', action: 'analyze_image', color: '#10B981', hint: 'Gemini (multimodal)' },
  { icon: <FileSearch size={16} />, label: 'OCR / Texto',     action: 'ocr',           color: '#F59E0B', hint: 'Gemini' },
  { icon: <Volume2 size={16} />,    label: 'Leer en voz',     action: 'read_voice',    color: '#EC4899', hint: 'Web Speech' },
  { icon: <Mic size={16} />,        label: 'Reconocer voz',   action: 'recognize_voice', color: '#8B5CF6', hint: 'Web Speech' },
  { icon: <Globe size={16} />,      label: 'Buscar en web',   action: 'web_search',    color: '#3B82F6', hint: 'Auto' },
  { icon: <Printer size={16} />,    label: 'Imprimir',        action: 'print',         color: '#6B7280', hint: 'Local' },
  { icon: <ImageIcon size={16} />,  label: 'Generar imagen',  action: 'generate_image', color: '#A855F7', hint: 'OpenAI DALL-E' },
  { icon: <FileText size={16} />,   label: 'Resumir doc.',    action: 'summarize',     color: '#06B6D4', hint: 'Groq' },
];

const FONT_SIZES = [
  { label: 'Pequeño', value: 'small' },
  { label: 'Mediano', value: 'medium' },
  { label: 'Grande',  value: 'large' },
] as const;

export function ToolsPanel() {
  const {
    settings, updateSettings, memory, pendingFiles,
    sendMessage, isSpeaking, rightPanelOpen, setRightPanelOpen,
    aiCenterData, selectedProvider, selectedModel,
  } = useAppStore();
  const activeChat = useActiveChat();
  const { speak, stopSpeaking, pauseSpeaking, resumeSpeaking, startListening, stopListening, voiceState } = useVoice();
  const [activeSection, setActiveSection] = useState<string | null>('tools');

  const handleTool = (action: string) => {
    const prompts: Record<string, string> = {
      analyze_image: 'Analiza esta imagen y describe detalladamente lo que ves, incluyendo texto, objetos y contexto.',
      ocr:           'Extrae todo el texto visible en esta imagen usando OCR.',
      web_search:    'Busca en internet información actualizada sobre: ',
      generate_image:'Crea una imagen de: ',
      summarize:     'Resume el siguiente texto de forma concisa: ',
    };
    if (action === 'print')          { window.print(); return; }
    if (action === 'read_voice') {
      const last = activeChat?.messages?.filter(m => m.role === 'assistant').pop();
      if (last) speak(last.content);
      return;
    }
    if (action === 'recognize_voice') {
      startListening(text => sendMessage(text));
      return;
    }
    const prompt = prompts[action];
    if (prompt !== undefined) sendMessage(prompt);
  };

  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setActiveSection(activeSection === id ? null : id)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <span className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wider">{title}</span>
        <ChevronDown size={14} className={cn('text-[#B3B3B3] transition-transform', activeSection === id && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {activeSection === id && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const providerName = (p: string) => PROVIDERS[p as keyof typeof PROVIDERS]?.name ?? p;

  return (
    <motion.aside
      initial={false}
      animate={{ width: rightPanelOpen ? 280 : 0, opacity: rightPanelOpen ? 1 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="h-full bg-[#111218] border-l border-white/[0.06] overflow-hidden flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <span className="text-sm font-semibold text-white">Herramientas</span>
        <button onClick={() => setRightPanelOpen(false)} className="text-[#B3B3B3] hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Centro IA */}
        <Section id="ai-center" title="Centro IA">
          <div className="px-3 space-y-2.5">
            {/* Status */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03]">
              {!aiCenterData || aiCenterData.status === 'idle' ? (
                <Zap size={13} className="text-[#B3B3B3]" />
              ) : aiCenterData.status === 'streaming' ? (
                <Activity size={13} className="text-purple-400 animate-pulse" />
              ) : aiCenterData.status === 'success' ? (
                <CheckCircle2 size={13} className="text-green-400" />
              ) : (
                <AlertCircle size={13} className="text-red-400" />
              )}
              <span className="text-xs font-semibold text-white">
                {!aiCenterData || aiCenterData.status === 'idle' ? 'Inactivo' :
                 aiCenterData.status === 'streaming' ? 'Generando...' :
                 aiCenterData.status === 'success' ? 'Completado' : 'Error'}
              </span>
              {aiCenterData?.fallbackUsed && (
                <span className="ml-auto text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded-full">Fallback</span>
              )}
            </div>

            <DataRow label="Proveedor activo" value={aiCenterData ? providerName(aiCenterData.activeProvider) : providerName(selectedProvider)} />
            <DataRow label="Modelo activo" value={aiCenterData?.activeModel ?? selectedModel} />
            <DataRow label="Proveedor usado" value={aiCenterData?.providerUsed ? providerName(aiCenterData.providerUsed) : '-'} />
            <DataRow label="Latencia" value={aiCenterData ? `${aiCenterData.latency}ms` : '-'} />
            <DataRow label="Tiempo respuesta" value={aiCenterData ? `${aiCenterData.responseTime}ms` : '-'} />
            <DataRow label="Tokens" value={aiCenterData ? String(aiCenterData.tokens) : '-'} />
            <DataRow label="Costo aprox." value={aiCenterData ? `$${aiCenterData.costEstimate.toFixed(6)}` : '-'} />

            {aiCenterData?.fallbackUsed && aiCenterData.discardedProviders.length > 0 && (
              <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-yellow-400 font-semibold">
                  <ArrowRight size={10} /> Fallback utilizado
                </div>
                <div className="text-[10px] text-[#B3B3B3]">
                  Descartados: {aiCenterData.discardedProviders.map(providerName).join(', ')}
                </div>
                <div className="text-[10px] text-[#B3B3B3] font-mono">
                  {aiCenterData.fallbackChain}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Tools */}
        <Section id="tools" title="Herramientas">
          <div className="grid grid-cols-2 gap-2 px-3">
            {TOOLS.map(tool => (
              <motion.button
                key={tool.action}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleTool(tool.action)}
                title={tool.hint}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#171923] border border-white/[0.06] hover:border-purple-500/20 hover:bg-purple-500/5 transition-all"
              >
                <div className="p-2 rounded-lg" style={{ background: tool.color + '20', color: tool.color }}>
                  {tool.icon}
                </div>
                <span className="text-[10px] text-[#B3B3B3] text-center leading-tight">{tool.label}</span>
                <span className="text-[9px] text-[#B3B3B3]/40 text-center">{tool.hint}</span>
              </motion.button>
            ))}
          </div>
        </Section>

        {/* Voice controls */}
        {isSpeaking && (
          <Section id="voice" title="Control de voz">
            <div className="px-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500"
                    animate={{ width: `${voiceState.progress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <span className="text-[10px] text-[#B3B3B3] w-8 text-right">{voiceState.progress}%</span>
              </div>
              {voiceState.currentWord && (
                <p className="text-xs text-center text-purple-300 bg-purple-500/10 rounded-lg py-1">
                  "{voiceState.currentWord}"
                </p>
              )}
              <div className="flex justify-center gap-2">
                <button onClick={voiceState.isPaused ? resumeSpeaking : pauseSpeaking}
                  className="p-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-colors">
                  {voiceState.isPaused ? <Play size={14} /> : <Pause size={14} />}
                </button>
                <button onClick={stopSpeaking}
                  className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                  <Square size={14} />
                </button>
              </div>
            </div>
          </Section>
        )}

        {/* Files */}
        <Section id="files" title="Archivos adjuntos">
          <div className="px-3 space-y-2">
            {pendingFiles.length === 0 ? (
              <p className="text-xs text-[#B3B3B3]/50 py-2">Sin archivos adjuntos</p>
            ) : (
              pendingFiles.map(file => (
                <div key={file.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#171923] border border-white/[0.06]">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                    <FileText size={12} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{file.name}</p>
                    <p className="text-[10px] text-[#B3B3B3]">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Section>

        {/* Quick settings */}
        <Section id="settings" title="Configuración rápida">
          <div className="px-3 space-y-2">
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
              <div className="flex items-center gap-2 text-[#B3B3B3]">
                <Gauge size={13} />
                <span className="text-xs">Velocidad de voz</span>
              </div>
              <input
                type="range" min="0.5" max="2" step="0.1"
                value={settings.voice.rate}
                onChange={e => updateSettings({ voice: { ...settings.voice, rate: parseFloat(e.target.value) } })}
                className="w-20 accent-purple-500"
              />
            </div>
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
              <div className="flex items-center gap-2 text-[#B3B3B3]">
                <Languages size={13} />
                <span className="text-xs">Idioma</span>
              </div>
              <span className="text-xs text-white">{settings.language === 'es' ? 'Español' : 'English'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
              <div className="flex items-center gap-2 text-[#B3B3B3]">
                <Palette size={13} />
                <span className="text-xs">Tema</span>
              </div>
              <span className="text-xs text-white">{settings.theme === 'dark' ? 'Oscuro' : 'Claro'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
              <div className="flex items-center gap-2 text-[#B3B3B3]">
                <Type size={13} />
                <span className="text-xs">Tamaño letra</span>
              </div>
              <select
                value={settings.fontSize}
                onChange={e => updateSettings({ fontSize: e.target.value as typeof settings.fontSize })}
                className="text-xs text-white bg-[#171923] border border-white/[0.06] rounded px-1 py-0.5"
              >
                {FONT_SIZES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {/* Memory */}
        <Section id="memory" title="Memoria">
          <div className="px-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#B3B3B3]">
                <Brain size={13} />
                <span className="text-xs">Memorias guardadas</span>
              </div>
              <span className="text-xs text-white font-medium">{memory.length}</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((memory.length / 100) * 100, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        </Section>
      </div>
    </motion.aside>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#B3B3B3]">{label}</span>
      <span className="text-white font-medium text-right max-w-[55%] truncate" title={value}>{value}</span>
    </div>
  );
}
