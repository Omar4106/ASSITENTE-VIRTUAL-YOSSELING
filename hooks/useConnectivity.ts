'use client';

import { useEffect, useState, useCallback } from 'react';
import { getOfflineConfig } from '@/lib/yosseling-engine';

interface ConnectivityState {
  online: boolean;
  ollamaAvailable: boolean | null;
  pinging: boolean;
}

/**
 * Tracks browser online/offline state and performs a non-blocking background
 * ping to Ollama (localhost:11434) to check local engine availability.
 */
export function useConnectivity(): ConnectivityState {
  const [online, setOnline] = useState(true);
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null);
  const [pinging, setPinging] = useState(false);

  const pingOllama = useCallback(async () => {
    const config = getOfflineConfig();
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const targetsLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(config.ollamaUrl);

    if (isMobile && targetsLocalhost) {
      setOllamaAvailable(false);
      return;
    }

    setPinging(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${config.ollamaUrl.replace(/\/$/, '')}/api/version`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setOllamaAvailable(res.ok);
    } catch {
      setOllamaAvailable(false);
    } finally {
      setPinging(false);
    }
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    pingOllama();

    const onOnline = () => {
      setOnline(true);
      pingOllama();
    };
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('online', onOnline);
    };
  }, [pingOllama]);

  return { online, ollamaAvailable, pinging };
}
