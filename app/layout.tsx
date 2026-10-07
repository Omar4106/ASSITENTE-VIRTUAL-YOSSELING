import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://asistente-virtual-yosseling.vercel.app'),
  title: 'Yosseling — Tu Asistente Inteligente',
  description: 'Yosseling es tu asistente virtual inteligente, rápida y capaz.',
  icons: { icon: '/assets/images/logo_de_yosseling_sin_fondo_.png' },
  manifest: '/manifest.webmanifest',
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
    <html lang="es" className="dark">
      <body className={`${inter.variable} font-sans dark`} suppressHydrationWarning>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
