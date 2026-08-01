'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/auth';
import {
  Eye, EyeOff, Mail, Lock, Sparkles, ArrowRight, ArrowLeft,
  Check, Flame, Gem, Shield,
} from 'lucide-react';

const SEAL_SYMBOLS = [
  { emoji: '🌟', name: 'Estrella',    color: '#FBBF24' },
  { emoji: '🦋', name: 'Mariposa',    color: '#A78BFA' },
  { emoji: '🦊', name: 'Zorro',       color: '#FB923C' },
  { emoji: '🦉', name: 'Búho',        color: '#818CF8' },
  { emoji: '🐉', name: 'Dragón',       color: '#34D399' },
  { emoji: '🦄', name: 'Unicornio',    color: '#F472B6' },
  { emoji: '🐱', name: 'Gato',        color: '#60A5FA' },
  { emoji: '🐺', name: 'Lobo',        color: '#94A3B8' },
  { emoji: '💎', name: 'Diamante',     color: '#22D3EE' },
  { emoji: '🔥', name: 'Fuego',       color: '#EF4444' },
  { emoji: '⚡', name: 'Rayo',        color: '#FCD34D' },
  { emoji: '🌙', name: 'Luna',        color: '#C4B5FD' },
];

type Step = 'forge' | 'inscribe' | 'bind' | 'seal' | 'complete';
const FORGE_STEPS: Step[] = ['forge', 'inscribe', 'bind', 'seal'];

type Mode = 'register' | 'login';

