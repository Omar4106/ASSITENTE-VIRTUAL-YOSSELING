'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { NebulaCanvas } from './NebulaCanvas';
import { ParticleField } from './ParticleField';
import { YosselingAvatar } from './YosselingAvatar';

export function CinematicBackground() {
  const { isStreaming, isSpeaking, isListening, activeChatId } = useAppStore(s => ({
    isStreaming: s.isStreaming,
    isSpeaking: s.isSpeaking,
    isListening: s.isListening,
    activeChatId: s.activeChatId,
  }));

  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [chatChanged, setChatChanged] = useState(false);
  const prevChatId = useRef<string | null>(null);

  // Track mouse position normalized 0-1
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMousePos({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // Detect chat change
  useEffect(() => {
    if (prevChatId.current !== null && prevChatId.current !== activeChatId) {
      setChatChanged(true);
      setTimeout(() => setChatChanged(false), 50);
    }
    prevChatId.current = activeChatId;
  }, [activeChatId]);

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ zIndex: 0, pointerEvents: 'none' }}>
      {/* Layer 1 — Nebula / deep space */}
      <NebulaCanvas isListening={isListening} isStreaming={isStreaming} />

      {/* Layer 2 — Particles */}
      <ParticleField
        isListening={isListening}
        isStreaming={isStreaming}
        mouseX={mousePos.x}
        mouseY={mousePos.y}
      />

      {/* Layer 3 — Avatar */}
      <div className="absolute inset-0">
        <YosselingAvatar
          isListening={isListening}
          isStreaming={isStreaming}
          isSpeaking={isSpeaking}
          mouseX={mousePos.x}
          mouseY={mousePos.y}
          onChatChange={chatChanged}
        />
      </div>

      {/* Layer 4 — Crystal glass overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(5,3,15,0.05) 0%, rgba(5,3,15,0.15) 40%, rgba(5,3,15,0.45) 70%, rgba(5,3,15,0.75) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom vignette to blend character into interface */}
      <div
        className="absolute bottom-0 left-0 right-0 h-48"
        style={{
          background: 'linear-gradient(0deg, rgba(9,9,11,0.98) 0%, rgba(9,9,11,0.7) 60%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Listening pulse ring */}
      {isListening && (
        <motion.div
          className="absolute left-1/2 bottom-[8%]"
          style={{ transform: 'translateX(-50%)' }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.9, 1.3, 0.9], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="w-40 h-40 rounded-full border border-cyan-400/50" />
        </motion.div>
      )}

      {/* Response light pulse */}
      {isStreaming && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.04, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background: 'radial-gradient(ellipse at 50% 40%, rgba(168,85,247,1) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
