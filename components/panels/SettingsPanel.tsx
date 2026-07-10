'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Palette, Volume2, Languages, Type, Download,
  Upload, Trash2, User, Zap, Brain, Check, Heart, Info,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { MODELS, PROVIDERS, PROVIDER_ORDER } from '@/lib/ai-providers';
import { YOSSELING_IDENTITY } from '@/lib/personality';
import type { PersonalityStyle } from '@/types';
import { cn } from '@/lib/utils';

export function SettingsPanel() {
  const { settings, updateSettings, clearAllChats, clearMemory, chats, selectedProvider, selectedModel, importChats: storeImportChats } = useAppStore();
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
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('Invalid format');
        await storeImportChats(data);
        alert(`Importadas ${data.length} conversaciones correctamente.`);
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

        {/* Personality */}
        <Section icon={<Heart size={15} />} title="Personalidad de Yosseling">
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: 'profesional', label: 'Profesional' },
              { id: 'amigable',    label: 'Amigable' },
              { id: 'creativa',    label: 'Creativa' },
              { id: 'tecnica',     label: 'Técnica' },
              { id: 'divertida',   label: 'Divertida' },
              { id: 'formal',      label: 'Formal' },
            ] as { id: PersonalityStyle; label: string }[]).map(p => (
              <button
                key={p.id}
                onClick={() => save({ personality: p.id })}
                className={cn(
                  'py-2 rounded-lg text-xs font-medium border transition-all',
                  settings.personality === p.id
                    ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                    : 'border-white/[0.06] text-[#B3B3B3] hover:border-white/20'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Default model */}
        <Section icon={<Zap size={15} />} title="Modelo predeterminado">
          <select
            value={settings.defaultModel}
            onChange={e => save({ defaultModel: e.target.value })}
            className="w-full bg-[#171923] border border-white/[0.06] text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-purple-500/50"
          >
            {PROVIDER_ORDER.filter(p => p !== 'auto').map(prov => (
              <optgroup key={prov} label={PROVIDERS[prov].name}>
                {MODELS.filter(m => m.provider === prov).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Section>

        {/* Memory settings */}
        <Section icon={<Brain size={15} />} title="Memoria">
          <div className="space-y-2">
            <label className="flex items-center justify-between cursor-pointer py-1">
              <span className="text-xs text-[#B3B3B3]">Memoria activada</span>
              <input type="checkbox" checked={settings.memoryEnabled} onChange={e => save({ memoryEnabled: e.target.checked })} className="accent-purple-500 w-4 h-4" />
            </label>
            <label className="flex items-center justify-between cursor-pointer py-1">
              <span className="text-xs text-[#B3B3B3]">Detección automática</span>
              <input type="checkbox" checked={settings.memoryAutoSave} onChange={e => save({ memoryAutoSave: e.target.checked })} className="accent-purple-500 w-4 h-4" />
            </label>
          </div>
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

        {/* Acerca de Yosseling */}
        <Section icon={<Info size={15} />} title="Acerca de Yosseling">
          <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Heart size={14} className="text-pink-400" />
              <span className="text-sm font-bold text-white">{YOSSELING_IDENTITY.name}</span>
              <span className="ml-auto text-[10px] text-[#B3B3B3] bg-white/5 px-2 py-0.5 rounded-full">v{YOSSELING_IDENTITY.version}</span>
            </div>
            <InfoRow label="Nombre" value={YOSSELING_IDENTITY.name} />
            <InfoRow label="Versión" value={YOSSELING_IDENTITY.version} />
            <InfoRow label="Creado por" value={YOSSELING_IDENTITY.creator} />
            <InfoRow label="Fecha" value={YOSSELING_IDENTITY.createdAt} />
            <div className="pt-2 border-t border-white/[0.06]">
              <InfoRow label="Proveedor activo" value={PROVIDERS[selectedProvider]?.name ?? selectedProvider} />
              <InfoRow label="Modelo activo" value={selectedModel} />
              <InfoRow label="Personalidad" value={settings.personality} />
            </div>
            <p className="text-[10px] text-[#B3B3B3]/60 pt-1 italic">{YOSSELING_IDENTITY.nameOrigin}</p>
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
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-purple-500"
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-[#B3B3B3]">{label}</span>
      <span className="text-white font-medium text-right max-w-[55%] truncate">{value}</span>
    </div>
  );
}
