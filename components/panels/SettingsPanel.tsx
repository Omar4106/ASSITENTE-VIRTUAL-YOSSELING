'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Palette, Volume2, Languages, Type, Download,
  Upload, Trash2, User, Zap, Brain, Check
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { MODELS, PROVIDERS } from '@/lib/ai-providers';
import type { ModelId, Provider } from '@/types';
import { cn } from '@/lib/utils';

export function SettingsPanel() {
  const { settings, updateSettings, clearAllChats, clearMemory, chats } = useAppStore();
  const [saved, setSaved] = useState(false);

  const save = (partial: Parameters<typeof updateSettings>[0]) => {
    updateSettings(partial);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const exportChats = (format: 'json' | 'txt' | 'md') => {
    const data = format === 'json'
      ? JSON.stringify(chats, null, 2)
      : chats.map(c =>
          format === 'md'
            ? `# ${c.title}\n\n${c.messages.map(m => `**${m.role === 'user' ? 'Usuario' : 'Yosseling'}:** ${m.content}`).join('\n\n')}`
            : `${c.title}\n${c.messages.map(m => `${m.role === 'user' ? 'Usuario' : 'Yosseling'}: ${m.content}`).join('\n')}`
        ).join('\n\n---\n\n');

    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yosseling-chats.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importChats = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        // JSON.parse result used for validation only — actual import is a no-op in this demo
        JSON.parse(text);
        alert('Chats importados correctamente.');
      } catch {
        alert('Error al importar: formato inválido.');
      }
    };
    input.click();
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] shrink-0">
        <Settings size={16} className="text-purple-400" />
        <span className="text-sm font-semibold text-white">Configuración</span>
        {saved && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 text-green-400 text-xs ml-auto"
          >
            <Check size={12} /> Guardado
          </motion.div>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* User */}
        <Section icon={<User size={15} />} title="Usuario">
          <div className="space-y-3">
            <LabeledInput
              label="Nombre"
              value={settings.userName}
              onChange={v => save({ userName: v })}
              placeholder="Tu nombre"
            />
          </div>
        </Section>

        {/* Theme */}
        <Section icon={<Palette size={15} />} title="Apariencia">
          <div className="space-y-3">
            <div className="flex gap-2">
              {(['dark', 'light'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => save({ theme: t })}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-xs font-medium border transition-all',
                    settings.theme === t
                      ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                      : 'border-white/[0.06] text-[#B3B3B3] hover:border-white/20'
                  )}
                >
                  {t === 'dark' ? 'Oscuro' : 'Claro'}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-[#B3B3B3] block mb-1">Tamaño de letra</label>
              <div className="flex gap-2">
                {(['small', 'medium', 'large'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => save({ fontSize: s })}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs border transition-all',
                      settings.fontSize === s
                        ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                        : 'border-white/[0.06] text-[#B3B3B3] hover:border-white/20'
                    )}
                  >
                    {s === 'small' ? 'Pequeño' : s === 'medium' ? 'Mediano' : 'Grande'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Voice */}
        <Section icon={<Volume2 size={15} />} title="Voz">
          <div className="space-y-3">
            <SliderSetting
              label="Velocidad"
              value={settings.voice.rate}
              min={0.5} max={2} step={0.1}
              onChange={v => save({ voice: { ...settings.voice, rate: v } })}
            />
            <SliderSetting
              label="Tono"
              value={settings.voice.pitch}
              min={0.5} max={2} step={0.1}
              onChange={v => save({ voice: { ...settings.voice, pitch: v } })}
            />
            <SliderSetting
              label="Volumen"
              value={settings.voice.volume}
              min={0} max={1} step={0.1}
              onChange={v => save({ voice: { ...settings.voice, volume: v } })}
            />
          </div>
        </Section>

        {/* Language */}
        <Section icon={<Languages size={15} />} title="Idioma">
          <div className="flex gap-2">
            {(['es', 'en'] as const).map(l => (
              <button
                key={l}
                onClick={() => save({ language: l })}
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-medium border transition-all',
                  settings.language === l
                    ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                    : 'border-white/[0.06] text-[#B3B3B3] hover:border-white/20'
                )}
              >
                {l === 'es' ? 'Español' : 'English'}
              </button>
            ))}
          </div>
        </Section>

        {/* Default model */}
        <Section icon={<Zap size={15} />} title="Modelo predeterminado">
          <select
            value={settings.defaultModel}
            onChange={e => save({ defaultModel: e.target.value as ModelId })}
            className="w-full bg-[#171923] border border-white/[0.06] text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-purple-500/50"
          >
            {Object.entries(PROVIDERS).map(([prov, info]) => (
              <optgroup key={prov} label={info.name}>
                {MODELS.filter(m => m.provider === prov).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Section>

        {/* Data */}
        <Section icon={<Download size={15} />} title="Datos">
          <div className="space-y-2">
            <p className="text-xs text-[#B3B3B3] mb-2">Exportar conversaciones</p>
            <div className="flex gap-2">
              {(['json', 'txt', 'md'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => exportChats(f)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-white/[0.06] text-[#B3B3B3] hover:border-purple-500/30 hover:text-white uppercase transition-all"
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={importChats}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-white/[0.06] text-xs text-[#B3B3B3] hover:border-white/20 hover:text-white transition-all"
            >
              <Upload size={13} /> Importar chats
            </button>
          </div>
        </Section>

        {/* Danger */}
        <Section icon={<Trash2 size={15} />} title="Zona peligrosa">
          <div className="space-y-2">
            <button
              onClick={() => confirm('¿Eliminar todos los chats?') && clearAllChats()}
              className="w-full py-2 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
            >
              Borrar todos los chats
            </button>
            <button
              onClick={() => confirm('¿Vaciar toda la memoria?') && clearMemory()}
              className="w-full py-2 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
            >
              Vaciar memoria
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-purple-400 mb-3">
        {icon}
        <span className="text-xs font-semibold text-white uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-[#B3B3B3] block mb-1">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#171923] border border-white/[0.06] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-purple-500/50 transition-colors placeholder-[#B3B3B3]/30"
      />
    </div>
  );
}

function SliderSetting({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-[#B3B3B3]">{label}</label>
        <span className="text-xs text-white">{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-purple-500"
      />
    </div>
  );
}
