'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Cpu, Download, Globe, Monitor, RefreshCw, Server, Smartphone, WifiOff } from 'lucide-react';
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
  const [ollamaReady, setOllamaReady] = useState<boolean | null>(null);

  useEffect(() => {
    setHardware(readHardware());
    getOfflineModelState().then(state => {
      setDownloaded(state.downloaded);
      setProgress(state.progress);
    });
    const handleInstallRequest = () => {
      if (hardware.webgpu) installBrowserModel();
    };
    window.addEventListener('yosseling-install-offline', handleInstallRequest);
    return () => window.removeEventListener('yosseling-install-offline', handleInstallRequest);
  }, [hardware.webgpu]);

  const recommendation = useMemo(() => {
    if (hardware.webgpu && hardware.device === 'PC') return 'WebGPU en navegador u Ollama para modelos más avanzados.';
    if (hardware.webgpu) return 'WebGPU con un modelo ligero para cuidar batería y memoria.';
    return 'Ollama en un PC es la opción recomendada para usar el modo local.';
  }, [hardware]);

  const update = (partial: Partial<OfflineConfig>) => {
    const next = saveOfflineConfig(partial);
    setConfig(next);
  };

  const installBrowserModel = async () => {
    setBusy(true);
    setMessage('');
    try {
      await downloadWebGPUModel(setProgress);
      setDownloaded(true);
      setMessage('Modelo local listo y almacenado en la caché del navegador.');
      setConfig(getOfflineConfig());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo descargar el modelo local.');
    } finally {
      setBusy(false);
    }
  };

  const testOllama = async () => {
    setBusy(true);
    try {
      const response = await fetch(`${config.ollamaUrl.replace(/\/$/, '')}/api/tags`);
      setOllamaReady(response.ok);
      if (response.ok) {
        update({ backend: 'ollama', configured: true });
        setMessage('Ollama está activo y listo para trabajar sin conexión.');
      } else setMessage('Ollama respondió, pero no está disponible en este momento.');
    } catch {
      setOllamaReady(false);
      setMessage('No pude conectar con Ollama. Comprueba que esté encendido y que el puerto sea correcto.');
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

      <div className="grid grid-cols-3 gap-2">
        <HardwareCard icon={hardware.device === 'PC' ? <Monitor size={14} /> : <Smartphone size={14} />} label="Equipo" value={hardware.device} />
        <HardwareCard icon={<Cpu size={14} />} label="Memoria" value={hardware.memory} />
        <HardwareCard icon={hardware.webgpu ? <Check size={14} /> : <WifiOff size={14} />} label="WebGPU" value={hardware.webgpu ? 'Disponible' : 'No detectado'} />
      </div>
      <p className="text-[11px] text-cyan-200/80">Recomendación: {recommendation}</p>

      <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3 space-y-3">
        <div className="flex items-center gap-2"><Globe size={14} className="text-cyan-300" /><span className="text-xs font-semibold text-white">Modelo en navegador</span></div>
        <p className="text-[11px] text-[#B3B3B3]">Descarga un modelo ligero de 1B en WebGPU. El navegador lo conserva para usarlo sin internet.</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-white/70 truncate">{config.webgpuModel}</span>
          <button disabled={busy || !hardware.webgpu} onClick={installBrowserModel} className="shrink-0 flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-2 text-[11px] text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40">
            <Download size={12} /> {downloaded ? 'Listo' : 'Descargar'}
          </button>
        </div>
        {(busy || progress > 0) && <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} /></div>}
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3 space-y-3">
        <div className="flex items-center gap-2"><Server size={14} className="text-amber-300" /><span className="text-xs font-semibold text-white">Ollama en PC</span></div>
        <p className="text-[11px] text-[#B3B3B3]">Instala Ollama en tu PC y descarga un modelo como <span className="text-white">qwen2.5:7b</span>. Después deja Ollama encendido.</p>
        <div className="flex gap-2">
          <input value={config.ollamaUrl} onChange={e => update({ ollamaUrl: e.target.value, configured: false })} className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/50" placeholder="http://localhost:11434" />
          <button disabled={busy} onClick={testOllama} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] text-white hover:bg-white/10 disabled:opacity-40"><RefreshCw size={12} /> Probar</button>
        </div>
        {ollamaReady && <p className="flex items-center gap-1 text-[11px] text-green-300"><Check size={12} /> Conectado</p>}
      </div>

      {message && <p className="text-[11px] text-white/80">{message}</p>}
      <div className="flex items-center gap-2 text-[10px] text-[#B3B3B3]/70"><WifiOff size={12} /> Al perder internet, Yosseling cambiará automáticamente al motor configurado.</div>
    </section>
  );
}

function HardwareCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-2"><div className="flex items-center gap-1 text-cyan-300">{icon}<span className="text-[10px] text-[#B3B3B3]">{label}</span></div><p className="mt-1 truncate text-[10px] text-white">{value}</p></div>;
}
