'use client';

import { useEffect, useState } from 'react';
import { Check, RefreshCw, Server, Info, Cloud, ChevronDown } from 'lucide-react';
import { getOfflineConfig, saveOfflineConfig, type OfflineConfig } from '@/lib/yosseling-engine';

export function OfflineManager() {
  const [config, setConfig] = useState<OfflineConfig>(getOfflineConfig);
  const [busy, setBusy] = useState(false);
  const [ollamaReady, setOllamaReady] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');
  const [corsHelpOpen, setCorsHelpOpen] = useState(false);

  useEffect(() => {
    const stored = getOfflineConfig();
    if (stored.ollamaUrl && stored.ollamaUrl !== config.ollamaUrl) {
      setConfig(stored);
    }
  }, []);

  const update = (partial: Partial<OfflineConfig>) => {
    try {
      const next = saveOfflineConfig(partial);
      setConfig(next);
    } catch { /* ignore */ }
  };

  const testOllama = async () => {
    setBusy(true);
    setCorsHelpOpen(false);
    setMessage('');
    try {
      const url = config.ollamaUrl.replace(/\/$/, '');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(`${url}/api/tags`, { mode: 'cors', signal: controller.signal });
      clearTimeout(timeout);
      setOllamaReady(response.ok);
      if (response.ok) {
        update({ backend: 'ollama', configured: true });
        setMessageType('success');
        setMessage('Motor local activo y listo para trabajar sin conexión.');
      } else {
        setOllamaReady(false);
        setMessageType('info');
        setMessage('El motor local no respondió correctamente. Modo Nube activo.');
      }
    } catch {
      setOllamaReady(false);
      setMessageType('info');
      setMessage('Modo Nube activo. El motor local no respondió. Puedes seguir chateando con conexión a internet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300"><Server size={17} /></div>
        <div>
          <h3 className="text-sm font-semibold text-white">Gestor de Modo Offline</h3>
          <p className="text-[11px] text-[#B3B3B3] mt-1">Conecta Yosseling a tu motor local Ollama para usarlo sin conexión a internet.</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3 space-y-3">
        <div className="flex items-center gap-2"><Server size={14} className="text-amber-300" /><span className="text-xs font-semibold text-white">Motor local (Ollama)</span></div>
        <p className="text-[11px] text-[#B3B3B3]">Instala Ollama en tu PC, enciéndelo y configura la dirección aquí. Yosseling se conectará directamente para funcionar sin internet.</p>
        <div className="space-y-2">
          <label className="text-[10px] text-white/60">Dirección de Ollama</label>
          <div className="flex gap-2">
            <input
              value={config.ollamaUrl}
              onChange={e => { update({ ollamaUrl: e.target.value, configured: false }); setOllamaReady(null); }}
              className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/50"
              placeholder="http://localhost:11434"
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
            />
            <button disabled={busy} onClick={testOllama} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] text-white hover:bg-white/10 disabled:opacity-40">
              <RefreshCw size={12} className={busy ? 'animate-spin' : ''} /> Probar
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-white/60">Modelo de Ollama</label>
          <input
            value={config.ollamaModel}
            onChange={e => update({ ollamaModel: e.target.value })}
            className="w-full rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/50"
            placeholder="qwen2.5:7b"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        {ollamaReady && <p className="flex items-center gap-1 text-[11px] text-green-300"><Check size={12} /> Conectado a Ollama</p>}
        {ollamaReady === false && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06]">
            <button
              onClick={() => setCorsHelpOpen(v => !v)}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] text-amber-200 hover:bg-amber-500/10 transition-colors"
            >
              <Info size={12} className="shrink-0" />
              <span>Asegúrate de configurar OLLAMA_ORIGINS='*' en tu PC para permitir conexiones locales.</span>
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
          : 'flex items-start gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-2 text-[11px] text-cyan-200'
        }>
          {messageType === 'success' && <Check size={12} className="shrink-0 mt-0.5" />}
          {messageType === 'info' && <Cloud size={12} className="shrink-0 mt-0.5" />}
          <span>{message}</span>
        </div>
      )}
      <div className="flex items-center gap-2 text-[10px] text-[#B3B3B3]/70"><Cloud size={12} /> Al perder internet, Yosseling cambiará automáticamente a Ollama si está configurado.</div>
    </section>
  );
}