export function AuthScreen() {
  const { register, login, isLoading, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<Mode>('register');
  const [stepIndex, setStepIndex] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [sealSymbol, setSealSymbol] = useState(SEAL_SYMBOLS[0]);
  const [completed, setCompleted] = useState(false);

  const currentStep = mode === 'login' ? 'bind' : FORGE_STEPS[stepIndex];
  const [loginPassword, setLoginPassword] = useState('');

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const canAdvance = mode === 'login'
    ? isValidEmail(email) && loginPassword.length >= 1
    : currentStep === 'forge' ? !!sealSymbol
    : currentStep === 'inscribe' ? displayName.trim().length >= 2
    : currentStep === 'bind' ? isValidEmail(email)
    : currentStep === 'seal' ? password.length >= 6
    : false;

  const next = useCallback(async () => {
    if (mode === 'login') {
      const result = await login(email.trim(), loginPassword);
      if (result.success) setCompleted(true);
      return;
    }
    if (stepIndex < FORGE_STEPS.length - 1) {
      clearError();
      setStepIndex(i => i + 1);
      return;
    }
    // Final step — register
    const result = await register(email.trim(), password, displayName.trim(), sealSymbol.emoji);
    if (result.success) setCompleted(true);
  }, [mode, stepIndex, email, loginPassword, password, displayName, sealSymbol, register, login, clearError]);

  const back = useCallback(() => {
    clearError();
    if (mode === 'login') { setMode('register'); setStepIndex(0); return; }
    if (stepIndex > 0) setStepIndex(i => i - 1);
    else { setMode('login'); }
  }, [mode, stepIndex, clearError]);

  // Reset everything
  const resetAll = useCallback(() => {
    setEmail(''); setPassword(''); setLoginPassword(''); setDisplayName('');
    setSealSymbol(SEAL_SYMBOLS[0]); setShowPassword(false);
    setStepIndex(0); setMode('register'); clearError();
  }, [clearError]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-md my-auto">
        {/* ── Progress ring (register mode) ── */}
        <AnimatePresence>
          {mode === 'register' && !completed && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-center mb-4"
            >
              <ProgressRing step={stepIndex} total={FORGE_STEPS.length} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main card ── */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(18, 9, 31, 0.78)',
            backdropFilter: 'blur(28px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Animated glow background following step */}
          <StepGlow step={currentStep} />

          <div className="relative p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {completed ? (
                <CompleteView key="complete" symbol={sealSymbol} name={displayName} />
              ) : (
                <motion.div
                  key={currentStep + mode}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  {currentStep === 'forge' && (
                    <ForgeStep
                      sealSymbol={sealSymbol}
                      onSelect={setSealSymbol}
                      onSwitchToLogin={() => { resetAll(); setMode('login'); }}
                    />
                  )}
                  {currentStep === 'inscribe' && (
                    <InscribeStep
                      displayName={displayName}
                      setDisplayName={setDisplayName}
                      sealSymbol={sealSymbol}
                      onBack={back}
                    />
                  )}
                  {currentStep === 'bind' && (
                    <BindStep
                      email={email}
                      setEmail={setEmail}
                      mode={mode}
                      loginPassword={loginPassword}
                      setLoginPassword={setLoginPassword}
                      showPassword={showPassword}
                      setShowPassword={setShowPassword}
                      onBack={back}
                    />
                  )}
                  {currentStep === 'seal' && (
                    <SealStep
                      password={password}
                      setPassword={setPassword}
                      showPassword={showPassword}
                      setShowPassword={setShowPassword}
                      sealSymbol={sealSymbol}
                      onBack={back}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error + action button */}
            {!completed && (
              <>
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="text-sm text-red-400 mt-4 text-center bg-red-500/10 rounded-lg py-2 px-3"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {!completed && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-5"
                    >
                      <ActionButton
                        onClick={next}
                        disabled={!canAdvance || isLoading}
                        loading={isLoading}
                        step={currentStep}
                        mode={mode}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </motion.div>

        <p className="text-center text-xs text-white/25 mt-4">
          Yosseling · Sesión protegida con cookies HttpOnly
        </p>
      </div>
    </div>
  );
}

/* ── Step 1: Forge — choose your seal symbol ─────────────────── */

function ForgeStep({
  sealSymbol, onSelect, onSwitchToLogin,
}: {
  sealSymbol: typeof SEAL_SYMBOLS[0];
  onSelect: (s: typeof SEAL_SYMBOLS[0]) => void;
  onSwitchToLogin: () => void;
}) {
  const [localSelected, setLocalSelected] = useState(sealSymbol);

  useEffect(() => {
    onSelect(localSelected);
  }, [localSelected, onSelect]);
  return (
    <div>
      <StepHeader
        icon={<Flame size={18} />}
        step="01"
        title="Forja tu sello"
        subtitle="Elige el símbolo que representará tu identidad"
      />

      {/* Selected preview */}
      <div className="flex flex-col items-center my-6">
        <motion.div
          key={sealSymbol.emoji}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="relative"
        >
          <div
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: sealSymbol.color, opacity: 0.3 }}
          />
          <div
            className="relative w-24 h-24 rounded-full flex items-center justify-center text-5xl"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${sealSymbol.color}30, transparent 70%)`,
              border: `2px solid ${sealSymbol.color}40`,
              boxShadow: `0 0 32px ${sealSymbol.color}30`,
            }}
          >
            {sealSymbol.emoji}
          </div>
        </motion.div>
        <motion.p
          key={sealSymbol.name}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-medium text-white/70 mt-3"
        >
          {sealSymbol.name}
        </motion.p>
      </div>

      {/* Symbol grid */}
      <div className="grid grid-cols-4 gap-2.5">
        {SEAL_SYMBOLS.map((sym, i) => (
          <motion.button
            key={sym.emoji}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.04, type: 'spring', stiffness: 260 }}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setLocalSelected(sym)}
            className={`aspect-square rounded-2xl flex items-center justify-center text-2xl transition-all ${
              sealSymbol.emoji === sym.emoji
                ? 'border-2 scale-105'
                : 'border border-white/8 hover:border-white/20'
            }`}
            style={{
              background: sealSymbol.emoji === sym.emoji
                ? `${sym.color}20`
                : 'rgba(255,255,255,0.03)',
              borderColor: sealSymbol.emoji === sym.emoji ? `${sym.color}60` : undefined,
              boxShadow: sealSymbol.emoji === sym.emoji ? `0 0 20px ${sym.color}25` : undefined,
            }}
          >
            {sym.emoji}
          </motion.button>
        ))}
      </div>

      {/* Login switch */}
      <div className="mt-6">
        <p className="text-center text-sm text-white/40">
          ¿Ya tienes cuenta?{' '}
          <button
            onClick={onSwitchToLogin}
            className="text-fuchsia-300 hover:text-fuchsia-200 font-medium transition-colors underline-offset-2 hover:underline"
          >
            Iniciar sesión
          </button>
        </p>
      </div>
    </div>
  );
}

/* ── Step 2: Inscribe — enter your name ──────────────────────── */

function InscribeStep({
  displayName, setDisplayName, sealSymbol, onBack,
}: {
  displayName: string;
  setDisplayName: (v: string) => void;
  sealSymbol: typeof SEAL_SYMBOLS[0];
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeader
        icon={<Gem size={18} />}
        step="02"
        title="Inscribe tu nombre"
        subtitle="El nombre que verás en tu sello"
      />

      <div className="flex items-center gap-3 my-6">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
          style={{
            background: `${sealSymbol.color}20`,
            border: `1px solid ${sealSymbol.color}40`,
          }}
        >
          {sealSymbol.emoji}
        </div>
        <div className="relative flex-1">
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Tu nombre..."
            maxLength={24}
            autoFocus
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3.5 text-white placeholder-white/25 outline-none focus:border-fuchsia-400/50 focus:bg-white/8 transition-colors text-lg"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/20">
            {displayName.length}/24
          </span>
        </div>
      </div>

      <BackLink onClick={onBack} />
    </div>
  );
}

/* ── Step 3: Bind — enter email ──────────────────────────────── */

function BindStep({
  email, setEmail, mode, loginPassword, setLoginPassword, showPassword, setShowPassword, onBack,
}: {
  email: string;
  setEmail: (v: string) => void;
  mode: Mode;
  loginPassword: string;
  setLoginPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeader
        icon={<Mail size={18} />}
        step={mode === 'login' ? '—' : '03'}
        title={mode === 'login' ? 'Tu correo' : 'Vincula tu correo'}
        subtitle={mode === 'login' ? 'Ingresa con tu cuenta' : 'Para proteger y recuperar tu sello'}
      />

      <div className="relative my-6">
        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" />
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          autoComplete="email"
          autoFocus
          className="w-full rounded-xl bg-white/5 border border-white/10 pl-12 pr-4 py-3.5 text-white placeholder-white/25 outline-none focus:border-fuchsia-400/50 focus:bg-white/8 transition-colors text-lg"
        />
      </div>

      {mode === 'login' && (
        <>
          <div className="relative mb-4">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-xl bg-white/5 border border-white/10 pl-12 pr-12 py-3.5 text-white placeholder-white/25 outline-none focus:border-fuchsia-400/50 focus:bg-white/8 transition-colors text-lg tracking-wider"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="text-center text-sm text-white/40 mb-2">
            ¿No tienes cuenta?{' '}
            <button
              onClick={onBack}
              className="text-fuchsia-300 hover:text-fuchsia-200 font-medium transition-colors underline-offset-2 hover:underline"
            >
              Crear sello
            </button>
          </p>
        </>
      )}

      <BackLink onClick={onBack} />
    </div>
  );
}

/* ── Step 4: Seal — set password ────────────────────────────── */

function SealStep({
  password, setPassword, showPassword, setShowPassword, sealSymbol, onBack,
}: {
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  sealSymbol: typeof SEAL_SYMBOLS[0];
  onBack: () => void;
}) {
  const strength = Math.min(4, Math.floor(password.length / 2));
  const strengthLabels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];
  const strengthColors = ['', '#EF4444', '#F59E0B', '#22D3EE', '#34D399'];

  return (
    <div>
      <StepHeader
        icon={<Shield size={18} />}
        step="04"
        title="Sella tu identidad"
        subtitle="Mínimo 6 caracteres para proteger tu sello"
      />

      <div className="relative my-6">
        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" />
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          autoFocus
          className="w-full rounded-xl bg-white/5 border border-white/10 pl-12 pr-12 py-3.5 text-white placeholder-white/25 outline-none focus:border-fuchsia-400/50 focus:bg-white/8 transition-colors text-lg tracking-wider"
        />
        <button
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {/* Password strength meter */}
      <AnimatePresence>
        {password.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <div className="flex gap-1.5 mb-1.5">
              {[1, 2, 3, 4].map(i => (
                <motion.div
                  key={i}
                  className="flex-1 h-1.5 rounded-full"
                  animate={{
                    backgroundColor: i <= strength ? strengthColors[strength] : 'rgba(255,255,255,0.08)',
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-white/40">{strengthLabels[strength]}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <BackLink onClick={onBack} />
    </div>
  );
}

/* ── Complete view ───────────────────────────────────────────── */

function CompleteView({ symbol, name }: { symbol: typeof SEAL_SYMBOLS[0]; name: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14 }}
        className="relative mb-4"
      >
        <div
          className="absolute inset-0 rounded-full blur-3xl"
          style={{ background: symbol.color, opacity: 0.4 }}
        />
        <div
          className="relative w-28 h-28 rounded-full flex items-center justify-center text-6xl"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${symbol.color}40, transparent 70%)`,
            border: `2px solid ${symbol.color}50`,
            boxShadow: `0 0 48px ${symbol.color}40`,
          }}
        >
          {symbol.emoji}
        </div>
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-xl font-bold text-white"
      >
        Sello forjado
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-sm text-white/50 mt-1"
      >
        Bienvenido, {name || 'viajero'}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-4 flex items-center gap-2 text-fuchsia-300"
      >
        <Check size={16} />
        <span className="text-sm font-medium">Entrando...</span>
      </motion.div>
    </div>
  );
}

/* ── Shared sub-components ───────────────────────────────────── */

function StepHeader({ icon, step, title, subtitle }: {
  icon: React.ReactNode; step: string; title: string; subtitle: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-fuchsia-400/80">{icon}</span>
        <span className="text-xs font-mono text-white/30 tracking-widest">{step}</span>
      </div>
      <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
      <p className="text-sm text-white/45 mt-0.5">{subtitle}</p>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-sm text-white/35 hover:text-white/70 transition-colors mt-2"
    >
      <ArrowLeft size={14} />
      Atrás
    </button>
  );
}

function ActionButton({ onClick, disabled, loading, step, mode }: {
  onClick: () => void; disabled: boolean; loading: boolean; step: Step; mode: Mode;
}) {
  const label = mode === 'login'
    ? 'Entrar'
    : step === 'seal'
    ? 'Forjar sello'
    : 'Continuar';

  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
    >
      {loading ? (
        <>
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
          >
            <Sparkles size={16} />
          </motion.span>
          Forjando...
        </>
      ) : (
        <>
          {label}
          <ArrowRight size={16} />
        </>
      )}
    </motion.button>
  );
}

/* ── Progress ring ───────────────────────────────────────────── */

function ProgressRing({ step, total }: { step: number; total: number }) {
  const pct = ((step + 1) / total) * 100;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative w-14 h-14">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <motion.circle
          cx="28" cy="28" r={radius}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="56" y2="56">
            <stop offset="0%" stopColor="#D946EF" />
            <stop offset="100%" stopColor="#A855F7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-white/80">{step + 1}/{total}</span>
      </div>
    </div>
  );
}

/* ── Animated glow that shifts color per step ───────────────── */

function StepGlow({ step }: { step: Step }) {
  const colorMap: Record<Step, string> = {
    forge: '#F59E0B',
    inscribe: '#A855F7',
    bind: '#22D3EE',
    seal: '#34D399',
    complete: '#D946EF',
  };
  const color = colorMap[step];

  return (
    <motion.div
      key={step}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl pointer-events-none"
      style={{ background: color, opacity: 0.08 }}
    />
  );
}
