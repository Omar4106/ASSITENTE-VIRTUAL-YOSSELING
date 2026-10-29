import './globals.css';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const CapacitorAuthListener = dynamic(
  () => import('@/components/auth/CapacitorAuthListener'),
  { ssr: false }
);

const ServiceWorkerRegistration = dynamic(
  () => import('@/components/pwa/ServiceWorkerRegistration'),
  { ssr: false }
);

const AuthSessionSync = dynamic(
  () => import('@/components/auth/AuthSessionSync'),
  { ssr: false }
);

export const metadata: Metadata = {
  metadataBase: new URL('https://asistente-virtual-yosseling.vercel.app'),
  title: 'Yosseling — Tu Asistente Inteligente',
  description: 'Yosseling es tu asistente virtual inteligente, rápida y capaz.',
  icons: { icon: '/assets/images/logo_de_yosseling_sin_fondo_.png' },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    title: 'Yosseling — Tu Asistente Inteligente',
    description: 'Yosseling es tu asistente virtual inteligente, rápida y capaz.',
    siteName: 'Yosseling',
    images: [{
      url: '/assets/images/yosseling-social.png',
      width: 1200,
      height: 630,
      alt: 'Yosseling — Tu Asistente Inteligente',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yosseling — Tu Asistente Inteligente',
    description: 'Yosseling es tu asistente virtual inteligente, rápida y capaz.',
    images: ['/assets/images/yosseling-social.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className="font-sans dark" suppressHydrationWarning>
        <AuthSessionSync />
        <CapacitorAuthListener />
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
