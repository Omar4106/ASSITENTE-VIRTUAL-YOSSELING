'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, LoaderCircle, ListVideo, Play, X } from 'lucide-react';
import type { MediaFormat } from '@/lib/services/media/types';

type QueueStatus = 'pending' | 'processing' | 'ready' | 'error';

interface QueueItem {
  id: number;
  url: string;
  status: QueueStatus;
  downloadUrl?: string;
  filename?: string;
  error?: string;
}

interface DownloadResponse {
  success?: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: string;
}

function detectPlatform(url: string): string {
  if (/youtu\.be|youtube\.com/i.test(url)) return 'YouTube';
  if (/tiktok\.com/i.test(url)) return 'TikTok';
  if (/instagram\.com|instagr\.am/i.test(url)) return 'Instagram';
  if (/facebook\.com|fb\.watch|fb\.gg/i.test(url)) return 'Facebook';
  if (/twitter\.com|x\.com|t\.co/i.test(url)) return 'X';
  if (/pinterest\.com|pin\.it/i.test(url)) return 'Pinterest';
  if (/reddit\.com|redd\.it/i.test(url)) return 'Reddit';
  return 'Red social';
}

function StatusBadge({ status }: { status: QueueStatus }) {
  const styles: Record<QueueStatus, string> = {
    pending: 'border-white/10 bg-white/5 text-white/60',
    processing: 'border-blue-400/20 bg-blue-400/10 text-blue-200',
    ready: 'border-green-400/20 bg-green-400/10 text-green-200',
    error: 'border-red-400/20 bg-red-400/10 text-red-200',
  };

  const labels: Record<QueueStatus, string> = {
    pending: 'Pendiente',
    processing: 'Procesando...',
    ready: 'Listo',
    error: 'Error',
  };

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${styles[status]}`}>
      {status === 'processing' && <LoaderCircle size={12} className="animate-spin" />}
      {status === 'ready' && <CheckCircle2 size={12} />}
      {status === 'error' && <AlertCircle size={12} />}
      {labels[status]}
    </span>
  );
}

export function BatchDownloadQueue() {
  const [isMounted, setIsMounted] = useState(false);
  const [input, setInput] = useState('');
  const [format, setFormat] = useState<MediaFormat>('mp4');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const processQueue = async () => {
    if (typeof window === 'undefined') return;
    const urls = input.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
    if (urls.length === 0) {
      setFormError('Pega al menos un enlace para iniciar la cola.');
      return;
    }

    setFormError('');
    setIsProcessing(true);
    const queue = urls.map((url, id): QueueItem => ({ id, url, status: 'pending' }));
    setItems(queue);

    for (const item of queue) {
      setItems((current) => current.map((entry) =>
        entry.id === item.id ? { ...entry, status: 'processing' } : entry,
      ));

      try {
        const response = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.url, format }),
        });
        const result = (await response.json()) as DownloadResponse;

        if (!response.ok || !result.success || !result.downloadUrl) {
          throw new Error(result.error ?? 'No se pudo preparar esta descarga.');
        }

        setItems((current) => current.map((entry) =>
          entry.id === item.id
            ? { ...entry, status: 'ready', downloadUrl: result.downloadUrl, filename: result.filename }
            : entry,
        ));
      } catch (error) {
        setItems((current) => current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                status: 'error',
                error: error instanceof Error ? error.message : 'Error al procesar el enlace.',
              }
            : entry,
        ));
      }
    }

    setIsProcessing(false);
  };

  if (!isMounted) {
    return <div className="p-6 text-zinc-400">Cargando herramienta...</div>;
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6">
        <ListVideo size={18} className="shrink-0 text-purple-300" />
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-white">Cola de descargas</h1>
          <p className="text-xs text-white/50">Procesa varios enlaces en una sola cola.</p>
        </div>
        {items.length > 0 && !isProcessing && (
          <button
            type="button"
            onClick={() => setItems([])}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white"
          >
            <X size={14} /> Limpiar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-5">
          <label className="block space-y-2">
            <span className="text-xs font-medium text-white/75">Enlaces (uno por línea)</span>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isProcessing}
              placeholder={'https://www.instagram.com/reel/...\nhttps://x.com/usuario/status/...'}
              rows={5}
              className="w-full resize-y rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-400/50 disabled:opacity-50"
            />
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-2">
              <span className="block text-xs font-medium text-white/75">Formato para toda la cola</span>
              <select
                value={format}
                onChange={(event) => setFormat(event.target.value as MediaFormat)}
                disabled={isProcessing}
                className="rounded-lg border border-white/10 bg-[#171923] px-3 py-2 text-sm text-white outline-none focus:border-purple-400/50"
              >
                <option value="mp4">MP4 — Video</option>
                <option value="mp3">MP3 — Audio</option>
              </select>
            </label>
            <button
              type="button"
              onClick={processQueue}
              disabled={isProcessing}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-wait disabled:opacity-60"
            >
              {isProcessing ? <LoaderCircle size={15} className="animate-spin" /> : <Play size={15} />}
              {isProcessing ? 'Procesando cola...' : 'Procesar y Descargar todo'}
            </button>
            {formError && <p role="alert" className="w-full text-xs text-red-300">{formError}</p>}
          </div>

          {items.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.03] px-3 py-2">
                <span className="text-xs font-medium text-white/75">Enlaces</span>
                <span className="text-[11px] text-white/45">
                  {items.filter((item) => item.status === 'ready' || item.status === 'error').length} / {items.length} procesados
                </span>
              </div>
              <ul className="divide-y divide-white/[0.06]">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-3 sm:flex-nowrap sm:gap-3">
                    <span className="w-20 shrink-0 text-xs font-medium text-white/70">{detectPlatform(item.url)}</span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={item.url}
                      className="min-w-0 flex-1 truncate text-xs text-white/55 hover:text-purple-200"
                    >
                      {item.url}
                    </a>
                    <StatusBadge status={item.status} />
                    {item.status === 'ready' && item.downloadUrl ? (
                      <a
                        href={item.downloadUrl}
                        download={item.filename}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-purple-400/25 bg-purple-400/10 px-2 py-1.5 text-[11px] font-medium text-purple-100 hover:bg-purple-400/20"
                      >
                        <Download size={12} /> Descargar {format.toUpperCase()}
                      </a>
                    ) : item.status === 'error' ? (
                      <span title={item.error} className="max-w-40 truncate text-[11px] text-red-300/80">
                        {item.error}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
