'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Music, Video, Loader as Loader2, Brain, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

interface MediaDownloaderProps {
  url: string;
}

type DownloadState =
  | 'idle'
  | 'loading-mp4'
  | 'loading-mp3'
  | 'loading-analysis'
  | 'ready-mp4'
  | 'ready-mp3'
  | 'error';

interface ExtractedMedia {
  url: string;
  filename: string;
  format: 'mp4' | 'mp3';
}

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch|shorts|embed)|youtu\.be\/)([\w-]{11})/i;

function detectPlatform(url: string): string {
  if (YOUTUBE_RE.test(url)) return 'YouTube';
  if (/instagram\.com|instagr\.am/i.test(url)) return 'Instagram';
  if (/facebook\.com|fb\.watch/i.test(url)) return 'Facebook';
  if (/twitter\.com|x\.com/i.test(url)) return 'Twitter / X';
  if (/tiktok\.com/i.test(url)) return 'TikTok';
  return 'Red social';
}

function forceNativeDownload(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function MediaDownloader({ url }: MediaDownloaderProps) {
  const [state, setState] = useState<DownloadState>('idle');
  const [media, setMedia] = useState<ExtractedMedia | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { sendMessage } = useAppStore();

  const platform = useMemo(() => detectPlatform(url), [url]);
  const isLoading = state === 'loading-mp4' || state === 'loading-mp3' || state === 'loading-analysis';

  const handleAnalyze = useCallback(async () => {
    setState('loading-analysis');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = (await res.json()) as { analysis?: string; error?: string };

      if (res.ok && data.analysis && sendMessage) {
        await sendMessage(`Analiza este video: ${url}\n\nResultado del análisis:\n${data.analysis}`);
      } else {
        setErrorMsg(data.error ?? 'No pude analizar este video ahora mismo.');
        setState('error');
        return;
      }
    } catch {
      setErrorMsg('Error de red al analizar el video.');
      setState('error');
      return;
    }

    setState('idle');
  }, [url, sendMessage]);

  /** Resolve native MP4/MP3 via API/JSON and force a device download (no iframes). */
  const triggerNativeDownload = useCallback(async (format: 'mp4' | 'mp3') => {
    setState(format === 'mp4' ? 'loading-mp4' : 'loading-mp3');
    setMedia(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        downloadUrl?: string;
        url?: string;
        filename?: string;
        error?: string;
      };

      if (!data.success || !(data.downloadUrl || data.url)) {
        setErrorMsg(data.error ?? 'No se encontró un enlace de descarga nativo.');
        setState('error');
        return;
      }

      const downloadUrl = data.downloadUrl ?? data.url!;
      const filename = data.filename ?? `yosseling_${format}_${Date.now()}.${format}`;

      // Prefer same-origin proxy blob (reliable Content-Disposition) then anchor fallback
      try {
        const blobRes = await fetch(downloadUrl);
        if (blobRes.ok) {
          const blob = await blobRes.blob();
          const blobUrl = URL.createObjectURL(blob);
          setMedia({ url: blobUrl, filename, format });
          setState(format === 'mp4' ? 'ready-mp4' : 'ready-mp3');
          forceNativeDownload(blobUrl, filename);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
          return;
        }
      } catch {
        // fall through to direct anchor
      }

      setMedia({ url: downloadUrl, filename, format });
      setState(format === 'mp4' ? 'ready-mp4' : 'ready-mp3');
      forceNativeDownload(downloadUrl, filename);
    } catch {
      setErrorMsg('Error de red al preparar la descarga.');
      setState('error');
    }
  }, [url]);

  return (
    <div className="my-3 rounded-xl border border-purple-500/20 bg-black/30 overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-[11px] font-medium text-green-300">
            {platform} detectado — descarga nativa
          </span>
        </div>
        <span className="ml-auto text-[10px] text-[#B3B3B3]/60 truncate max-w-[140px]">
          {url.replace(/^https?:\/\/(www\.)?/, '')}
        </span>
      </div>

      <div className="p-3 space-y-3">
        <AnimatePresence>
          {media && media.format === 'mp4' && (state === 'ready-mp4' || state === 'idle') && (
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
          {media && media.format === 'mp3' && (state === 'ready-mp3' || state === 'idle') && (
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
            onClick={() => triggerNativeDownload('mp4')}
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
            Descargar Video
          </button>

          <button
            onClick={() => triggerNativeDownload('mp3')}
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
            Descargar Audio
          </button>

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

          {(state === 'ready-mp4' || state === 'ready-mp3' || state === 'error') && (
            <button
              onClick={() =>
                state === 'error'
                  ? triggerNativeDownload('mp4')
                  : triggerNativeDownload(state === 'ready-mp4' ? 'mp4' : 'mp3')
              }
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border border-white/10 text-[#B3B3B3] hover:text-white hover:bg-white/5 transition-all"
            >
              <RefreshCw size={14} />
              Reintentar
            </button>
          )}
        </div>

        {state === 'loading-mp4' && (
          <div className="flex items-center gap-2 text-[11px] text-orange-200">
            <Loader2 size={12} className="animate-spin" />
            Extrayendo enlace MP4 nativo...
          </div>
        )}

        {state === 'loading-mp3' && (
          <div className="flex items-center gap-2 text-[11px] text-purple-200">
            <Loader2 size={12} className="animate-spin" />
            Extrayendo enlace MP3 nativo...
          </div>
        )}

        {state === 'loading-analysis' && (
          <div className="flex items-center gap-2 text-[11px] text-cyan-200">
            <Loader2 size={12} className="animate-spin" />
            Extrayendo audio e información del video...
          </div>
        )}

        {media && (state === 'ready-mp4' || state === 'ready-mp3') && (
          <div className="flex items-center gap-1.5 text-[10px] text-green-300/70">
            <Download size={10} />
            <span>Descarga nativa iniciada ({media.filename}).</span>
          </div>
        )}

        {state === 'error' && errorMsg && (
          <div className="flex items-start gap-1.5 text-[11px] text-red-300/90">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
