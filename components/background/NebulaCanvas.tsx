'use client';

import { useEffect, useRef } from 'react';

interface Props {
  isListening?: boolean;
  isStreaming?: boolean;
}

export function NebulaCanvas({ isListening, isStreaming }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const orbs: Array<{
      x: number; y: number; r: number;
      colorA: string; colorB: string;
      dx: number; dy: number; phase: number;
    }> = [
      { x: 0.15, y: 0.3,  r: 0.45, colorA: 'rgba(76,0,180,0.18)',  colorB: 'rgba(0,0,0,0)',        dx: 0.00008, dy: 0.00005, phase: 0 },
      { x: 0.85, y: 0.7,  r: 0.40, colorA: 'rgba(30,80,220,0.14)', colorB: 'rgba(0,0,0,0)',        dx:-0.00006, dy: 0.00004, phase: 1.2 },
      { x: 0.5,  y: 0.9,  r: 0.35, colorA: 'rgba(120,0,200,0.12)', colorB: 'rgba(0,0,0,0)',        dx: 0.00004, dy:-0.00007, phase: 2.4 },
      { x: 0.7,  y: 0.1,  r: 0.30, colorA: 'rgba(0,120,255,0.10)', colorB: 'rgba(0,0,0,0)',        dx:-0.00005, dy: 0.00006, phase: 0.8 },
      { x: 0.3,  y: 0.8,  r: 0.25, colorA: 'rgba(200,80,255,0.10)',colorB: 'rgba(0,0,0,0)',        dx: 0.00007, dy:-0.00004, phase: 1.8 },
    ];

    const draw = (t: number) => {
      timeRef.current = t;
      const W = canvas.width;
      const H = canvas.height;
      const intensity = isListening ? 1.4 : isStreaming ? 1.2 : 1.0;

      ctx.clearRect(0, 0, W, H);

      // Deep space base
      const base = ctx.createLinearGradient(0, 0, W, H);
      base.addColorStop(0, '#050508');
      base.addColorStop(0.4, '#070512');
      base.addColorStop(0.7, '#060410');
      base.addColorStop(1, '#040308');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, W, H);

      // Animated nebula orbs
      for (const orb of orbs) {
        const x = (orb.x + Math.sin(t * orb.dx * 1000 + orb.phase) * 0.08) * W;
        const y = (orb.y + Math.cos(t * orb.dy * 1000 + orb.phase) * 0.06) * H;
        const r = orb.r * Math.min(W, H) * intensity;
        const pulse = 1 + Math.sin(t * 0.0006 + orb.phase) * 0.06;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * pulse);
        grad.addColorStop(0, orb.colorA);
        grad.addColorStop(1, orb.colorB);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // Aurora streaks
      const auroraT = t * 0.0003;
      for (let i = 0; i < 3; i++) {
        const aX = W * (0.2 + i * 0.3 + Math.sin(auroraT + i * 1.2) * 0.1);
        const aY1 = H * 0.0;
        const aY2 = H * 0.6;
        const aurora = ctx.createLinearGradient(aX, aY1, aX + 40, aY2);
        aurora.addColorStop(0, 'rgba(100,20,220,0)');
        aurora.addColorStop(0.3, `rgba(${80 + i*30},${10 + i*15},${200 + i*20},${(0.04 + Math.sin(auroraT + i) * 0.02) * intensity})`);
        aurora.addColorStop(0.6, `rgba(30,60,200,${(0.03 + Math.sin(auroraT * 1.3 + i) * 0.015) * intensity})`);
        aurora.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = aurora;
        ctx.beginPath();
        const w = 80 + Math.sin(auroraT * 0.7 + i) * 30;
        ctx.ellipse(aX, H * 0.3, w, H * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Center glow — where Yosseling stands
      const centerGlow = ctx.createRadialGradient(W * 0.5, H * 0.55, 0, W * 0.5, H * 0.55, W * 0.3);
      const glowAlpha = (0.06 + Math.sin(t * 0.0008) * 0.02) * intensity;
      centerGlow.addColorStop(0, `rgba(140,60,255,${glowAlpha})`);
      centerGlow.addColorStop(0.5, `rgba(80,30,180,${glowAlpha * 0.5})`);
      centerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, W, H);

      // Response pulse — light burst when Yosseling is answering
      if (isStreaming) {
        const pAlpha = 0.06 + Math.sin(t * 0.004) * 0.04;
        const pulseR = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.4, W * 0.25);
        pulseR.addColorStop(0, `rgba(180,100,255,${pAlpha})`);
        pulseR.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pulseR;
        ctx.fillRect(0, 0, W, H);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isListening, isStreaming]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none' }}
    />
  );
}
