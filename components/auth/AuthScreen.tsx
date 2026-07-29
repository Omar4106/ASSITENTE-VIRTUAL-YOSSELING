'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const EMOJI_POOL = [
  '🌟', '🌙', '☀️', '🔥', '⚡', '❄️', '🌈', '💫',
  '🦋', '🌸', '🌺', '🌻', '🌹', '🍀', '🌿', '🌊',
  '🐱', '🦊', '🐺', '🦉', '🦅', '🐉', '🦄', '🐝',
  '💎', '🔮', '🎭', '🎨', '🎵', '🎸', '🎹', '🥁',
  '🚀', '🌍', '🔭', '⭐', '✨', '🎈', '🎁', '🏆',
  '🍕', '🌮', '🍣', '🍓', '🫐', '🥑', '☕', '🍫',
  '⚽', '🏀', '🎮', '🎲', '♟️', '🎯', '🎳', '🧩',
  '💡', '📖', '✏️', '🔑', '🔒', '🧊', '🌋', '🗺️',
];

const AVATAR_EMOJIS = ['🌟', '🦋', '🦊', '🦉', '🐉', '🦄', '🐱', '🐺', '💎', '🔥', '⚡', '🌙'];

const SEAL_MIN = 4;
const SEAL_MAX = 8;

type Mode = 'welcome' | 'register' | 'login';

