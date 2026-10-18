'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Cpu, Download, Globe, Monitor, RefreshCw, Server, Smartphone, WifiOff, TriangleAlert as AlertTriangle, ChevronDown, Info, Cloud } from 'lucide-react';
import {
  downloadWebGPUModel,
  getOfflineConfig,
  getOfflineModelState,
  saveOfflineConfig,
  type OfflineConfig,
} from '@/lib/yosseling-engine';

interface HardwareInfo {
  device: 'Móvil' | 'PC';
  memory: string;
  webgpu: boolean;
}

function readHardware(): HardwareInfo {
  if (typeof navigator === 'undefined') return { device: 'PC', memory: 'No disponible', webgpu: false };
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const memory = typeof deviceMemory === 'number'
    ? `${deviceMemory} GB estimados`
    : 'No disponible';
  return { device: mobile ? 'Móvil' : 'PC', memory, webgpu: 'gpu' in navigator };
}

export function OfflineManager() {
  const [config, setConfig] = useState<OfflineConfig>(getOfflineConfig);
  const [hardware, setHardware] = useState<HardwareInfo>({ device: 'PC', memory: 'No disponible', webgpu: false });
  const [downloaded, setDownloaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');
  const [ollamaReady, setOllamaReady] = useState<boolean | null>(null);
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);
  const [corsHelpOpen, setCorsHelpOpen] = useState(false);
  const isMobile = hardware.device === 'Móvil';
  const targetsLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(config.ollamaUrl);

  useEffect(() => {
    try {
      const hw = readHardware();
      setHardware(hw);
      if (hw.device === 'Móvil' && !hw.webgpu) {
        setOfflineUnavailable(true);
        setMessageType('info');
        setMessage('Modo Nube Activo. Yosseling funciona con conexión a internet en este dispositivo.');
      }
    } catch {
      // Don't mark unavailable on error — let the user try.
    }

    getOfflineModelState()
      .then(state => {
        setDownloaded(state.downloaded);
        setProgress(state.progress);
      })
      .catch(() => {
        // Don't mark unavailable on error.
      });

    const handleInstallRequest = () => {
      if (hardware.webgpu) {
        installBrowserModel().catch(() => {
          setMessageType('info');
          setMessage('No se pudo instalar el motor offline. Puedes seguir chateando con conexión a internet.');
        });
      } else if (hardware.device === 'PC') {
        setMessageType('info');
        setMessage('Tu PC no tiene WebGPU. Configura el Motor local en PC (Ollama) para usar el modo sin conexión.');
      } else {
        setMessageType('info');
        setMessage('Modo Nube Activo. Yosseling funciona con conexión a internet en este dispositivo.');
        setOfflineUnavailable(true);
      }
    };
    window.addEventListener('yosseling-install-offline', handleInstallRequest);
    return () => window.removeEventListener('yosseling-install-offline', handleInstallRequest);
  }, [hardware.webgpu]);

  const recommendation = useMemo(() => {
    if (offlineUnavailable) return 'Este dispositivo no admite modo offline. Usa Yosseling con conexión a internet.';
    if (hardware.webgpu && hardware.device === 'PC') return 'Motor en navegador o motor local en PC para respuestas más avanzadas.';
    if (hardware.webgpu) return 'Motor ligero en navegador para cuidar batería y memoria.';
    return 'Motor local en PC es la opción recomendada para usar el modo sin conexión.';
  }, [hardware, offlineUnavailable]);

  const update = (partial: Partial<OfflineConfig>) => {
    try {
      const next = saveOfflineConfig(partial);
      setConfig(next);
    } catch {
      // ignore storage errors silently
    }
  };

  const installBrowserModel = async () => {
    if (!hardware.webgpu) {
      setMessageType('info');
      setMessage(hardware.device === 'PC'
        ? 'Tu PC no tiene WebGPU. Configura el Motor local en PC (Ollama) para usar el modo sin conexión.'
        : 'Modo Nube Activo. Yosseling funciona con conexión a internet en este dispositivo.');
      if (hardware.device !== 'PC') setOfflineUnavailable(true);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await downloadWebGPUModel(setProgress);
      setDownloaded(true);
      setMessageType('success');
      setMessage('Motor offline de Yosseling listo y almacenado en la caché del navegador.');
      setConfig(getOfflineConfig());
    } catch {
      setMessageType('info');
      setMessage('No se pudo instalar el motor offline. Puedes seguir chateando con conexión a internet.');
    } finally {
      setBusy(false);
    }
  };

  const testOllama = async () => {
    if (isMobile && targetsLocalhost) {
      setOllamaReady(false);
      setCorsHelpOpen(false);
      setMessageType('info');
      setMessage('Modo Nube Activo. El motor local de PC no es accesible desde el celular. Conéctate a internet para usar Yosseling en la nube.');
      return;
    }
    setBusy(true);
    setCorsHelpOpen(false);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${config.ollamaUrl.replace(/\/$/, '')}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setOllamaReady(response.ok);
      if (response.ok) {
        update({ backend: 'ollama', configured: true });
        setMessageType('success');
        setMessage('Motor local activo y listo para trabajar sin conexión.');
      } else {
        setMessageType('info');
        setMessage('El motor local no está disponible. Modo Nube Activo — puedes seguir chateando con conexión a internet.');
      }
    } catch {
      setOllamaReady(false);
      setMessageType('info');
      setMessage('Modo Nube Activo. El motor local no respondió. Puedes seguir chateando con conexión a internet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300"><Cpu size={17} /></div>
        <div>
          <h3 className="text-sm font-semibold text-white">Gestor de Modo Offline</h3>
          <p className="text-[11px] text-[#B3B3B3] mt-1">Yosseling conserva su personalidad y memoria; el modelo local solo procesa la respuesta.</p>
        </div>
      </div>

      {offlineUnavailable && (
        <div className="flex items-start gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2.5">
          <Cloud size={14} className="text-cyan-300 shrink-0 mt-0.5" />
          <p className="text-[11px] text-cyan-200">Modo Nube Activo. Yosseling funciona con conexión a internet en este dispositivo.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <HardwareCard icon={hardware.device === 'PC' ? <Monitor size={14} /> : <Smartphone size={14} />} label="Equipo" value={hardware.device} />
        <HardwareCard icon={<Cpu size={14} />} label="Memoria" value={hardware.memory} />
        <HardwareCard icon={hardware.webgpu ? <Check size={14} /> : <WifiOff size={14} />} label="Aceleración" value={hardware.webgpu ? 'Disponible' : 'No detectado'} />
      </div>
      <p className="text-[11px] text-cyan-200/80">Recomendación: {recommendation}</p>

      <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3 space-y-3">
        <div className="flex items-center gap-2"><Globe size={14} className="text-cyan-300" /><span className="text-xs font-semibold text-white">Motor en navegador</span></div>
        <p className="text-[11px] text-[#B3B3B3]">Descarga el motor offline de Yosseling en el navegador. Se conserva para usarlo sin internet.</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-white/70 truncate">Motor offline de Yosseling</span>
          <button disabled={busy || !hardware.webgpu} onClick={installBrowserModel} className="shrink-0 flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-2 text-[11px] text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40">
            <Download size={12} /> {downloaded ? 'Listo' : 'Descargar'}
          </button>
        </div>
        {(busy || progress > 0) && <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} /></div>}
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3 space-y-3">
        <div className="flex items-center gap-2"><Server size={14} className="text-amber-300" /><span className="text-xs font-semibold text-white">Motor local en PC</span></div>
        <p className="text-[11px] text-[#B3B3B3]">Instala un motor local en tu PC y configúralo. Después déjalo encendido para que Yosseling pueda usarlo sin conexión.</p>
        {isMobile ? (
          <p className="text-[11px] text-amber-200/80">El motor local no es accesible desde un dispositivo móvil. Configura la IP de tu PC o usa Yosseling con conexión a internet.</p>
        ) : (
        <div className="flex gap-2">
          <input value={config.ollamaUrl} onChange={e => update({ ollamaUrl: e.target.value, configured: false })} className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/50" placeholder="http://localhost:11434" />
          <button disabled={busy} onClick={testOllama} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] text-white hover:bg-white/10 disabled:opacity-40"><RefreshCw size={12} /> Probar</button>
        </div>
        )}
        {ollamaReady && <p className="flex items-center gap-1 text-[11px] text-green-300"><Check size={12} /> Conectado</p>}
        {ollamaReady === false && !isMobile && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06]">
            <button
              onClick={() => setCorsHelpOpen(v => !v)}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] text-amber-200 hover:bg-amber-500/10 transition-colors"
            >
              <Info size={12} className="shrink-0" />
              <span>Asegúrate de configurar OLLAMA_ORIGINS='*' en las variables de entorno de tu PC para permitir conexiones locales.</span>
              <ChevronDown size={12} className={`shrink-0 ml-auto transition-transform ${corsHelpOpen ? 'rotate-180' : ''}`} />
            </button>
            {corsHelpOpen && (
              <div className="px-3 pb-3 pt-1 text-[10px] leading-relaxed text-amber-200/80 space-y-1.5">
                <p>1. Abre una terminal o el panel de variables de entorno de tu PC.</p>
                <p>2. Añade la variable: <code className="rounded bg-black/30 px-1 text-amber-100">OLLAMA_ORIGINS=*</code></p>
                <p>3. Reinicia el servicio de Ollama para que aplique el cambio.</p>
                <p>4. Vuelve a pulsar «Probar» para verificar la conexión.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {message && (
        <div className={
          messageType === 'error' ? 'flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200'
          : messageType === 'success' ? 'flex items-start gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-[11px] text-green-200'
          : 'text-[11px] text-white/80'
        }>
          {messageType !== 'info' && <Check size={12} className="shrink-0 mt-0.5" />}
          <span>{message}</span>
        </div>
      )}
      <div className="flex items-center gap-2 text-[10px] text-[#B3B3B3]/70"><WifiOff size={12} /> Al perder internet, Yosseling cambiará automáticamente al Modo Sin Conexión si está disponible.</div>
    </section>
  );
}

function HardwareCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-2"><div className="flex items-center gap-1 text-cyan-300">{icon}<span className="text-[10px] text-[#B3B3B3]">{label}</span></div><p className="mt-1 truncate text-[10px] text-white">{value}</p></div>;
}