'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Square, Mic, MicOff, Paperclip, Image as ImageIcon,
  FileText, X, Maximize2, Minimize2, Wand as Wand2, Sparkles,
  ChevronDown, Eye, CreditCard as Edit3, Plus,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useVoice } from '@/hooks/useVoice';
import { useFileUpload } from '@/hooks/useFileUpload';
import { cn } from '@/lib/utils';
import type { ImageStyle, ImageSize, ImageQuality, ImageMode } from '@/src/services/images/types';

const STYLE_OPTIONS: { value: ImageStyle; label: string }[] = [
  { value: 'realista', label: 'Realista' },
  { value: 'anime', label: 'Anime' },
  { value: 'disney', label: 'Disney' },
  { value: 'pixel-art', label: 'Pixel Art' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'futurista', label: 'Futurista' },
  { value: 'minimalista', label: 'Minimalista' },
  { value: 'fotografia', label: 'Fotografía' },
  { value: '3d', label: '3D' },
  { value: 'concept-art', label: 'Concept Art' },
];

const SIZE_OPTIONS: { value: ImageSize; label: string }[] = [
  { value: '1024x1024', label: 'Cuadrada 1024×1024' },
  { value: '1024x1536', label: 'Vertical 1024×1536' },
  { value: '1536x1024', label: 'Horizontal 1536×1024' },
];

const QUALITY_OPTIONS: { value: ImageQuality; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
];

const MODE_OPTIONS: { value: ImageMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'generate', label: 'Crear',  icon: <Sparkles size={14} />, desc: 'Generar una imagen nueva' },
  { value: 'edit',     label: 'Editar', icon: <Edit3 size={14} />,    desc: 'Modificar una imagen adjunta' },
  { value: 'analyze',   label: 'Analizar', icon: <Eye size={14} />,   desc: 'Describir y analizar una imagen' },
];

