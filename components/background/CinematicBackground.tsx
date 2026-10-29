"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { NebulaCanvas } from './NebulaCanvas';
import { ParticleField } from './ParticleField';

export function CinematicBackground() {
  const [isMounted, setIsMounted] = useState(false);
  const isStreaming = useAppStore(s => s.isStreaming);
  const isListening = useAppStore(s => s.isListening);
  const animatedBackground = useAppStore(s => s.settings.animatedBackground);

  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  const getMousePos = useCallback(() => mouseRef.current, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Track mouse position normalized 0-1
  useEffect(() => {
    if (!isMounted) return;
    const handler = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, [isMounted]);

  if (!isMounted || !animatedBackground) return null;

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ zIndex: 0, pointerEvents: 'none' }}>
      {/* Layer 1 — Nebula / deep space */}
      <NebulaCanvas isListening={isListening} isStreaming={isStreaming} />

      {/* Layer 2 — Particles */}
      <ParticleField
        isListening={isListening}
        isStreaming={isStreaming}
        getMousePos={getMousePos}
      />

      {/* Layer 3 — Illustrated jungle portrait */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/yosseling-bg.png')",
            imageRendering: 'auto',
          }}
        />
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          style={{
            backgroundImage: 'linear-gradient(90deg, rgba(5,4,12,0.88) 0%, rgba(5,4,12,0.66) 30%, rgba(5,4,12,0.30) 62%, rgba(5,4,12,0.22) 100%), linear-gradient(180deg, rgba(7,5,16,0.12) 0%, rgba(7,5,16,0.08) 55%, rgba(7,5,16,0.45) 100%)',
          }}
        />
      </div>

      {/* Layer 4 — Crystal glass overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(5,3,15,0.12) 0%, rgba(5,3,15,0.10) 40%, rgba(5,3,15,0.42) 70%, rgba(5,3,15,0.78) 100%)',
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
