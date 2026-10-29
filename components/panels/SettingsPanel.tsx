'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Palette, Volume2, Languages, Type, Download,
  Upload, Trash2, User, Zap, Brain, Check, Heart, Info, WifiOff, Camera, LogIn, LogOut,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { YOSSELING_IDENTITY } from '@/lib/personality';
import type { PersonalityStyle } from '@/types';
import { cn } from '@/lib/utils';
import { OfflineManager } from './OfflineManager';
import { createClient } from '@/lib/supabase/client';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export function SettingsPanel() {
  const { settings, updateSettings, clearAllChats, clearMemory, chats, selectedModel, importChats: storeImportChats } = useAppStore();
  const [saved, setSaved] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void createClient().auth.getUser().then(async ({ data }: { data: { user: { id: string; email?: string | null } | null } }) => {
      if (!active) return;
      setIsSignedIn(Boolean(data.user));
      if (!data.user) return;
      const { data: profile } = await createClient()
        .from('profiles')
        .select('name, nickname, avatar_url, animated_background')
        .eq('id', data.user.id)
        .maybeSingle();
      if (!active || !profile) return;
      updateSettings({
        userName: profile.name ?? settings.userName,
        userNickname: profile.nickname ?? settings.userNickname,
        userAvatar: profile.avatar_url ?? settings.userAvatar,
        animatedBackground: profile.animated_background ?? true,
      });
    }).catch((error: unknown) => console.error('[Yosseling] Profile load failed:', error));
    return () => { active = false; };
    // Mount-only profile hydration: changes are persisted through the separate settings effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const { data: subscription } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (active) setIsSignedIn(Boolean(session?.user));
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void createClient().auth.getUser().then(({ data }: { data: { user: { id: string; email?: string | null } | null } }) => {
        if (!data.user) return;
        return createClient().from('profiles').upsert({
          id: data.user.id,
          email: data.user.email,
          name: settings.userName,
          nickname: settings.userNickname || null,
          avatar_url: settings.userAvatar,
          animated_background: settings.animatedBackground,
        }, { onConflict: 'id' });
      }).catch((error: unknown) => console.error('[Yosseling] Profile save failed:', error));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [settings.userName, settings.userNickname, settings.userAvatar, settings.animatedBackground]);

  const save = (partial: Parameters<typeof updateSettings>[0]) => {
    updateSettings(partial);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      updateSettings({
        userName: 'Usuario',
        userNickname: '',
        userAvatar: null,
      });
      window.location.assign('/');
    } catch (error) {
      console.error('[Yosseling] Sign out failed:', error);
      alert(error instanceof Error ? error.message : 'No se pudo cerrar la sesión.');
      setIsSigningOut(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      alert('Usa una imagen PNG, JPEG o WebP de menos de 5 MB.');
      return;
    }
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Sesión no disponible');
      const extension = file.name.split('.').pop()?.toLowerCase().replace('jpeg', 'jpg') || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
        upsert: true,
        cacheControl: '3600',
        contentType: file.type,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      if (!data.publicUrl) throw new Error('No se pudo obtener la URL del avatar');
      save({ userAvatar: data.publicUrl });
    } catch (error) {
      console.error('[Yosseling] Avatar upload failed:', error);
      alert(error instanceof Error ? error.message : 'No se pudo subir el avatar.');
    } finally {
      e.target.value = '';
    }
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
    <div className="flex flex-col h-full overflow-y-auto max-h-[85vh]">
      <div className="flex items-center gap-2 px-4 py-3 pr-12 border-b border-white/[0.06] shrink-0">
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
        {/* User Profile */}
        <Section icon={<User size={15} />} title="Perfil de Usuario">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {settings.userAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.userAvatar} alt={settings.userName} className="w-16 h-16 rounded-full object-cover border-2 border-purple-500/30" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center border-2 border-purple-500/30">
                  <User size={24} className="text-white" />
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] text-xs text-[#B3B3B3] hover:border-purple-500/30 hover:text-white transition-all"
              >
                <Camera size={13} /> Cambiar avatar
              </button>
              {settings.userAvatar && (
                <button
                  onClick={() => save({ userAvatar: null })}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Quitar
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <LabeledInput
              label="Nombre"
              value={settings.userName}
              onChange={v => save({ userName: v })}
              placeholder="Tu nombre"
            />
            <LabeledInput
              label="Apodo preferido"
              value={settings.userNickname}
              onChange={v => save({ userNickname: v })}
              placeholder="Cómo quieres que te llame Yosseling"
            />
            <LabeledInput
              label="URL del avatar (opcional)"
              value={settings.userAvatar ?? ''}
              onChange={v => save({ userAvatar: v.trim() || null })}
              placeholder="https://..."
            />
          </div>
        </Section>

        <Section icon={isSignedIn ? <LogOut size={15} /> : <LogIn size={15} />} title="Cuenta">
          {isSignedIn ? (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-500/[0.06] py-2.5 text-xs font-medium text-red-300 transition-colors hover:border-red-400/40 hover:bg-red-500/10 disabled:opacity-60"
            >
              <LogOut size={14} />
              {isSigningOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => window.location.assign('/login?next=/')}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-purple-400/30 bg-purple-500/[0.08] py-2.5 text-xs font-medium text-purple-200 transition-colors hover:border-purple-400/50 hover:bg-purple-500/15"
            >
              <LogIn size={14} />
              Iniciar sesión o registrarse
            </button>
          )}
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
            <button
              type="button"
              onClick={() => save({ animatedBackground: !settings.animatedBackground })}
              className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-[#B3B3B3] transition-colors hover:border-purple-500/30"
            >
              <span>Fondo animado</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px]', settings.animatedBackground ? 'bg-purple-500/20 text-purple-300' : 'bg-white/10 text-white/60')}>
                {settings.animatedBackground ? 'Activado' : 'Desactivado'}
              </span>
            </button>
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

        {/* Adaptive profile info */}
        {settings.adaptiveProfile.interactionCount > 2 && (
          <Section icon={<Brain size={15} />} title="Adaptación Automática">
            <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-3 space-y-2">
              <p className="text-xs text-cyan-200">Yosseling está aprendiendo tus preferencias:</p>
              <InfoRow label="Interacciones" value={String(settings.adaptiveProfile.interactionCount)} />
              <InfoRow label="Estilo de respuesta" value={settings.adaptiveProfile.responseStyle} />
              <InfoRow label="Formalidad" value={settings.adaptiveProfile.languageFormality} />
              {settings.adaptiveProfile.frequentTopics.length > 0 && (
                <InfoRow label="Temas frecuentes" value={settings.adaptiveProfile.frequentTopics.slice(0, 4).join(', ')} />
              )}
            </div>
          </Section>
        )}

        {/* Runtime mode */}
        <Section icon={<Zap size={15} />} title="Modo de Ejecución">
          <div className="flex gap-2">
            <button
              onClick={() => save({ runtimeMode: 'cloud' })}
              className={cn(
                'flex-1 py-2 rounded-lg text-xs font-medium border transition-all',
                settings.runtimeMode !== 'local'
                  ? 'border-green-500 bg-green-500/10 text-green-300'
                  : 'border-white/[0.06] text-[#B3B3B3] hover:border-white/20'
              )}
            >
              Nube (Groq)
            </button>
            <button
              onClick={() => save({ runtimeMode: 'local' })}
              className={cn(
                'flex-1 py-2 rounded-lg text-xs font-medium border transition-all',
                settings.runtimeMode === 'local'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                  : 'border-white/[0.06] text-[#B3B3B3] hover:border-white/20'
              )}
            >
              Local (Ollama)
            </button>
          </div>
          <p className="text-[10px] text-[#B3B3B3]/70 mt-2">
            {settings.runtimeMode === 'local'
              ? 'Las peticiones se envían directamente a tu motor local sin pasar por la nube.'
              : 'Las peticiones se procesan en la nube con el modelo seleccionado.'}
          </p>
        </Section>

        {/* Offline mode */}
        <Section icon={<WifiOff size={15} />} title="Modo Offline">
          <OfflineManager />
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
            <p className="text-[10px] text-[#B3B3B3]/60 mt-2">
              Toda tu información se guarda exclusivamente en este dispositivo. No se envía nada a ningún servidor.
            </p>
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
              <InfoRow label="Modo activo" value="Yosseling" />
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
