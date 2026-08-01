'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/auth';
import { Eye, EyeOff, Mail, Lock, User, Sparkles, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';

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
    <div className="flex min-h-dvh items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md my-auto"
      >
        {/* Logo + title */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            className="relative mb-3"
          >
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-60"
              style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.5) 0%, transparent 70%)' }}
            />
            <div className="relative text-5xl sm:text-6xl">🔐</div>
          </motion.div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Yosseling</h1>
          <p className="text-xs sm:text-sm text-white/50 mt-1">Tu asistente inteligente</p>
        </div>

        <div
          className="rounded-3xl p-5 sm:p-8"
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
                <BackButton onClick={() => { resetState(); setMode('welcome'); }} />
                <h2 className="text-lg font-semibold text-white mb-1">Crear cuenta</h2>
                <p className="text-sm text-white/50 mb-5">Correo y contraseña — seguro y rápido.</p>

                <Field label="¿Cómo te llamas?" icon={<User size={16} />}>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Tu nombre"
                    maxLength={24}
                    className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-white placeholder-white/30 outline-none focus:border-fuchsia-400/50 focus:bg-white/8 transition-colors"
                  />
                </Field>

                <Field label="Correo" icon={<Mail size={16} />}>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    autoComplete="email"
                    className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-white placeholder-white/30 outline-none focus:border-fuchsia-400/50 focus:bg-white/8 transition-colors"
                  />
                </Field>

                <Field label="Contraseña (mín. 6 caracteres)" icon={<Lock size={16} />}>
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
                </Field>

                {/* Avatar picker */}
                <label className="block text-xs font-medium text-white/60 mb-2">Elige tu avatar</label>
                <div className="grid grid-cols-6 gap-2 mb-5">
                  {AVATAR_EMOJIS.map((emoji, i) => (
                    <motion.button
                      key={emoji}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3 + i * 0.03, type: 'spring', stiffness: 300 }}
                      onClick={() => setAvatarEmoji(emoji)}
                      className={`text-2xl aspect-square rounded-xl flex items-center justify-center transition-all ${
                        avatarEmoji === emoji
                          ? 'bg-fuchsia-500/30 border-2 border-fuchsia-400/60 scale-110'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </div>

                <ErrorBanner error={error} />

                <SubmitButton
                  onClick={handleRegister}
                  disabled={isLoading || !isValidEmail(email) || password.length < 6 || displayName.trim().length < 2}
                  loading={isLoading}
                  loadingText="Creando..."
                >
                  Crear cuenta
                </SubmitButton>
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
                <BackButton onClick={() => { resetState(); setMode('welcome'); }} />
                <h2 className="text-lg font-semibold text-white mb-1">Iniciar sesión</h2>
                <p className="text-sm text-white/50 mb-5">Bienvenido de vuelta.</p>

                <Field label="Correo" icon={<Mail size={16} />}>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    autoComplete="email"
                    className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-white placeholder-white/30 outline-none focus:border-fuchsia-400/50 focus:bg-white/8 transition-colors"
                  />
                </Field>

                <Field label="Contraseña" icon={<Lock size={16} />}>
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
                </Field>

                <ErrorBanner error={error} />

                <SubmitButton
                  onClick={handleLogin}
                  disabled={isLoading || !isValidEmail(email) || password.length < 1}
                  loading={isLoading}
                  loadingText="Entrando..."
                >
                  Entrar
                </SubmitButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-xs text-white/30 mt-5 flex items-center justify-center gap-1.5"
        >
          <ShieldCheck size={12} />
          Sesión protegida con cookies HttpOnly
        </motion.p>
      </motion.div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function WelcomeView({ onRegister, onLogin }: { onRegister: () => void; onLogin: () => void }) {
  const features = [
    { icon: '💬', text: 'Chat con IA multimodal' },
    { icon: '🔍', text: 'Búsqueda en tiempo real' },
    { icon: '🎨', text: 'Generación de imágenes' },
    { icon: '🔐', text: 'Sesión segura y persistente' },
  ];

  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-lg font-semibold text-white mb-2 text-center">Bienvenido a Yosseling</h2>
      <p className="text-sm text-white/50 mb-5 leading-relaxed text-center">
        Crea tu cuenta con <span className="text-fuchsia-300 font-medium">correo y contraseña</span> —
        seguro, rápido y listo para producción.
      </p>

      {/* Feature list */}
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {features.map((f, i) => (
          <motion.div
            key={f.text}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.08, type: 'spring', stiffness: 200 }}
            className="flex items-center gap-2 p-2.5 rounded-xl"
            style={{
              background: 'rgba(168, 85, 247, 0.06)',
              border: '1px solid rgba(168, 85, 247, 0.1)',
            }}
          >
            <span className="text-lg">{f.icon}</span>
            <span className="text-xs text-white/70 font-medium">{f.text}</span>
          </motion.div>
        ))}
      </div>

      <div className="space-y-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRegister}
          className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 transition-all flex items-center justify-center gap-2"
        >
          Crear cuenta
          <ArrowRight size={16} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onLogin}
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3.5 font-semibold text-white/80 hover:bg-white/10 transition-all"
        >
          Ya tengo cuenta
        </motion.button>
      </div>
    </motion.div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-white/60 mb-2">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-sm text-red-400 mb-4 text-center bg-red-500/10 rounded-lg py-2 px-3"
    >
      {error}
    </motion.p>
  );
}

function SubmitButton({
  onClick,
  disabled,
  loading,
  loadingText,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  loadingText: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
    >
      {loading ? (
        <>
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
            className="inline-block"
          >
            <Sparkles size={16} />
          </motion.span>
          {loadingText}
        </>
      ) : (
        children
      )}
    </motion.button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70 mb-4 transition-colors"
    >
      <ArrowLeft size={14} />
      Volver
    </button>
  );
}
