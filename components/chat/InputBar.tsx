'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Square, Mic, MicOff, Paperclip, Image as ImageIcon, FileText,
  Printer, X, Maximize2, Minimize2, Sparkles, WandSparkles, Music2, Film, Camera,
  MoreHorizontal
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { ImageGenerationProvider } from '@/types';
import { useVoice } from '@/hooks/useVoice';
import { useFileUpload } from '@/hooks/useFileUpload';
import { cn } from '@/lib/utils';

export function InputBar() {
  const {
    isStreaming, stopStreaming, sendMessage,
    pendingFiles, removePendingFile, clearPendingFiles,
    isListening, isSpeaking,
  } = useAppStore();
  const { startListening, stopListening } = useVoice();
  const { processFiles, isProcessing, processingName, error, clearError } = useFileUpload();

  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMediaDialogOpen, setIsMediaDialogOpen] = useState(false);
  const [mediaMode, setMediaMode] = useState<'image' | 'edit-image' | 'audio' | 'video'>('image');
  const [outputMode, setOutputMode] = useState<'text' | 'image' | 'audio' | 'video'>('text');
  const [imagePrompt, setImagePrompt] = useState('');
  const [audioLyrics, setAudioLyrics] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [imageProvider, setImageProvider] = useState<Exclude<ImageGenerationProvider, 'auto'>>('fal');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content && pendingFiles.length === 0) return;
    if (isStreaming) return;
    setInput('');
    const files = [...pendingFiles];
    const sourceImage = files.find(file => file.type.startsWith('image/') && file.dataUrl)?.dataUrl;
    const normalized = content.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const editRequest = /\b(?:edita(?:r|la|lo)?|transforma(?:r|la|lo)?|convierte(?:r|la|lo)?|estilo anime|estilo dibujo|haz(?:la|lo)?\s+(?:en|estilo)|dibujala|dibujalo)\b/.test(normalized);
    const videoRequest = /\b(?:video|clip|anima(?:r|la|lo)?|animacion)\b/.test(normalized);
    const detectedMediaMode = sourceImage && videoRequest
      ? 'video'
      : sourceImage && editRequest
        ? 'edit-image'
        : undefined;
    clearPendingFiles();
    await sendMessage(content, files.length > 0 ? files : undefined, detectedMediaMode
      ? { mediaMode: detectedMediaMode, imageDataUrl: sourceImage }
      : undefined);
  }, [input, pendingFiles, isStreaming, clearPendingFiles, sendMessage]);

  const openMediaDialog = useCallback((mode: typeof mediaMode) => {
    setMediaMode(mode);
    setOutputMode(mode === 'edit-image' ? 'image' : mode);
    setMediaError('');
    setImagePrompt('');
    setIsMediaDialogOpen(true);
  }, []);

  const handleOutputModeChange = (mode: 'text' | 'image' | 'audio' | 'video') => {
    setOutputMode(mode);
    if (mode !== 'text') openMediaDialog(mode);
  };

  const handleOutputModeSelect = (value: string) => {
    if (value === 'text' || value === 'image' || value === 'audio' || value === 'video') {
      handleOutputModeChange(value);
    }
  };

  const handleGenerateMedia = useCallback(async () => {
    const prompt = imagePrompt.trim();
    if (prompt.length < 3 || isStreaming) return;
    const files = [...pendingFiles];
    const sourceImage = files.find(file => file.type.startsWith('image/') && file.dataUrl)?.dataUrl;
    if (mediaMode === 'edit-image' && !sourceImage) {
      setMediaError('Adjunta primero una imagen PNG, JPEG o WebP.');
      return;
    }

    const content = mediaMode === 'image' ? `Genera una imagen de ${prompt}` : prompt;
    setIsMediaDialogOpen(false);
    setImagePrompt('');
    setMediaError('');
    clearPendingFiles();
    await sendMessage(content, files.length > 0 ? files : undefined, {
      mediaMode,
      imageProvider,
      ...(sourceImage && (mediaMode === 'edit-image' || mediaMode === 'video') ? { imageDataUrl: sourceImage } : {}),
      ...(mediaMode === 'audio' && audioLyrics.trim() ? { lyrics: audioLyrics.trim() } : {}),
    });
  }, [imagePrompt, pendingFiles, mediaMode, imageProvider, audioLyrics, isStreaming, clearPendingFiles, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening(text => setInput(prev => prev + (prev ? ' ' : '') + text));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, expanded ? 300 : 120) + 'px';
  };

  return (
    <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
      {isProcessing && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
          Extrayendo texto del archivo{processingName ? `: ${processingName}` : '...'}
        </div>
      )}
      {error && (
        <button onClick={clearError} className="mb-3 w-full rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-left text-xs text-red-200">
          {error}
        </button>
      )}

      {/* Pending files */}
      <AnimatePresence>
        {pendingFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2 mb-3"
          >
            {pendingFiles.map(file => (
              <div key={file.id} className="flex items-center gap-2 bg-[#1A1B26] border border-white/10 rounded-lg px-3 py-1.5">
                {file.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.dataUrl} alt={file.name} className="w-8 h-8 object-cover rounded" />
                ) : (
                  <FileText size={14} className="text-purple-400" />
                )}
                <span className="text-xs text-white/80 truncate max-w-[100px]">{file.name}</span>
                <span className="text-[10px] text-[#B3B3B3]">{(file.size / 1024).toFixed(0)}KB</span>
                <button onClick={() => removePendingFile(file.id)} className="text-[#B3B3B3] hover:text-white transition-colors">
                  <X size={12} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input */}
      <div
        className={cn(
          'relative rounded-2xl border transition-all',
          isDragging ? 'border-purple-500/60' : 'border-white/[0.08]',
          'focus-within:border-purple-500/50'
        )}
        style={{
          background: 'rgba(10,8,22,0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => { setInput(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu mensaje..."
          rows={1}
          className="w-full bg-transparent text-white text-sm placeholder-[#B3B3B3]/50 resize-none outline-none px-4 pt-4 pb-2 max-h-[200px] overflow-y-auto"
          style={{ minHeight: '52px' }}
        />

        {/* Toolbar */}
        <div className="flex min-w-0 items-center gap-1.5 px-2 pb-2 sm:gap-2 sm:px-3 sm:pb-3">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <label className="sr-only" htmlFor="chat-output-mode">Tipo de respuesta</label>
            <select
              id="chat-output-mode"
              value={outputMode}
              onChange={(event) => handleOutputModeSelect(event.target.value)}
              className="h-9 max-w-[86px] shrink-0 rounded-lg border border-purple-300/15 bg-[#171523] px-1.5 text-[10px] text-white/80 outline-none focus:border-purple-300/40 sm:max-w-none sm:px-2 sm:text-xs"
            >
              <option value="text">Texto</option>
              <option value="image">Imagen</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
            </select>
            <ToolBtn icon={<Paperclip size={15} />} label="Adjuntar archivos" onClick={() => fileInputRef.current?.click()} />
            <ToolBtn
              icon={isListening ? <MicOff size={15} className="text-red-400" /> : <Mic size={15} />}
              label={isListening ? 'Detener voz' : 'Micrófono'}
              onClick={handleVoice}
              active={isListening}
            />
            <details className="group relative shrink-0">
              <summary
                aria-label="Más opciones"
                title="Más opciones"
                className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-[#B3B3B3] transition-colors hover:bg-white/5 hover:text-white [&::-webkit-details-marker]:hidden"
              >
                <MoreHorizontal size={17} />
              </summary>
              <div className="absolute bottom-full left-0 z-30 mb-2 flex min-w-44 flex-col gap-1 rounded-xl border border-white/10 bg-[#111018] p-1.5 shadow-xl shadow-black/40">
                <ToolMenuBtn icon={<ImageIcon size={15} />} label="Adjuntar imagen" onClick={() => imageInputRef.current?.click()} />
                <ToolMenuBtn icon={<Camera size={15} />} label="Tomar una foto" onClick={() => cameraInputRef.current?.click()} />
                <ToolMenuBtn icon={<Printer size={15} />} label="Imprimir" onClick={handlePrint} />
                <ToolMenuBtn
                  icon={expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  label={expanded ? 'Contraer editor' : 'Expandir editor'}
                  onClick={() => setExpanded(!expanded)}
                />
              </div>
            </details>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isStreaming ? stopStreaming : handleSend}
            disabled={!isStreaming && !input.trim() && pendingFiles.length === 0}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all',
              isStreaming
                ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                : (input.trim() || pendingFiles.length > 0)
                  ? 'bg-gradient-to-br from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-white/5 text-[#B3B3B3] cursor-not-allowed'
            )}
          >
            {isStreaming ? <Square size={16} /> : <Send size={16} />}
          </motion.button>
        </div>
      </div>

      <p className="text-center text-[10px] text-[#B3B3B3]/40 mt-2">
        Yosseling puede cometer errores. Verifica la información importante.
      </p>

      {isMediaDialogOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsMediaDialogOpen(false);
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="media-generation-title"
            className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-purple-300/15 bg-[#111018] p-4 shadow-2xl shadow-black/50 sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="media-generation-title" className="flex items-center gap-2 text-sm font-semibold text-white">
                  {mediaMode === 'audio' ? <Music2 size={16} className="text-cyan-200" />
                    : mediaMode === 'video' ? <Film size={16} className="text-cyan-200" />
                      : mediaMode === 'edit-image' ? <WandSparkles size={16} className="text-purple-200" />
                        : <Sparkles size={16} className="text-purple-200" />}
                  {mediaMode === 'audio' ? 'Generar audio'
                    : mediaMode === 'video' ? 'Generar video'
                      : mediaMode === 'edit-image' ? 'Transformar imagen'
                        : 'Generar imagen'}
                </h2>
                <p className="mt-1 text-xs text-white/50">
                  {mediaMode === 'edit-image' ? 'Conserva el contenido principal de la imagen adjunta.'
                    : mediaMode === 'audio' ? 'Crea una pista de hasta 20 segundos con Fal.ai.'
                      : mediaMode === 'video' ? 'Crea un clip corto; usa la imagen adjunta como referencia opcional.'
                        : 'Elige velocidad o precisión. La clave se mantiene en el servidor.'}
                </p>
              </div>
              <button type="button" onClick={() => setIsMediaDialogOpen(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <label className="block space-y-1.5 text-xs text-white/65">
              {mediaMode === 'audio' ? 'Describe el audio'
                : mediaMode === 'video' ? 'Describe el video'
                  : mediaMode === 'edit-image' ? '¿Cómo quieres transformar la imagen?'
                    : 'Describe la imagen'}
              <textarea
                autoFocus
                value={imagePrompt}
                maxLength={mediaMode === 'audio' || mediaMode === 'video' ? 1000 : 4000}
                rows={3}
                onChange={(event) => setImagePrompt(event.target.value)}
                placeholder={mediaMode === 'audio' ? 'Ej.: melodía acústica alegre con voz masculina...'
                  : mediaMode === 'video' ? 'Ej.: una toma cinematográfica de una playa al atardecer...'
                    : mediaMode === 'edit-image' ? 'Ej.: transfórmala en una ilustración anime de líneas nítidas...'
                      : 'Ej.: una ilustración tropical al atardecer, con hojas luminosas y tonos violeta...'}
                className="w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-300/40"
              />
            </label>
            {mediaMode === 'audio' && (
              <label className="block space-y-1.5 text-xs text-white/65">
                Letra opcional (si la escribes, el modelo intentará cantarla)
                <textarea value={audioLyrics} maxLength={3000} rows={2} onChange={(event) => setAudioLyrics(event.target.value)} placeholder="Escribe aquí la letra..." className="w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-300/40" />
              </label>
            )}
            {(mediaMode === 'edit-image' || mediaMode === 'video') && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <span className="text-xs text-white/60">
                  {pendingFiles.some(file => file.type.startsWith('image/') && file.dataUrl)
                    ? `Imagen lista: ${pendingFiles.find(file => file.type.startsWith('image/') && file.dataUrl)?.name}`
                    : mediaMode === 'edit-image' ? 'Adjunta una imagen para transformarla.' : 'La imagen de referencia es opcional.'}
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => imageInputRef.current?.click()} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/5">Elegir imagen</button>
                  <button type="button" onClick={() => cameraInputRef.current?.click()} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/5">Cámara</button>
                </div>
              </div>
            )}
            {mediaMode === 'image' && (
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="mb-2 text-xs text-white/65">Motor de generación</legend>
                <label className={`cursor-pointer rounded-xl border p-3 transition-colors ${imageProvider === 'fal' ? 'border-cyan-300/30 bg-cyan-300/[0.08]' : 'border-white/10 bg-white/[0.02]'}`}>
                  <input type="radio" name="image-provider" value="fal" checked={imageProvider === 'fal'} onChange={() => setImageProvider('fal')} className="sr-only" />
                  <span className="block text-xs font-medium text-cyan-100">Rápida · Fal.ai</span>
                  <span className="mt-1 block text-[11px] text-white/50">FLUX Schnell para resultados ágiles</span>
                </label>
                <label className={`cursor-pointer rounded-xl border p-3 transition-colors ${imageProvider === 'huggingface' ? 'border-purple-300/30 bg-purple-300/[0.08]' : 'border-white/10 bg-white/[0.02]'}`}>
                  <input type="radio" name="image-provider" value="huggingface" checked={imageProvider === 'huggingface'} onChange={() => setImageProvider('huggingface')} className="sr-only" />
                  <span className="block text-xs font-medium text-purple-100">Precisa · Hugging Face</span>
                  <span className="mt-1 block text-[11px] text-white/50">FLUX Dev para más detalle</span>
                </label>
              </fieldset>
            )}
            {mediaError && <p role="alert" className="text-xs text-red-300">{mediaError}</p>}
            <button
              type="button"
              disabled={imagePrompt.trim().length < 3 || isStreaming || (mediaMode === 'edit-image' && !pendingFiles.some(file => file.type.startsWith('image/') && file.dataUrl))}
              onClick={() => void handleGenerateMedia()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {mediaMode === 'audio' ? <Music2 size={15} />
                : mediaMode === 'video' ? <Film size={15} />
                  : mediaMode === 'edit-image' ? <WandSparkles size={15} />
                    : <Sparkles size={15} />}
              {mediaMode === 'audio' ? 'Crear audio'
                : mediaMode === 'video' ? 'Crear video'
                  : mediaMode === 'edit-image' ? 'Transformar imagen'
                    : 'Crear imagen'}
            </button>
          </section>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        accept=".pdf,.doc,.docx,.pptx,.txt,.md,.json,.csv,.xlsx,.ts,.tsx,.js,.jsx,.css,.html,.xml,.yaml,.yml,.sql,.py,.java,.c,.cpp,.h,.hpp,.log,.ini,.env,.sh,.bat,.toml,.exe,.dll,.bin,.msi,.so,.dylib,.app,.png,.jpg,.jpeg,.webp,.gif"
        onChange={e => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={imageInputRef}
        type="file"
        hidden
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={e => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp"
        capture="environment"
        onChange={e => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}

function ToolBtn({ icon, label, onClick, active }: {
  icon: React.ReactNode; label: string; onClick: () => void; active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-lg p-2 transition-colors text-sm',
        active ? 'bg-red-500/20 text-red-400' : 'text-[#B3B3B3] hover:text-white hover:bg-white/5'
      )}
    >
      {icon}
    </button>
  );
}

function ToolMenuBtn({ icon, label, onClick }: {
  icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.currentTarget.closest('details')?.removeAttribute('open');
        onClick();
      }}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[#B3B3B3] transition-colors hover:bg-white/5 hover:text-white"
    >
      {icon}
      {label}
    </button>
  );
}