export function AuthScreen() {
  const { user, init, register, login, logout, isLoading, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<Mode>('welcome');
  const [displayName, setDisplayName] = useState('');
  const [seal, setSeal] = useState<string[]>([]);
  const [avatarEmoji, setAvatarEmoji] = useState(AVATAR_EMOJIS[0]);
  const [loginHint, setLoginHint] = useState<string | null>(null);

  useEffect(() => { init(); }, [init]);

  const resetState = useCallback(() => {
    setSeal([]);
    setDisplayName('');
    setAvatarEmoji(AVATAR_EMOJIS[0]);
    setLoginHint(null);
    clearError();
  }, [clearError]);

  const handleAddEmoji = useCallback((emoji: string) => {
    setSeal(prev => prev.length < SEAL_MAX ? [...prev, emoji] : prev);
  }, []);

  const handleRemoveLast = useCallback(() => {
    setSeal(prev => prev.slice(0, -1));
  }, []);

  const handleClearSeal = useCallback(() => {
    setSeal([]);
  }, []);

  const handleRegister = useCallback(async () => {
    if (displayName.trim().length < 2) return;
    if (seal.length < SEAL_MIN) return;
    const result = await register(displayName.trim(), seal, avatarEmoji);
    if (result.success) resetState();
  }, [displayName, seal, avatarEmoji, register, resetState]);

  const handleLogin = useCallback(async () => {
    if (displayName.trim().length < 2) return;
    if (seal.length < SEAL_MIN) return;
    const result = await login(displayName.trim(), seal);
    if (result.success) resetState();
  }, [displayName, seal, login, resetState]);

  const handleNameLookup = useCallback(async (name: string) => {
    if (name.trim().length < 2) { setLoginHint(null); return; }
    const { data } = await supabase
      .from('user_seals')
      .select('seal_emoji_count, seal_first_emoji')
      .eq('display_name', name.trim())
      .maybeSingle();
    if (data) {
      setLoginHint(`Tu sello tiene ${data.seal_emoji_count} emojis y empieza con ${data.seal_first_emoji}`);
    } else {
      setLoginHint(null);
    }
  }, []);

  if (user) {
    return (
      <AuthGate user={user} onLogout={logout} />
    );
  }

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
              <WelcomeView key="welcome" onRegister={() => { resetState(); setMode('register'); }} onLogin={() => { resetState(); setMode('login'); }} />
            )}

            {mode === 'register' && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-lg font-semibold text-white mb-1">Crea tu Sello de Emojis</h2>
                <p className="text-sm text-white/50 mb-6">Sin correos ni contraseñas. Tu sello es tu llave.</p>

                {/* Name input */}
                <label className="block text-xs font-medium text-white/60 mb-2">¿Cómo te llamas?</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Tu nombre"
                  maxLength={24}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-fuchsia-400/50 focus:bg-white/8 transition-colors mb-5"
                />

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

                {/* Seal display */}
                <label className="block text-xs font-medium text-white/60 mb-2">
                  Tu sello ({seal.length}/{SEAL_MAX}) — mínimo {SEAL_MIN}
                </label>
                <div className="rounded-2xl bg-black/30 border border-white/10 p-4 mb-4 min-h-[72px] flex items-center gap-2 flex-wrap">
                  <AnimatePresence>
                    {seal.length === 0 && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-white/30 text-sm"
                      >
                        Selecciona emojis para crear tu sello...
                      </motion.p>
                    )}
                    {seal.map((emoji, i) => (
                      <motion.div
                        key={`${emoji}-${i}`}
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="text-3xl"
                      >
                        {emoji}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Seal controls */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={handleRemoveLast}
                    disabled={seal.length === 0}
                    className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Deshacer
                  </button>
                  <button
                    onClick={handleClearSeal}
                    disabled={seal.length === 0}
                    className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Limpiar
                  </button>
                </div>

                {/* Emoji grid */}
                <div className="grid grid-cols-8 gap-1.5 mb-6 max-h-[200px] overflow-y-auto rounded-xl p-2 bg-black/20">
                  {EMOJI_POOL.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleAddEmoji(emoji)}
                      className="text-2xl aspect-square rounded-lg hover:bg-white/10 hover:scale-110 active:scale-95 transition-all"
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
                  disabled={isLoading || displayName.trim().length < 2 || seal.length < SEAL_MIN}
                  className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
                >
                  {isLoading ? 'Creando...' : 'Crear mi sello'}
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
                <h2 className="text-lg font-semibold text-white mb-1">Reproduce tu Sello</h2>
                <p className="text-sm text-white/50 mb-6">Tu nombre + tu sello de emojis para entrar.</p>

                {/* Name input */}
                <label className="block text-xs font-medium text-white/60 mb-2">Tu nombre</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => {
                    setDisplayName(e.target.value);
                    handleNameLookup(e.target.value);
                  }}
                  placeholder="El nombre con el que te registraste"
                  maxLength={24}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-fuchsia-400/50 focus:bg-white/8 transition-colors mb-2"
                />
                {loginHint && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-xs text-fuchsia-300/70 mb-4 px-1"
                  >
                    {loginHint}
                  </motion.p>
                )}

                {!loginHint && <div className="mb-4" />}

                {/* Seal display */}
                <label className="block text-xs font-medium text-white/60 mb-2">
                  Tu sello ({seal.length}/{SEAL_MAX})
                </label>
                <div className="rounded-2xl bg-black/30 border border-white/10 p-4 mb-4 min-h-[72px] flex items-center gap-2 flex-wrap">
                  <AnimatePresence>
                    {seal.length === 0 && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-white/30 text-sm"
                      >
                        Selecciona los emojis de tu sello...
                      </motion.p>
                    )}
                    {seal.map((emoji, i) => (
                      <motion.div
                        key={`${emoji}-${i}`}
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="text-3xl"
                      >
                        {emoji}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Seal controls */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={handleRemoveLast}
                    disabled={seal.length === 0}
                    className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Deshacer
                  </button>
                  <button
                    onClick={handleClearSeal}
                    disabled={seal.length === 0}
                    className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Limpiar
                  </button>
                </div>

                {/* Emoji grid */}
                <div className="grid grid-cols-8 gap-1.5 mb-6 max-h-[200px] overflow-y-auto rounded-xl p-2 bg-black/20">
                  {EMOJI_POOL.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleAddEmoji(emoji)}
                      className="text-2xl aspect-square rounded-lg hover:bg-white/10 hover:scale-110 active:scale-95 transition-all"
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
                  onClick={handleLogin}
                  disabled={isLoading || displayName.trim().length < 2 || seal.length < SEAL_MIN}
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
        Para entrar, necesitas un <span className="text-fuchsia-300 font-medium">Sello de Emojis</span> —
        una secuencia personal de emojis que reemplaza a las contraseñas.
        Sin correos, sin números, sin letras.
      </p>

      <div className="space-y-3">
        <button
          onClick={onRegister}
          className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Crear mi sello
        </button>
        <button
          onClick={onLogin}
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3.5 font-semibold text-white/80 hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Ya tengo un sello
        </button>
      </div>
    </motion.div>
  );
}

function AuthGate({ user, onLogout }: { user: { display_name: string; avatar_emoji: string }; onLogout: () => void }) {
  return null;
}
