'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('[Yosseling] Service worker registration failed:', error);
    });
  }, []);

  return null;
}
