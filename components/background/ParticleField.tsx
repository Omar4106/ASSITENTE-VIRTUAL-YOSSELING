'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number; alpha: number;
  maxAlpha: number;
  color: string;
  type: 'dust' | 'sparkle' | 'crystal';
  life: number; maxLife: number;
  twinklePhase: number;
}

interface Props {
  isListening?: boolean;
  isStreaming?: boolean;
  mouseX?: number;
  mouseY?: number;
}

const COLORS = [
  'rgba(168,85,247,',   // purple
  'rgba(79,157,255,',   // blue
  'rgba(220,180,255,',  // light purple
  'rgba(150,200,255,',  // light blue
  'rgba(255,255,255,',  // white
];

function spawnParticle(W: number, H: number, intensity: number): Particle {
  const type = Math.random() < 0.6 ? 'dust' : Math.random() < 0.7 ? 'sparkle' : 'crystal';
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const maxLife = 4000 + Math.random() * 8000;
  return {
    x: Math.random() * W,
    y: H + 10,
    vx: (Math.random() - 0.5) * 0.3 * intensity,
    vy: -(0.1 + Math.random() * 0.4) * intensity,
    r: type === 'crystal' ? 1.5 + Math.random() * 2 : 0.5 + Math.random() * 1.5,
    alpha: 0,
    maxAlpha: (type === 'sparkle' ? 0.7 : 0.35) * (0.5 + Math.random() * 0.5),
    color,
    type,
    life: 0,
    maxLife,
    twinklePhase: Math.random() * Math.PI * 2,
  };
}

export function ParticleField({ isListening, isStreaming, mouseX = 0.5, mouseY = 0.5 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const lastSpawnRef = useRef(0);

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

    const MAX = isListening ? 80 : isStreaming ? 60 : 40;
    const SPAWN_INTERVAL = isListening ? 60 : isStreaming ? 80 : 120;

    const draw = (t: number) => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Spawn
      if (t - lastSpawnRef.current > SPAWN_INTERVAL && particlesRef.current.length < MAX) {
        lastSpawnRef.current = t;
        const intensity = isListening ? 1.5 : isStreaming ? 1.2 : 1.0;
        particlesRef.current.push(spawnParticle(W, H, intensity));
      }

      // Mouse pull — subtle drift toward cursor
      const mx = mouseX * W;
      const my = mouseY * H;

      particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife && p.y > -20);

      for (const p of particlesRef.current) {
        p.life += 16;
        const lifeRatio = p.life / p.maxLife;
        // fade in/out
        if (lifeRatio < 0.15) p.alpha = (lifeRatio / 0.15) * p.maxAlpha;
        else if (lifeRatio > 0.75) p.alpha = ((1 - lifeRatio) / 0.25) * p.maxAlpha;
        else p.alpha = p.maxAlpha;

        // Gentle mouse attraction
        const dx = mx - p.x;
        const dy = my - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          p.vx += (dx / dist) * 0.003;
          p.vy += (dy / dist) * 0.003;
        }

        // Dampen
        p.vx *= 0.99;
        p.vy *= 0.99;

        p.x += p.vx;
        p.y += p.vy;

        const twinkle = p.type === 'sparkle'
          ? 0.5 + Math.sin(t * 0.005 + p.twinklePhase) * 0.5
          : 1;

        ctx.save();
        ctx.globalAlpha = p.alpha * twinkle;

        if (p.type === 'crystal') {
          // Diamond shape
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - p.r * 2);
          ctx.lineTo(p.x + p.r, p.y);
          ctx.lineTo(p.x, p.y + p.r * 2);
          ctx.lineTo(p.x - p.r, p.y);
          ctx.closePath();
          ctx.fillStyle = `${p.color}${p.alpha * twinkle})`;
          ctx.fill();
        } else if (p.type === 'sparkle') {
          // Star shape
          const spikes = 4;
          const outerR = p.r * 1.5;
          const innerR = p.r * 0.4;
          ctx.beginPath();
          for (let i = 0; i < spikes * 2; i++) {
            const angle = (i * Math.PI) / spikes + t * 0.001;
            const r = i % 2 === 0 ? outerR : innerR;
            i === 0 ? ctx.moveTo(p.x + r * Math.cos(angle), p.y + r * Math.sin(angle))
                     : ctx.lineTo(p.x + r * Math.cos(angle), p.y + r * Math.sin(angle));
          }
          ctx.closePath();
          ctx.fillStyle = `${p.color}${p.alpha * twinkle})`;
          ctx.fill();
        } else {
          // Soft dust circle
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          grad.addColorStop(0, `${p.color}${p.alpha})`);
          grad.addColorStop(1, `${p.color}0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isListening, isStreaming, mouseX, mouseY]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none' }}
    />
  );
}
