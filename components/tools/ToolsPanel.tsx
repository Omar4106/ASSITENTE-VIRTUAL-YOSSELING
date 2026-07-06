'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon, Edit, Eye, FileSearch, Volume2, Mic,
  Globe, Printer, FileText, ChevronDown,
  SlidersHorizontal, Gauge, Languages, Palette, Type,
  Brain, X
} from 'lucide-react';
import { useAppStore, useActiveChat } from '@/lib/store';
import { PROVIDERS } from '@/lib/ai-providers';
import { useVoice } from '@/hooks/useVoice';
import { cn } from '@/lib/utils';

const TOOLS = [
  { icon: <ImageIcon size={16} />, label: 'Generar imagen', action: 'generate_image', color: '#A855F7' },
  { icon: <Edit size={16} />, label: 'Editar imagen', action: 'edit_image', color: '#4F9DFF' },
  { icon: <Eye size={16} />, label: 'Analizar imagen', action: 'analyze_image', color: '#10B981' },
  { icon: <FileSearch size={16} />, label: 'OCR (Texto)', action: 'ocr', color: '#F59E0B' },
  { icon: <Volume2 size={16} />, label: 'Leer voz', action: 'read_voice', color: '#EC4899' },
  { icon: <Mic size={16} />, label: 'Reconocer voz', action: 'recognize_voice', color: '#8B5CF6' },
  { icon: <Printer size={16} />, label: 'Imprimir', action: 'print', color: '#6B7280' },
  { icon: <Globe size={16} />, label: 'Buscar en web', action: 'web_search', color: '#3B82F6' },
];

const FONT_SIZES = [
  { label: 'Pequeño', value: 'small' },
  { label: 'Mediano', value: 'medium' },
  { label: 'Grande', value: 'large' },
] as const;

export function ToolsPanel() {
  const {
    settings, updateSettings, memory, pendingFiles,
    sendMessage, isSpeaking, rightPanelOpen,
    setRightPanelOpen,
  } = useAppStore();
  const activeChat = useActiveChat();
  const { speak, stopSpeaking, startListening, stopListening, } = useVoice();
  const [activeSection, setActiveSection] = useState<string | null>('tools');

  const recentFiles = pendingFiles.slice(0, 5);
  const memoryUsed = memory.length;

  const handleTool = (action: string) => {
    const prompts: Record<string, string> = {
      generate_image: 'Genera una imagen de: ',
      edit_image: 'Edita la imagen con los siguientes cambios: ',
      analyze_image: 'Analiza esta imagen y describe lo que ves.',
      ocr: 'Extrae el texto de esta imagen usando OCR.',
      web_search: 'Busca en internet información sobre: ',
      print: '',
    };

    if (action === 'print') { window.print(); return; }
    if (action === 'read_voice') {
      const lastMsg = activeChat?.messages?.filter(m => m.role === 'assistant').pop();
      if (lastMsg) speak(lastMsg.content);
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
        <span className="text-xs font-semibold text-white uppercase tracking-wider">{title}</span>
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

  return (
    <motion.aside
      initial={false}
      animate={{ width: rightPanelOpen ? 280 : 0, opacity: rightPanelOpen ? 1 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="h-full bg-[#111218] border-l border-white/[0.06] overflow-hidden flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <span className="text-sm font-semibold text-white">Herramientas</span>
        <button onClick={() => setRightPanelOpen(false)} className="text-[#B3B3B3] hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Tools */}
        <Section id="tools" title="Herramientas">
          <div className="grid grid-cols-2 gap-2 px-3">
            {TOOLS.map(tool => (
              <motion.button
                key={tool.action}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleTool(tool.action)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#171923] border border-white/[0.06] hover:border-purple-500/20 hover:bg-purple-500/5 transition-all"
              >
                <div className="p-2 rounded-lg" style={{ background: tool.color + '20', color: tool.color }}>
                  {tool.icon}
                </div>
                <span className="text-[10px] text-[#B3B3B3] text-center leading-tight">{tool.label}</span>
              </motion.button>
            ))}
          </div>
        </Section>

        {/* Recent files */}
        <Section id="files" title="Archivos adjuntos">
          <div className="px-3 space-y-2">
            {recentFiles.length === 0 ? (
              <p className="text-xs text-[#B3B3B3]/50 px-1 py-2">Sin archivos adjuntos</p>
            ) : (
              recentFiles.map(file => (
                <div key={file.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#171923] border border-white/[0.06]">
                  <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                    <FileText size={12} className="text-red-400" />
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
            <SettingRow icon={<Volume2 size={13} />} label="Voz" value="Femenina" />
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
              <div className="flex items-center gap-2 text-[#B3B3B3]">
                <Gauge size={13} />
                <span className="text-xs">Velocidad</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.voice.rate}
                onChange={e => updateSettings({ voice: { ...settings.voice, rate: parseFloat(e.target.value) } })}
                className="w-20 accent-purple-500"
              />
            </div>
            <SettingRow icon={<Languages size={13} />} label="Idioma" value={settings.language === 'es' ? 'Español' : 'English'} />
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
              <div className="flex items-center gap-2 text-[#B3B3B3]">
                <Palette size={13} />
                <span className="text-xs">Tema</span>
              </div>
              <span className="text-xs text-white capitalize">{settings.theme === 'dark' ? 'Oscuro' : 'Claro'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
              <div className="flex items-center gap-2 text-[#B3B3B3]">
                <Type size={13} />
                <span className="text-xs">Tamaño de letra</span>
              </div>
              <select
                value={settings.fontSize}
                onChange={e => updateSettings({ fontSize: e.target.value as typeof settings.fontSize })}
                className="text-xs text-white bg-[#171923] border border-white/[0.06] rounded px-1 py-0.5"
              >
                {FONT_SIZES.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
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
              <span className="text-xs text-white font-medium">{memoryUsed}</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[#B3B3B3]">
                <span>Usando {memoryUsed * 0.1} MB / 100 MB</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((memoryUsed * 0.1), 100)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>
        </Section>
      </div>
    </motion.aside>
  );
}

function SettingRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
      <div className="flex items-center gap-2 text-[#B3B3B3]">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-xs text-white">{value}</span>
    </div>
  );
}
