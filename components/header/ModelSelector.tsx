'use client';

import { motion } from 'framer-motion';
import { Gauge, Zap } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function ModelSelector() {
  const { selectedProvider, setSelectedModel } = useAppStore();

  const isFast = selectedProvider === 'groq';

  const toggle = () => {
    if (isFast) {
      setSelectedModel('auto', 'auto');
    } else {
      setSelectedModel('llama-3.3-70b-versatile', 'groq');
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={toggle}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all select-none',
        isFast
          ? 'bg-gradient-to-r from-orange-500/20 to-orange-600/10 border-orange-500/40'
          : 'bg-[#171923] border-white/[0.06] hover:border-purple-500/30'
      )}
      aria-label={isFast ? 'Ultra Rápido activo, tocar para desactivar' : 'Modo automático, tocar para activar Ultra Rápido'}
    >
      {isFast ? (
        <Gauge size={13} className="text-orange-400" />
      ) : (
        <Zap size={13} className="text-purple-400" />
      )}
      <span className={cn(
        'text-sm font-semibold transition-colors',
        isFast ? 'text-orange-300' : 'text-white'
      )}>
        {isFast ? 'Ultra Rápido' : 'Automático'}
      </span>

      {/* Toggle switch visual */}
      <span
        className={cn(
          'relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0',
          isFast ? 'bg-orange-500/60' : 'bg-white/10'
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={cn(
            'inline-block h-3 w-3 rounded-full shadow-md',
            isFast ? 'bg-orange-300' : 'bg-white/60'
          )}
          style={{ marginLeft: isFast ? '14px' : '2px' }}
        />
      </span>
    </motion.button>
  );
}