export function InputBar() {
  const {
    isStreaming, stopStreaming, sendMessage,
    pendingFiles, removePendingFile, clearPendingFiles,
    isListening, isSpeaking,
  } = useAppStore();
  const { startListening, stopListening } = useVoice();
  const { processFiles } = useFileUpload();

  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imageMode, setImageMode] = useState<null | ImageMode>(null);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [style, setStyle] = useState<ImageStyle>('realista');
  const [size, setSize] = useState<ImageSize>('1024x1024');
  const [quality, setQuality] = useState<ImageQuality>('medium');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content && pendingFiles.length === 0) return;
    if (isStreaming) return;
    const mode = imageMode;
    const opts = mode ? { style, size, quality } : undefined;
    setInput('');
    const files = [...pendingFiles];
    clearPendingFiles();
    setImageMode(null);
    setShowImageOptions(false);
    await sendMessage(content, files.length > 0 ? files : undefined, opts);
  }, [input, pendingFiles, isStreaming, clearPendingFiles, sendMessage, imageMode, style, size, quality]);

  const handleImageAction = useCallback((mode: ImageMode) => {
    setImageMode(mode);
    textareaRef.current?.focus();
  }, []);

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

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, expanded ? 300 : 120) + 'px';
  };

  return (
    <div className="px-4 pb-4 pt-2 max-w-4xl mx-auto w-full">
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
              <div
                key={file.id}
                className="flex items-center gap-2 glass-card rounded-xl px-3 py-1.5"
              >
                {file.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.dataUrl} alt={file.name} className="w-8 h-8 object-cover rounded-lg" />
                ) : (
                  <FileText size={14} className="text-purple-400" />
                )}
                <span className="text-xs text-white/80 truncate max-w-[100px]">{file.name}</span>
                <span className="text-[10px] text-[#BDB7CC]/50">{(file.size / 1024).toFixed(0)}KB</span>
                <button onClick={() => removePendingFile(file.id)} className="text-[#BDB7CC] hover:text-white transition-colors">
                  <X size={12} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image options panel */}
      <AnimatePresence>
        {imageMode && showImageOptions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 rounded-2xl glass-strong overflow-hidden"
          >
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-purple-300/70 mb-1.5 block">Estilo</label>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setStyle(opt.value)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                        style === opt.value
                          ? 'text-white'
                          : 'bg-white/5 text-[#BDB7CC] hover:bg-white/10 hover:text-white'
                      )}
                      style={style === opt.value ? {
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.9), rgba(255, 95, 215, 0.8))',
                        boxShadow: '0 2px 10px rgba(168, 85, 247, 0.3)',
                      } : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-purple-300/70 mb-1.5 block">Tamaño</label>
                  <select
                    value={size}
                    onChange={e => setSize(e.target.value as ImageSize)}
                    className="w-full glass-card rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-purple-500/30"
                  >
                    {SIZE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-purple-300/70 mb-1.5 block">Calidad</label>
                  <select
                    value={quality}
                    onChange={e => setQuality(e.target.value as ImageQuality)}
                    className="w-full glass-card rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-purple-500/30"
                  >
                    {QUALITY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input — floating glass bar */}
      <motion.div
        className={cn(
          'relative rounded-[24px] transition-all',
          isDragging ? 'border-purple-500/60' : '',
        )}
        style={{
          background: 'rgba(18, 9, 31, 0.72)',
          backdropFilter: 'blur(24px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: isDragging
            ? '0 8px 40px rgba(168, 85, 247, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
            : '0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(168, 85, 247, 0.04)',
        }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        animate={{
          boxShadow: isStreaming
            ? '0 8px 40px rgba(168, 85, 247, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
            : '0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => { setInput(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          placeholder={
            imageMode === 'generate' ? 'Describe la imagen que quieres crear…'
            : imageMode === 'edit' ? 'Describe el cambio para la imagen adjunta…'
            : imageMode === 'analyze' ? 'Adjunta una imagen y pregunta sobre ella…'
            : 'Escribe tu mensaje...'
          }
          rows={1}
          className="w-full bg-transparent text-white text-sm placeholder-[#BDB7CC]/40 resize-none outline-none px-5 pt-4 pb-2 max-h-[200px] overflow-y-auto"
          style={{ minHeight: '52px' }}
        />

        {/* Image-mode banner */}
        <AnimatePresence>
          {imageMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between px-4 py-1.5 border-t border-purple-500/15"
              style={{ background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.08), rgba(255, 95, 215, 0.06))' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-purple-300 flex items-center gap-1.5">
                  <Wand2 size={12} />
                  {imageMode === 'generate' && 'Modo: Crear imagen'}
                  {imageMode === 'edit' && 'Modo: Editar imagen'}
                  {imageMode === 'analyze' && 'Modo: Analizar imagen'}
                </span>
                {imageMode === 'generate' && (
                  <button
                    onClick={() => setShowImageOptions(!showImageOptions)}
                    className="text-[11px] text-purple-300/70 hover:text-purple-200 flex items-center gap-0.5 transition-colors"
                  >
                    Opciones
                    <ChevronDown size={11} className={cn('transition-transform', showImageOptions && 'rotate-180')} />
                  </button>
                )}
              </div>
              <button
                onClick={() => { setImageMode(null); setShowImageOptions(false); setInput(''); }}
                className="text-[11px] text-[#BDB7CC] hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
          {/* Left tools */}
          <div className="flex items-center gap-1">
            <ToolBtn icon={<Plus size={16} />} label="Adjuntar" onClick={() => fileInputRef.current?.click()} />
            <ToolBtn icon={<Paperclip size={15} />} label="Archivo" onClick={() => fileInputRef.current?.click()} />
            <ToolBtn icon={<ImageIcon size={15} />} label="Imagen" onClick={() => imageInputRef.current?.click()} />
            <ToolBtn
              icon={isListening ? <MicOff size={15} className="text-red-400" /> : <Mic size={15} />}
              label={isListening ? 'Detener voz' : 'Micrófono'}
              onClick={handleVoice}
              active={isListening}
            />
            <ToolBtn
              icon={expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              label={expanded ? 'Contraer' : 'Expandir'}
              onClick={() => setExpanded(!expanded)}
            />
          </div>

          {/* Right tools */}
          <div className="flex items-center gap-1.5">
            {/* Image mode buttons */}
            <ToolBtn
              icon={<Wand2 size={15} className={imageMode === 'generate' ? 'text-fuchsia-400' : undefined} />}
              label="Crear imagen"
              onClick={() => handleImageAction('generate')}
              active={imageMode === 'generate'}
            />
            <ToolBtn
              icon={<Edit3 size={15} className={imageMode === 'edit' ? 'text-fuchsia-400' : undefined} />}
              label="Editar"
              onClick={() => handleImageAction('edit')}
              active={imageMode === 'edit'}
            />
            <ToolBtn
              icon={<Eye size={15} className={imageMode === 'analyze' ? 'text-fuchsia-400' : undefined} />}
              label="Analizar"
              onClick={() => handleImageAction('analyze')}
              active={imageMode === 'analyze'}
            />

            {/* Central AI button */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={isStreaming ? stopStreaming : handleSend}
              disabled={!isStreaming && !input.trim() && pendingFiles.length === 0}
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-2xl transition-all ml-1',
                isStreaming
                  ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                  : (input.trim() || pendingFiles.length > 0)
                    ? 'text-white'
                    : 'bg-white/5 text-[#BDB7CC]/40 cursor-not-allowed'
              )}
              style={!isStreaming && (input.trim() || pendingFiles.length > 0) ? {
                background: 'linear-gradient(135deg, #A855F7 0%, #FF5FD7 100%)',
                boxShadow: '0 4px 16px rgba(168, 85, 247, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              } : {}}
            >
              {isStreaming ? <Square size={16} /> : <Send size={16} />}
            </motion.button>
          </div>
        </div>
      </motion.div>

      <p className="text-center text-[10px] text-[#BDB7CC]/40 mt-2">
        Yosseling puede cometer errores. Verifica la información importante.
      </p>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.docx,.txt,.csv,.xlsx,.doc"
        onChange={e => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={imageInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*"
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
      title={label}
      onClick={onClick}
      className={cn(
        'p-2 rounded-xl transition-all text-sm',
        active
          ? 'bg-fuchsia-500/15 text-fuchsia-300 glow-soft'
          : 'text-[#BDB7CC] hover:text-white hover:bg-white/5'
      )}
    >
      {icon}
    </button>
  );
}
