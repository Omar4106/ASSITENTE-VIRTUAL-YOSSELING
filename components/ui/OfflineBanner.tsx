'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const updateConnection = () => setIsOffline(!navigator.onLine);

    updateConnection();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);

    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-200/20 bg-zinc-950/90 px-4 py-2 text-xs font-medium text-amber-100 shadow-xl shadow-black/30 backdrop-blur-md transition-all duration-300 ${
        isOffline
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none -translate-y-3 opacity-0'
      }`}
    >
      <WifiOff size={15} aria-hidden="true" />
      <span>Modo Sin Conexión Activado (Funciones locales activas)</span>
    </div>
  );
}
