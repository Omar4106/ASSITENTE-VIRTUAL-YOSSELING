'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, Volume2, X } from 'lucide-react';
import type { VoiceState } from '@/hooks/useVoice';

interface VoicePlayerProps {
  voiceState: VoiceState;
  onSeek: (time: number) => void;
  onSkip: (seconds: number) => void;
  onTogglePlay: () => void;
  onStop: () => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoicePlayer({ voiceState, onSeek, onSkip, onTogglePlay, onStop }: VoicePlayerProps) {
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
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(640px,calc(100vw-2rem)]"
        >
          <div
            className="rounded-2xl border border-purple-500/30 px-4 py-3 shadow-2xl"
            style={{
              background: 'rgba(12,9,28,0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(124,58,237,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button
                onClick={onTogglePlay}
                className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white hover:scale-105 transition-transform"
              >
                {isPaused ? <Play size={18} className="ml-0.5" /> : <Pause size={18} />}
              </button>

              {/* Skip back */}
              <button
                onClick={() => onSkip(-5)}
                className="shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Retroceder 5s"
              >
                <SkipBack size={14} />
              </button>

              {/* Seekbar */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-[10px] text-white/50 tabular-nums w-8 text-right">{formatTime(currentTime)}</span>
                <div
                  onClick={handleSeekbarClick}
                  className="flex-1 h-1.5 rounded-full cursor-pointer relative group"
                  style={{ background: `linear-gradient(to right, rgb(168,85,247) ${progress}%, rgba(255,255,255,0.1) ${progress}%)` }}
                >
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{ left: `calc(${progress}% - 6px)` }}
                  />
                </div>
                <span className="text-[10px] text-white/50 tabular-nums w-8">{formatTime(duration)}</span>
              </div>

              {/* Skip forward */}
              <button
                onClick={() => onSkip(5)}
                className="shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Avanzar 5s"
              >
                <SkipForward size={14} />
              </button>

              {/* Volume icon */}
              <Volume2 size={16} className="shrink-0 text-purple-300/70 hidden sm:block" />

              {/* Stop */}
              <button
                onClick={onStop}
                className="shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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