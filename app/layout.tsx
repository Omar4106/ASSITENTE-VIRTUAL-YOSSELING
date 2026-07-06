import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Yosseling — Tu Asistente Inteligente',
  description: 'Yosseling es tu asistente virtual inteligente, rápida y capaz. Potenciada por OpenAI, Gemini y Groq.',
  icons: { icon: '/assets/images/logo_de_yosseling_sin_fondo_.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.variable} font-sans dark`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
