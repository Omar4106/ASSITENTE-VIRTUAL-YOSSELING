'use client';

import { Cloud, Cpu } from 'lucide-react';
import { useConnectivity } from '@/hooks/useConnectivity';
import { getOfflineConfig } from '@/lib/yosseling-engine';

export function OfflineStatus() {
  const online = useConnectivity();
  const local = !online;

  return (
    <div
      title={local ? 'Yosseling está usando el modo local' : 'Yosseling está conectado a la nube'}
      className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
        local ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'
      }`}
    >
      {local ? <Cpu size={11} className="text-amber-300" /> : <Cloud size={11} className="text-green-300" />}
      <span className={`text-[10px] font-medium ${local ? 'text-amber-300' : 'text-green-300'}`}>
        {local ? 'Modo local' : 'Modo nube'}
      </span>
    </div>
  );
}
