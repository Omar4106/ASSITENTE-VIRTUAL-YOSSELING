'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/auth';
import { Eye, EyeOff, Mail, Lock, User, Sparkles } from 'lucide-react';

const AVATAR_EMOJIS = ['🌟', '🦋', '🦊', '🦉', '🐉', '🦄', '🐱', '🐺', '💎', '🔥', '⚡', '🌙'];

type Mode = 'welcome' | 'register' | 'login';

export function AuthScreen() {
  const { register, login, isLoading, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<Mode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState(AVATAR_EMOJIS[0]);

  const resetState = useCallback(() => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setAvatarEmoji(AVATAR_EMOJIS[0]);
    setShowPassword(false);
    clearError();
  }, [clearError]);

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const handleRegister = useCallback(async () => {
    if (!isValidEmail(email)) return;
    if (password.length < 6) return;
    if (displayName.trim().length < 2) return;
    const result = await register(email.trim(), password, displayName.trim(), avatarEmoji);
    if (result.success) resetState();
  }, [email, password, displayName, avatarEmoji, register, resetState]);

  const handleLogin = useCallback(async () => {
    if (!isValidEmail(email)) return;
    if (password.length < 1) return;
    const result = await login(email.trim(), password);
    if (result.success) resetState();
  }, [email, password, login, resetState]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        {/* Logo + title */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            className="text-6xl mb-3"
          >
            🔐
          </motion.div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Yosseling</h1>
          <p className="text-sm text-white/50 mt-1">Tu asistente inteligente</p>
        </div>

        <div
          className="rounded-3xl p-6 sm:p-8"
          style={{
            background: 'rgba(18, 9, 31, 0.75)',
            backdropFilter: 'blur(28px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
          }}
        >
          <AnimatePresence mode="wait">
            {mode === 'welcome' && (
              <WelcomeView
                key="welcome"
                onRegister={() => { resetState(); setMode('register'); }}
                onLogin={() => { resetState(); setMode('login'); }}
              />
            )}

            {mode === 'register' && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-lg font-semibold text-white mb-1">Crear cuenta</h2>
                <p className="text-sm text-white/50 mb-6">Correo y contraseña — seguro y rápido.</p>

                {/* Display name */}
                <label className="block text-xs font-medium text-white/60 mb-2">¿Cómo te llamas?</label>
                <div className="relative mb-4">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Tu nombre"
                    maxLength={24}
                    className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-white placeholder-white/30 outline-none focus:border-fuchsia-400/50 focus:bg-white/8 transition-colors"
                  />
                </div>

                {/* Email */}
                <label className="block text-xs font-medium text-white/60 mb-2">Correo</label>
                <div className="relative mb-4">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    autoComplete="email"
                    className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-white placeholder-white/30 outline-none focus:border-fuchsia-400/50 focus:bg-white/8 transition-colors"
                  />
                </div>

                {/* Password */}
                <label className="block text-xs font-medium text-white/60 mb-2">Contraseña (mín. 6 caracteres)</label>
                <div className="relative mb-4">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-10 py-3 text-white placeholder-white/30 outline-none focus:border-fuchsia-400/50 focus:bg-white/8 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Avatar picker */}
                <label className="block text-xs font-medium text-white/60 mb-2">Elige tu avatar</label>
                <div className="flex flex-wrap gap-2 mb-6">
                  {AVATAR_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setAvatarEmoji(emoji)}
                      className={`text-2xl w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                        avatarEmoji === emoji
                          ? 'bg-fuchsia-500/30 border-2 border-fuchsia-400/60 scale-110'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-400 mb-4 text-center"
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  onClick={handleRegister}
                  disabled={isLoading || !isValidEmail(email) || password.length < 6 || displayName.trim().length < 2}
                  className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
                >
                  {isLoading ? 'Creando...' : 'Crear cuenta'}
                </button>

                <button
                  onClick={() => { resetState(); setMode('welcome'); }}
                  className="w-full text-sm text-white/40 hover:text-white/60 mt-4 transition-colors"
                >
                  Volver
                </button>
              </motion.div>
            )}

            {mode === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-lg font-semibold text-white mb-1">Iniciar sesión</h2>
                <p className="text-sm text-white/50 mb-6">Bienvenido de vuelta.</p>

                {/* Email */}
                <label className="block text-xs font-medium text-white/60 mb-2">Correo</label>
                <div className="relative mb-4">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    autoComplete="email"
                    className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-white placeholder-white/30 outline-none focus:border-fuchsia-400/50 focus:bg-white/8 transition-colors"
                  />
                </div>

                {/* Password */}
                <label className="block text-xs font-medium text-white/60 mb-2">Contraseña</label>
                <div className="relative mb-4">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-10 py-3 text-white placeholder-white/30 outline-none focus:border-fuchsia-400/50 focus:bg-white/8 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-400 mb-4 text-center"
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  onClick={handleLogin}
                  disabled={isLoading || !isValidEmail(email) || password.length < 1}
                  className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
                >
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </button>

                <button
                  onClick={() => { resetState(); setMode('welcome'); }}
                  className="w-full text-sm text-white/40 hover:text-white/60 mt-4 transition-colors"
                >
                  Volver
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-white/30 mt-6 flex items-center justify-center gap-1.5">
          <Sparkles size={12} />
          Sesión protegida con cookies HttpOnly · Listo para producción
        </p>
      </motion.div>
    </div>
  );
}

function WelcomeView({ onRegister, onLogin }: { onRegister: () => void; onLogin: () => void }) {
  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.3 }}
      className="text-center"
    >
      <h2 className="text-lg font-semibold text-white mb-2">Bienvenido a Yosseling</h2>
      <p className="text-sm text-white/50 mb-8 leading-relaxed">
        Crea tu cuenta con <span className="text-fuchsia-300 font-medium">correo y contraseña</span> —
        seguro, rápido y listo para producción.
      </p>

      <div className="space-y-3">
        <button
          onClick={onRegister}
          className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Crear cuenta
        </button>
        <button
          onClick={onLogin}
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3.5 font-semibold text-white/80 hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Ya tengo cuenta
        </button>
      </div>
    </motion.div>
  );
}
