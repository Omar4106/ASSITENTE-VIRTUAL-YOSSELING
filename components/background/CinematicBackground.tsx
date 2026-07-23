'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';

/**
 * CinematicBackground — a blurred anime-style nighttime room.
 * Layers: gradient sky → moon → window → LED strips → desk → plants → bokeh → particles → vignette.
 * Everything is rendered with CSS/canvas (no external images) and kept blurred
 * so it never distracts from the interface.
 */
export function CinematicBackground() {
  const isStreaming = useAppStore(s => s.isStreaming);
  const isListening = useAppStore(s => s.isListening);
  const isSpeaking = useAppStore(s => s.isSpeaking);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Floating particles on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.15,
      vy: -(Math.random() * 0.3 + 0.1),
      hue: Math.random() > 0.5 ? 280 : 320,
      alpha: Math.random() * 0.4 + 0.1,
      twinkle: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.twinkle += 0.02;
        if (p.y < -10) {
          p.y = window.innerHeight + 10;
          p.x = Math.random() * window.innerWidth;
        }
        if (p.x < -10) p.x = window.innerWidth + 10;
        if (p.x > window.innerWidth + 10) p.x = -10;
        const flicker = 0.6 + Math.sin(p.twinkle) * 0.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.alpha * flicker})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `hsla(${p.hue}, 80%, 70%, 0.6)`;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ zIndex: 0, pointerEvents: 'none', filter: 'blur(2px)' }}
    >
      {/* ── Deep purple gradient base ── */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(44, 24, 72, 0.7) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 20% 80%, rgba(168, 85, 247, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 60% 50% at 80% 80%, rgba(255, 95, 215, 0.06) 0%, transparent 50%),
            linear-gradient(180deg, #12091F 0%, #1A1030 40%, #23133C 100%)
          `,
        }}
      />

      {/* ── Moon ── */}
      <div
        className="absolute"
        style={{
          top: '8%',
          right: '12%',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #F3E8FF 0%, #E9D5FF 30%, #C4B5FD 60%, transparent 100%)',
          boxShadow: '0 0 60px rgba(196, 181, 253, 0.4), 0 0 120px rgba(168, 85, 247, 0.15)',
          opacity: 0.5,
        }}
      />

      {/* ── Stars ── */}
      <div className="absolute inset-0">
        {Array.from({ length: 30 }).map((_, i) => {
          const seed = i * 137;
          const x = (seed * 7) % 100;
          const y = (seed * 13) % 60;
          const size = ((seed * 3) % 3) + 1;
          const delay = (seed % 50) / 10;
          return (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${size}px`,
                height: `${size}px`,
                opacity: 0.3,
                boxShadow: '0 0 4px rgba(255,255,255,0.5)',
              }}
              animate={{ opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 2 + (seed % 30) / 10, repeat: Infinity, delay }}
            />
          );
        })}
      </div>

      {/* ── Window frame (blurred) ── */}
      <div
        className="absolute"
        style={{
          top: '15%',
          right: '5%',
          width: '220px',
          height: '280px',
          borderRadius: '12px',
          background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.06) 0%, rgba(255, 95, 215, 0.04) 100%)',
          border: '2px solid rgba(255, 255, 255, 0.06)',
          boxShadow: 'inset 0 0 30px rgba(168, 85, 247, 0.08)',
        }}
      >
        {/* Window cross bars */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5" />
      </div>

      {/* ── LED strip — top purple ── */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: '3px',
          background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.5), rgba(255, 95, 215, 0.4), rgba(168, 85, 247, 0.5), transparent)',
          boxShadow: '0 0 20px rgba(168, 85, 247, 0.3), 0 4px 30px rgba(168, 85, 247, 0.15)',
        }}
      />

      {/* ── LED strip — left side pink ── */}
      <div
        className="absolute left-0 top-1/4 bottom-1/4"
        style={{
          width: '2px',
          background: 'linear-gradient(180deg, transparent, rgba(255, 95, 215, 0.4), rgba(168, 85, 247, 0.3), transparent)',
          boxShadow: '0 0 15px rgba(255, 95, 215, 0.2)',
        }}
      />

      {/* ── Desk surface (bottom) ── */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '30%',
          background: 'linear-gradient(180deg, transparent 0%, rgba(26, 16, 48, 0.4) 30%, rgba(35, 19, 60, 0.6) 100%)',
          borderTop: '1px solid rgba(168, 85, 247, 0.06)',
        }}
      />

      {/* ── Plant silhouettes ── */}
      <div
        className="absolute bottom-[10%] left-[3%]"
        style={{ opacity: 0.15 }}
      >
        <svg width="80" height="100" viewBox="0 0 80 100" fill="none">
          <path d="M40 100 Q30 70 20 50 Q15 35 25 25 Q30 15 40 20 Q50 15 55 25 Q65 35 60 50 Q50 70 40 100 Z"
            fill="rgba(168, 85, 247, 0.3)" />
          <path d="M40 100 Q35 80 30 65 Q28 55 35 50 Q40 45 45 50 Q52 55 50 65 Q45 80 40 100 Z"
            fill="rgba(255, 95, 215, 0.2)" />
        </svg>
      </div>
      <div
        className="absolute bottom-[8%] right-[8%]"
        style={{ opacity: 0.12 }}
      >
        <svg width="60" height="80" viewBox="0 0 60 80" fill="none">
          <path d="M30 80 Q20 55 15 40 Q12 28 22 22 Q28 14 30 18 Q32 14 38 22 Q48 28 45 40 Q40 55 30 80 Z"
            fill="rgba(168, 85, 247, 0.25)" />
        </svg>
      </div>

      {/* ── Bokeh circles ── */}
      {[
        { x: 15, y: 30, s: 60, c: 'rgba(168, 85, 247, 0.08)', d: 0 },
        { x: 70, y: 45, s: 90, c: 'rgba(255, 95, 215, 0.06)', d: 1.5 },
        { x: 40, y: 60, s: 50, c: 'rgba(168, 85, 247, 0.07)', d: 3 },
        { x: 85, y: 20, s: 70, c: 'rgba(255, 95, 215, 0.05)', d: 2 },
        { x: 25, y: 70, s: 40, c: 'rgba(168, 85, 247, 0.06)', d: 4 },
      ].map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: `${b.s}px`,
            height: `${b.s}px`,
            background: b.c,
            filter: 'blur(8px)',
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4 + i, repeat: Infinity, delay: b.d, ease: 'easeInOut' }}
        />
      ))}

      {/* ── Floating particles canvas ── */}
      <canvas ref={canvasRef} className="absolute inset-0" style={{ filter: 'none' }} />

      {/* ── Top vignette ── */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(18, 9, 31, 0.2) 0%, transparent 30%, transparent 60%, rgba(18, 9, 31, 0.5) 100%)',
        }}
      />

      {/* ── Streaming glow pulse ── */}
      {isStreaming && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.06, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background: 'radial-gradient(ellipse at 50% 40%, rgba(168, 85, 247, 0.8) 0%, transparent 60%)',
          }}
        />
      )}

      {/* ── Listening pulse ── */}
      {isListening && (
        <motion.div
          className="absolute left-1/2 bottom-[15%]"
          style={{ transform: 'translateX(-50%)' }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.9, 1.4, 0.9], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="w-32 h-32 rounded-full border border-purple-400/40" />
        </motion.div>
      )}

      {/* ── Speaking glow ── */}
      {isSpeaking && (
        <motion.div
          className="absolute left-1/2 bottom-[15%]"
          style={{ transform: 'translateX(-50%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="w-40 h-40 rounded-full bg-pink-500/10 blur-2xl" />
        </motion.div>
      )}
    </div>
  );
}
