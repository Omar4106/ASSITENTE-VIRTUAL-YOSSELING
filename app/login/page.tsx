'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/auth';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { CinematicBackground } from '@/components/background/CinematicBackground';

export default function LoginPage() {
  const { init, isReady } = useAuthStore();

  useEffect(() => { init(); }, [init]);

  if (!isReady) {
    return (
      <>
        <CinematicBackground />
        <div className="relative flex h-dvh items-center justify-center" style={{ zIndex: 1 }}>
          <div className="text-5xl animate-pulse">🔐</div>
        </div>
      </>
    );
  }

  return (
    <>
      <CinematicBackground />
      <div className="relative" style={{ zIndex: 1 }}>
        <AuthScreen />
      </div>
    </>
  );
}
