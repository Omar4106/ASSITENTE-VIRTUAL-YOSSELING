'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Gauge, Languages, Palette, Type, Brain, X, Zap, Activity, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, ArrowRight, Square, Play, Pause, Search, Scan, Sparkles, Globe, ChartBar as FileBarChart, ScrollText, Cpu, Clock, Hash, DollarSign, FileText } from 'lucide-react';
import { useAppStore, useActiveChat } from '@/lib/store';
import { PROVIDERS } from '@/lib/ai-providers';
import { useVoice } from '@/hooks/useVoice';
import { cn } from '@/lib/utils';

const QUICK_TOOLS = [
  { icon: <Scan size={18} />,           label: 'OCR',           action: 'ocr',           color: '#F59E0B' },
  { icon: <Languages size={18} />,      label: 'Traductor',     action: 'translate',     color: '#60A5FA' },
  { icon: <Sparkles size={18} />,       label: 'Generador',     action: 'generate_image', color: '#A855F7' },
  { icon: <Globe size={18} />,          label: 'Investigador',  action: 'web_search',     color: '#34D399' },
  { icon: <FileBarChart size={18} />,   label: 'Analizador',    action: 'analyze_image',  color: '#FF5FD7' },
  { icon: <ScrollText size={18} />,     label: 'Resumidor',     action: 'summarize',      color: '#C084FC' },
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
  const { speak, stopSpeaking, pauseSpeaking, resumeSpeaking, startListening, voiceState } = useVoice();
  const [activeSection, setActiveSection] = useState<string | null>('ai-center');
  const [search, setSearch] = useState('');

  const handleTool = (action: string) => {
    const prompts: Record<string, string> = {
      analyze_image: 'Analiza esta imagen y describe detalladamente lo que ves, incluyendo texto, objetos y contexto.',
      ocr:           'Extrae todo el texto visible en esta imagen usando OCR.',
      translate:     'Traduce el siguiente texto: ',
      web_search:    'Busca en internet información actualizada sobre: ',
      generate_image:'Crea una imagen de: ',
      summarize:     'Resume el siguiente texto de forma concisa: ',
    };
    if (action === 'print') { window.print(); return; }
    if (action === 'read_voice') {
      const last = activeChat?.messages?.filter(m => m.role === 'assistant').pop();
      if (last) speak(last.content);
      return;
    }
    if (action === 'recognize_voice') {
      if (isSpeaking) stopSpeaking();
      startListening(text => sendMessage(text));
      return;
    }
    const prompt = prompts[action];
    if (prompt !== undefined) sendMessage(prompt);
  };

  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div className="border-b border-white/[0.04]">
      <button
        onClick={() => setActiveSection(activeSection === id ? null : id)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-[10px] font-semibold text-[#BDB7CC]/60 uppercase tracking-wider">{title}</span>
        <ChevronDown size={13} className={cn('text-[#BDB7CC]/50 transition-transform', activeSection === id && 'rotate-180')} />
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
      animate={{ width: rightPanelOpen ? 320 : 0, opacity: rightPanelOpen ? 1 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="h-full overflow-hidden flex flex-col shrink-0"
      style={{
        background: 'rgba(18, 9, 31, 0.72)',
        backdropFilter: 'blur(28px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.04] shrink-0">
        <span className="text-sm font-semibold text-white">Panel Inteligente</span>
        <button onClick={() => setRightPanelOpen(false)} className="text-[#BDB7CC] hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BDB7CC]/40" />
          <input
            type="text"
            placeholder="Buscar en panel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full glass-card rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#BDB7CC]/30 outline-none focus:border-purple-500/20 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── AI Center Card ── */}
        <Section id="ai-center" title="Centro IA">
          <div className="px-4 space-y-2.5">
            {/* Status badge */}
            <div
              className="flex items-center gap-2 p-2.5 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(255, 95, 215, 0.05) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.12)',
              }}
            >
              {!aiCenterData || aiCenterData.status === 'idle' ? (
                <Zap size={14} className="text-[#BDB7CC]" />
              ) : aiCenterData.status === 'streaming' ? (
                <Activity size={14} className="text-purple-400 animate-pulse" />
              ) : aiCenterData.status === 'success' ? (
                <CheckCircle2 size={14} className="text-green-400" />
              ) : (
                <AlertCircle size={14} className="text-red-400" />
              )}
              <span className="text-xs font-semibold text-white">
                {!aiCenterData || aiCenterData.status === 'idle' ? 'Inactivo' :
                 aiCenterData.status === 'streaming' ? 'Generando...' :
                 aiCenterData.status === 'success' ? 'Completado' : 'Error'}
              </span>
              {aiCenterData?.fallbackUsed && (
                <span className="ml-auto text-[9px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded-full font-medium">Fallback</span>
              )}
            </div>

            <DataRow icon={<Cpu size={11} />}     label="Proveedor activo"  value={aiCenterData ? providerName(aiCenterData.activeProvider) : providerName(selectedProvider)} />
            <DataRow icon={<Cpu size={11} />}     label="Modelo"             value={aiCenterData?.activeModel ?? selectedModel} />
            <DataRow icon={<Activity size={11} />} label="Estado"            value={aiCenterData?.status ?? 'idle'} />
            <DataRow icon={<Clock size={11} />}    label="Latencia"          value={aiCenterData ? `${aiCenterData.latency}ms` : '—'} />
            <DataRow icon={<Hash size={11} />}     label="Tokens"            value={aiCenterData ? String(aiCenterData.tokens) : '0'} />
            <DataRow icon={<DollarSign size={11} />} label="Costo aprox."     value={aiCenterData ? `$${aiCenterData.costEstimate.toFixed(6)}` : '$0'} />

            {/* Fallback details */}
            {aiCenterData?.fallbackUsed && (
              <div className="p-2.5 rounded-xl space-y-1.5" style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                <div className="flex items-center gap-1.5 text-[10px] text-yellow-400 font-semibold">
                  <ArrowRight size={11} /> Último fallback
                </div>
                <div className="text-[10px] text-[#BDB7CC]/70">
                  {aiCenterData.discardedProviders.map(providerName).join(' → ')} → {providerName(aiCenterData.providerUsed ?? '')}
                </div>
                <div className="text-[9px] text-[#BDB7CC]/50 font-mono break-all">{aiCenterData.fallbackChain}</div>
              </div>
            )}
          </div>
        </Section>

        {/* ── Quick Tools ── */}
        <Section id="tools" title="Herramientas rápidas">
          <div className="grid grid-cols-2 gap-2.5 px-4">
            {QUICK_TOOLS.map(tool => (
              <motion.button
                key={tool.action}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleTool(tool.action)}
                className="glass-card rounded-2xl p-3.5 flex flex-col items-center gap-2 text-center group"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <div
                  className="p-2.5 rounded-xl transition-all group-hover:scale-110"
                  style={{
                    background: tool.color + '20',
                    color: tool.color,
                    boxShadow: `0 0 16px ${tool.color}30`,
                  }}
                >
                  {tool.icon}
                </div>
                <span className="text-[11px] font-medium text-white/90">{tool.label}</span>
              </motion.button>
            ))}
          </div>
        </Section>

        {/* ── Voice Controls ── */}
        {isSpeaking && (
          <Section id="voice" title="Control de voz">
            <div className="px-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #A855F7, #FF5FD7)' }}
                    animate={{ width: `${voiceState.progress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <span className="text-[10px] text-[#BDB7CC] w-8 text-right">{voiceState.progress}%</span>
              </div>
              {voiceState.currentWord && (
                <p className="text-xs text-center text-purple-300 bg-purple-500/10 rounded-lg py-1.5 px-2">
                  &ldquo;{voiceState.currentWord}&rdquo;
                </p>
              )}
              <div className="flex justify-center gap-2">
                <button onClick={voiceState.isPaused ? resumeSpeaking : pauseSpeaking}
                  className="p-2 rounded-xl glass-card text-white hover:scale-105 transition-all">
                  {voiceState.isPaused ? <Play size={14} /> : <Pause size={14} />}
                </button>
                <button onClick={stopSpeaking}
                  className="p-2 rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-all border border-red-500/20">
                  <Square size={14} />
                </button>
              </div>
            </div>
          </Section>
        )}

        {/* ── Files ── */}
        <Section id="files" title="Archivos adjuntos">
          <div className="px-4 space-y-2">
            {pendingFiles.length === 0 ? (
              <p className="text-xs text-[#BDB7CC]/40 py-2 text-center">Sin archivos adjuntos</p>
            ) : (
              pendingFiles.map(file => (
                <div key={file.id} className="flex items-center gap-2 p-2 glass-card rounded-xl">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                    <FileText size={12} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{file.name}</p>
                    <p className="text-[10px] text-[#BDB7CC]/50">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Section>

        {/* ── Quick Settings ── */}
        <Section id="settings" title="Configuración rápida">
          <div className="px-4 space-y-2">
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-[#BDB7CC]">
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
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-[#BDB7CC]">
                <Languages size={13} />
                <span className="text-xs">Idioma</span>
              </div>
              <span className="text-xs text-white">{settings.language === 'es' ? 'Español' : 'English'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-[#BDB7CC]">
                <Palette size={13} />
                <span className="text-xs">Tema</span>
              </div>
              <span className="text-xs text-white">{settings.theme === 'dark' ? 'Oscuro' : 'Claro'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-[#BDB7CC]">
                <Type size={13} />
                <span className="text-xs">Tamaño letra</span>
              </div>
              <select
                value={settings.fontSize}
                onChange={e => updateSettings({ fontSize: e.target.value as typeof settings.fontSize })}
                className="text-xs text-white bg-[#1A1030] border border-white/[0.06] rounded-lg px-2 py-1 outline-none"
              >
                {FONT_SIZES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {/* ── Memory ── */}
        <Section id="memory" title="Memoria">
          <div className="px-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#BDB7CC]">
                <Brain size={13} />
                <span className="text-xs">Memorias guardadas</span>
              </div>
              <span className="text-xs text-white font-medium">{memory.length}</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #A855F7, #FF5FD7)' }}
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

function DataRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5 text-[#BDB7CC]/70">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-medium text-right max-w-[55%] truncate text-white" title={value}>{value}</span>
    </div>
  );
}
