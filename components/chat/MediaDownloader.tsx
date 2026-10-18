'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Music, Video, Loader as Loader2, CircleAlert as AlertCircle, ExternalLink, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

interface MediaDownloaderProps {
  url: string;
}

type DownloadState = 'idle' | 'loading-mp4' | 'loading-mp3' | 'loading-analysis' | 'ready-mp4' | 'ready-mp3' | 'error';

interface ExtractedMedia {
  url: string;
  filename: string;
  format: 'mp4' | 'mp3';
}

export function MediaDownloader({ url }: MediaDownloaderProps) {
  const [state, setState] = useState<DownloadState>('idle');
  const [media, setMedia] = useState<ExtractedMedia | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const { sendMessage, activeChatId } = useAppStore();

  const handleAnalyze = useCallback(async () => {
    setState('loading-analysis');
    setErrorMsg('');

    try {
      const res = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json() as { analysis?: string; error?: string };

      if (!res.ok || !data.analysis) {
        setErrorMsg(data.error ?? 'No pude procesar este enlace. Asegúrate de que la publicación sea pública e inténtalo de nuevo.');
        setState('error');
        return;
      }

      setState('idle');

      if (activeChatId && sendMessage) {
        await sendMessage(`Analiza este video: ${url}\n\nResultado del análisis:\n${data.analysis}`);
      }
    } catch {
      setErrorMsg('No pude procesar este enlace. Asegúrate de que la publicación sea pública e inténtalo de nuevo.');
      setState('error');
    }
  }, [url, activeChatId, sendMessage]);

  const handleExtract = useCallback(async (format: 'mp4' | 'mp3') => {
    setState(format === 'mp4' ? 'loading-mp4' : 'loading-mp3');
    setErrorMsg('');
    setMedia(null);

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format }),
      });

      const data = await res.json() as { url?: string; filename?: string; error?: string };

      if (!res.ok || !data.url) {
        setErrorMsg(data.error ?? 'No pude procesar este enlace. Asegúrate de que la publicación sea pública e inténtalo de nuevo.');
        setState('error');
        return;
      }

      setMedia({ url: data.url, filename: data.filename ?? `yosseling_${format}_${Date.now()}`, format });
      setState(format === 'mp4' ? 'ready-mp4' : 'ready-mp3');

      const a = document.createElement('a');
      a.href = data.url;
      a.download = data.filename ?? '';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setErrorMsg('No pude procesar este enlace. Asegúrate de que la publicación sea pública e inténtalo de nuevo.');
      setState('error');
    }
  }, [url]);

  const isLoading = state === 'loading-mp4' || state === 'loading-mp3' || state === 'loading-analysis';

  return (
    <div className="my-3 rounded-xl border border-purple-500/20 bg-black/30 overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-[11px] font-medium text-green-300">Enlace de medios detectado</span>
        </div>
        <span className="ml-auto text-[10px] text-[#B3B3B3]/60 truncate max-w-[140px]">{url.replace(/^https?:\/\/(www\.)?/, '')}</span>
      </div>

      <div className="p-3 space-y-3">
        <AnimatePresence>
          {media && media.format === 'mp4' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-lg border border-white/10"
            >
              <video src={media.url} controls className="w-full max-h-[360px] bg-black" preload="metadata" />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {media && media.format === 'mp3' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg border border-white/10 bg-white/5 p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <Music size={14} className="text-purple-300" />
                <span className="text-xs text-white/80 truncate">{media.filename}</span>
              </div>
              <audio src={media.url} controls className="w-full" preload="metadata" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleExtract('mp4')}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all',
              'bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/40 text-orange-200',
              'hover:from-orange-500/30 hover:to-orange-600/20 hover:border-orange-400/60',
              isLoading && state === 'loading-mp4' && 'opacity-60 cursor-wait',
              isLoading && state !== 'loading-mp4' && 'opacity-40 cursor-not-allowed',
            )}
          >
            {state === 'loading-mp4' ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
            Descargar Video (MP4)
          </button>

          <button
            onClick={() => handleExtract('mp3')}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all',
              'bg-gradient-to-r from-purple-500/20 to-purple-600/10 border border-purple-500/40 text-purple-200',
              'hover:from-purple-500/30 hover:to-purple-600/20 hover:border-purple-400/60',
              isLoading && state === 'loading-mp3' && 'opacity-60 cursor-wait',
              isLoading && state !== 'loading-mp3' && 'opacity-40 cursor-not-allowed',
            )}
          >
            {state === 'loading-mp3' ? <Loader2 size={14} className="animate-spin" /> : <Music size={14} />}
            Descargar Audio (MP3)
          </button>

          {media && (
            <a
              href={media.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border border-white/10 text-[#B3B3B3] hover:text-white hover:bg-white/5 transition-all"
            >
              <ExternalLink size={14} />
              Abrir
            </a>
          )}

          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all',
              'bg-gradient-to-r from-cyan-500/20 to-cyan-600/10 border border-cyan-500/40 text-cyan-200',
              'hover:from-cyan-500/30 hover:to-cyan-600/20 hover:border-cyan-400/60',
              isLoading && state === 'loading-analysis' && 'opacity-60 cursor-wait',
              isLoading && state !== 'loading-analysis' && 'opacity-40 cursor-not-allowed',
            )}
          >
            {state === 'loading-analysis' ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
            Analizar Video
          </button>
        </div>

        {state === 'loading-analysis' && (
          <div className="flex items-center gap-2 text-[11px] text-cyan-200">
            <Loader2 size={12} className="animate-spin" />
            Extrayendo audio e información del video...
          </div>
        )}

        <AnimatePresence>
          {state === 'error' && errorMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            >
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {media && state !== 'error' && (
          <div className="flex items-center gap-1.5 text-[10px] text-green-300/70">
            <Download size={10} />
            <span>Archivo preparado. La descarga debería haber comenzado automáticamente.</span>
          </div>
        )}
      </div>
    </div>
  );
}
