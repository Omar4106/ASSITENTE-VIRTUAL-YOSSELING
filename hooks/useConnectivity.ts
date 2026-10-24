'use client';

import { useEffect, useState, useCallback } from 'react';
import { getOfflineConfig } from '@/lib/yosseling-engine';

interface ConnectivityState {
  online: boolean;
  ollamaAvailable: boolean | null;
  pinging: boolean;
}

export function useConnectivity(): ConnectivityState {
  const [online, setOnline] = useState(true);
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null);
  const [pinging, setPinging] = useState(false);

  const pingOllama = useCallback(async () => {
    const config = getOfflineConfig();
    const url = config.ollamaUrl.replace(/\/$/, '');
    const targetsLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);

    if (targetsLocalhost) {
      setPinging(true);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`${url}/api/tags`, {
          mode: 'cors',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        setOllamaAvailable(res.ok);
      } catch {
        setOllamaAvailable(false);
      } finally {
        setPinging(false);
      }
      return;
    }

    setOllamaAvailable(false);
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