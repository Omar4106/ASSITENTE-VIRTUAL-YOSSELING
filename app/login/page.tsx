'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { CinematicBackground } from '@/components/background/CinematicBackground';

export default function LoginPage() {
  const router = useRouter();
  const { login, user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace('/');
  }, [authLoading, user, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push('/');
    }
  };

  return (
    <>
      <CinematicBackground />
      <div className="relative flex min-h-screen items-center justify-center px-4" style={{ zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div
            className="rounded-3xl p-8 border border-white/[0.08] shadow-2xl"
            style={{
              background: 'rgba(10,8,20,0.82)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
            }}
          >
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center mb-3 shadow-lg shadow-purple-500/30">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Bienvenida de nuevo</h1>
              <p className="text-sm text-[#B3B3B3] mt-1">Inicia sesion para continuar con Yosseling</p>
            </div>

            {/* Error alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-5"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-sm text-red-300">{error}</span>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#B3B3B3] block mb-1.5">Correo electronico</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B3B3B3]" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    disabled={loading}
                    autoComplete="email"
                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-[#B3B3B3]/40 outline-none focus:border-purple-500/50 focus:bg-white/[0.07] transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[#B3B3B3] block mb-1.5">Contrasena</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B3B3B3]" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="********"
                    disabled={loading}
                    autoComplete="current-password"
                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-[#B3B3B3]/40 outline-none focus:border-purple-500/50 focus:bg-white/[0.07] transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: loading ? 1 : 1.01 }}
                whileTap={{ scale: loading ? 1 : 0.99 }}
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-medium rounded-xl py-3 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Iniciando sesion...
                  </>
                ) : (
                  <>
                    Iniciar sesion
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Switch to register */}
            <p className="text-center text-sm text-[#B3B3B3] mt-6">
              No tienes una cuenta?{' '}
              <Link href="/register" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Registrate aqui
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
}
