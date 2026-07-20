'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Square, Mic, MicOff, Paperclip, Image as ImageIcon, FileText,
  Printer, X, Maximize2, Minimize2, Wand as Wand2, Sparkles, Edit3, Eye,
  ChevronDown, Download, RefreshCw,
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
  { value: 'arquitectura', label: 'Arquitectura' },
  { value: 'logo', label: 'Logo' },
  { value: 'vector', label: 'Vector' },
  { value: '3d', label: '3D' },
  { value: 'concept-art', label: 'Concept Art' },
];

const SIZE_OPTIONS: { value: ImageSize; label: string }[] = [
  { value: '1024x1024', label: 'Cuadrada 1024×1024' },
  { value: '1024x1792', label: 'Vertical 1024×1792' },
  { value: '1792x1024', label: 'Horizontal 1792×1024' },
];

const QUALITY_OPTIONS: { value: ImageQuality; label: string }[] = [
  { value: 'standard', label: 'Estándar' },
  { value: 'hd', label: 'HD' },
];

const MODE_OPTIONS: { value: ImageMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'generate', label: 'Crear', icon: <Sparkles size={14} />, desc: 'Generar una imagen nueva' },
  { value: 'edit', label: 'Editar', icon: <Edit3 size={14} />, desc: 'Modificar una imagen adjunta' },
  { value: 'analyze', label: 'Analizar', icon: <Eye size={14} />, desc: 'Describir y analizar una imagen' },
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
  const [quality, setQuality] = useState<ImageQuality>('standard');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content && pendingFiles.length === 0) return;
    if (isStreaming) return;
    setInput('');
    const files = [...pendingFiles];
    clearPendingFiles();
    await sendMessage(content, files.length > 0 ? files : undefined);
    setImageMode(null);
    setShowImageOptions(false);
  }, [input, pendingFiles, isStreaming, clearPendingFiles, sendMessage]);

  const handleImageAction = useCallback((mode: ImageMode) => {
    setImageMode(mode);
    const placeholders: Record<ImageMode, string> = {
      generate: 'Describe la imagen que quieres crear… (ej: "un hotel moderno frente al mar")',
      edit: 'Describe el cambio que quieres aplicar a la imagen adjunta…',
      analyze: 'Adjunta una imagen y describe qué quieres saber sobre ella…',
    };
    setInput(prev => prev || placeholders[mode]);
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
    <div className="px-4 pb-4 pt-2">
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

      {/* Image options panel */}
      <AnimatePresence>
        {imageMode && showImageOptions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 rounded-xl border border-purple-500/20 overflow-hidden"
            style={{ background: 'rgba(18,14,32,0.85)' }}
          >
            <div className="p-3 space-y-3">
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
                          ? 'bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow-md shadow-purple-500/30'
                          : 'bg-white/5 text-[#B3B3B3] hover:bg-white/10 hover:text-white'
                      )}
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
                    className="w-full bg-[#0D0E14] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-purple-500/50"
                  >
                    {SIZE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-purple-300/70 mb-1.5 block">Calidad</label>
                  <select
                    value={quality}
                    onChange={e => setQuality(e.target.value as ImageQuality)}
                    className="w-full bg-[#0D0E14] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-purple-500/50"
                  >
                    {QUALITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
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
          placeholder={
            imageMode === 'generate' ? 'Describe la imagen que quieres crear…'
            : imageMode === 'edit' ? 'Describe el cambio para la imagen adjunta…'
            : imageMode === 'analyze' ? 'Adjunta una imagen y pregunta sobre ella…'
            : 'Escribe tu mensaje...'
          }
          rows={1}
          className="w-full bg-transparent text-white text-sm placeholder-[#B3B3B3]/50 resize-none outline-none px-4 pt-4 pb-2 max-h-[200px] overflow-y-auto"
          style={{ minHeight: '52px' }}
        />

        {/* Image-mode banner */}
        <AnimatePresence>
          {imageMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between px-4 py-1.5 bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 border-t border-purple-500/20"
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
                className="text-[11px] text-[#B3B3B3] hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 pb-3 gap-2">
          <div className="flex items-center gap-1">
            <ToolBtn icon={<Paperclip size={15} />} label="Adjuntar" onClick={() => fileInputRef.current?.click()} />
            <ToolBtn icon={<ImageIcon size={15} />} label="Imagen" onClick={() => imageInputRef.current?.click()} />
            <ToolBtn icon={<FileText size={15} />} label="Documento" onClick={() => fileInputRef.current?.click()} />
            <ToolBtn icon={<Printer size={15} />} label="Imprimir" onClick={handlePrint} />
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

          <div className="flex items-center gap-1">
            {/* Mode selector dropdown */}
            <div className="relative">
              <ToolBtn
                icon={<Wand2 size={15} className="text-fuchsia-400" />}
                label="Crear imagen"
                onClick={() => handleImageAction('generate')}
                active={imageMode === 'generate'}
              />
            </div>
            <ToolBtn
              icon={<Edit3 size={15} className={imageMode === 'edit' ? 'text-fuchsia-400' : undefined} />}
              label="Editar imagen"
              onClick={() => handleImageAction('edit')}
              active={imageMode === 'edit'}
            />
            <ToolBtn
              icon={<Eye size={15} className={imageMode === 'analyze' ? 'text-fuchsia-400' : undefined} />}
              label="Analizar imagen"
              onClick={() => handleImageAction('analyze')}
              active={imageMode === 'analyze'}
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isStreaming ? stopStreaming : handleSend}
            disabled={!isStreaming && !input.trim() && pendingFiles.length === 0}
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-xl transition-all',
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
        'p-2 rounded-lg transition-colors text-sm',
        active ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'text-[#B3B3B3] hover:text-white hover:bg-white/5'
      )}
    >
      {icon}
    </button>
  );
}
