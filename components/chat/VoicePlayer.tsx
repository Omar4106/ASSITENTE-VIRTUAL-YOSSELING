'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, X } from 'lucide-react';
import type { VoiceState } from '@/hooks/useVoice';

interface VoicePlayerProps {
  voiceState: VoiceState;
  onSeek: (time: number) => void;
  onSkip: (seconds: number) => void;
  onTogglePlay: () => void;
  onToggleVolume: () => void;
  onStop: () => void;
  isMuted: boolean;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoicePlayer({ voiceState, onSeek, onSkip, onTogglePlay, onToggleVolume, onStop, isMuted }: VoicePlayerProps) {
  const { isSpeaking, isPaused, progress, duration, currentTime } = voiceState;

  const handleSeekbarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.nativeEvent.offsetX;
    const pct = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
    const newTime = (pct / 100) * duration;
    onSeek(newTime);
  };

  return (
    <AnimatePresence>
      {isSpeaking && (
        <motion.div
          key="voice-player"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-1/2 z-50 w-[min(680px,calc(100vw-2rem))] -translate-x-1/2"
        >
          <div
            className="rounded-2xl border border-purple-500/30 px-4 py-3.5 shadow-2xl sm:px-5"
            style={{
              background: 'rgba(12,9,28,0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(124,58,237,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={onTogglePlay}
                type="button"
                aria-label={isPaused ? 'Reanudar reproducción' : 'Pausar reproducción'}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-950/30 transition-all duration-200 hover:scale-105 hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              >
                {isPaused ? <Play size={18} className="ml-0.5" /> : <Pause size={18} />}
              </button>

              <button
                onClick={() => onSkip(-5)}
                type="button"
                aria-label="Retroceder 5 segundos"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/70 transition-all duration-200 hover:scale-105 hover:bg-white/10 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                title="Retroceder 5s"
              >
                <SkipBack size={14} />
              </button>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-medium tabular-nums text-white/70">
                    {formatTime(currentTime)} <span className="text-white/35">/</span> {formatTime(duration)}
                  </span>
                  {voiceState.currentWord && (
                    <span className="min-w-0 truncate text-[10px] text-purple-200/70">{voiceState.currentWord}</span>
                  )}
                </div>
                <div
                  role="progressbar"
                  aria-label="Progreso de voz"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress)}
                  onClick={handleSeekbarClick}
                  className="group relative h-1.5 cursor-pointer rounded-full transition-all duration-200 hover:h-2"
                  style={{ background: `linear-gradient(to right, rgb(168,85,247) ${progress}%, rgba(255,255,255,0.1) ${progress}%)` }}
                >
                  <div
                    className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100"
                    style={{ left: `calc(${progress}% - 6px)` }}
                  />
                </div>
              </div>

              <button
                onClick={() => onSkip(5)}
                type="button"
                aria-label="Avanzar 5 segundos"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/70 transition-all duration-200 hover:scale-105 hover:bg-white/10 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                title="Avanzar 5s"
              >
                <SkipForward size={14} />
              </button>

              <button
                onClick={onToggleVolume}
                type="button"
                aria-label={isMuted ? 'Activar volumen' : 'Silenciar voz'}
                aria-pressed={isMuted}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-purple-200/80 transition-all duration-200 hover:scale-105 hover:bg-white/10 hover:text-purple-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                title={isMuted ? 'Activar volumen' : 'Silenciar voz'}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>

              <button
                onClick={onStop}
                type="button"
                aria-label="Cerrar reproductor y detener voz"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/60 transition-all duration-200 hover:scale-105 hover:bg-red-500/10 hover:text-red-400 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                title="Detener"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}