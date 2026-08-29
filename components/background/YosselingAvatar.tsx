'use client';

import { useEffect, useState } from 'react';
import { motion, useAnimation, useMotionValue, useSpring } from 'framer-motion';

interface Props {
  isListening: boolean;
  isStreaming: boolean;
  isSpeaking: boolean;
  mouseX: number; // 0-1
  mouseY: number; // 0-1
  onChatChange?: boolean;
}

export function YosselingAvatar({ isListening, isStreaming, isSpeaking, mouseX, mouseY, onChatChange }: Props) {
  const [blink, setBlink] = useState(false);
  const [smileActive, setSmileActive] = useState(false);
  const [tiltDir, setTiltDir] = useState(0);
  const headControls = useAnimation();
  const eyeControls = useAnimation();

  // Smooth mouse following for eyes
  const rawEyeX = (mouseX - 0.5) * 6;
  const rawEyeY = (mouseY - 0.5) * 4;
  const eyeXMotion = useMotionValue(rawEyeX);
  const eyeYMotion = useMotionValue(rawEyeY);
  const eyeX = useSpring(eyeXMotion, { stiffness: 30, damping: 20 });
  const eyeY = useSpring(eyeYMotion, { stiffness: 30, damping: 20 });

  useEffect(() => { eyeXMotion.set(rawEyeX); }, [rawEyeX, eyeXMotion]);
  useEffect(() => { eyeYMotion.set(rawEyeY); }, [rawEyeY, eyeYMotion]);

  // Blink cycle
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 2500 + Math.random() * 4000;
      return setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 150);
        scheduleBlink();
      }, delay);
    };
    const t = scheduleBlink();
    return () => clearTimeout(t);
  }, []);

  // Smile when streaming
  useEffect(() => {
    if (isStreaming || isSpeaking) {
      setSmileActive(true);
    } else {
      const t = setTimeout(() => setSmileActive(false), 800);
      return () => clearTimeout(t);
    }
  }, [isStreaming, isSpeaking]);

  // Subtle head tilt cycle
  useEffect(() => {
    const cycle = (): ReturnType<typeof setTimeout> => {
      const dir = (Math.random() - 0.5) * 6;
      setTiltDir(dir);
      return setTimeout(cycle, 4000 + Math.random() * 3000);
    };
    const t = cycle();
    return () => clearTimeout(t);
  }, []);

  // Chat change — look away then back
  useEffect(() => {
    if (!onChatChange) return;
    headControls.start({ x: 20, opacity: 0.8, transition: { duration: 0.4 } }).then(() =>
      headControls.start({ x: 0, opacity: 1, transition: { duration: 0.8, ease: 'easeOut' } })
    );
  }, [onChatChange]);

  const glowColor = isListening
    ? 'rgba(100,200,255,0.6)'
    : isStreaming || isSpeaking
    ? 'rgba(180,100,255,0.5)'
    : 'rgba(140,80,240,0.35)';

  const glowSize = isListening ? '80px' : '50px';

  return (
    <motion.div
      animate={headControls}
      className="absolute inset-0 flex items-end justify-center pointer-events-none select-none"
      style={{ paddingBottom: '0px' }}
    >
      {/* Aura glow behind character */}
      <motion.div
        className="absolute"
        style={{
          bottom: '5%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '340px',
          height: '500px',
          background: `radial-gradient(ellipse at 50% 80%, ${glowColor} 0%, transparent 70%)`,
          filter: `blur(${glowSize})`,
        }}
        animate={{
          opacity: isListening ? [0.7, 1, 0.7] : [0.5, 0.8, 0.5],
        }}
        transition={{ duration: isListening ? 1.2 : 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Character SVG */}
      <motion.div
        className="relative z-10"
        style={{ width: 'min(300px, 38vw)', maxWidth: '340px' }}
        // Breathing
        animate={{
          y: [0, -5, 0],
          scaleY: [1, 1.008, 1],
        }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          animate={{ rotate: tiltDir }}
          transition={{ duration: 2.5, ease: 'easeInOut' }}
        >
          <svg
            viewBox="0 0 300 520"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: '100%', height: 'auto', overflow: 'visible' }}
          >
            <defs>
              {/* Skin gradient */}
              <radialGradient id="skin" cx="50%" cy="35%" r="55%">
                <stop offset="0%" stopColor="#C8856A" />
                <stop offset="60%" stopColor="#B87055" />
                <stop offset="100%" stopColor="#9A5C42" />
              </radialGradient>
              {/* Hair gradient */}
              <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1A0A00" />
                <stop offset="40%" stopColor="#2D1208" />
                <stop offset="100%" stopColor="#0D0500" />
              </linearGradient>
              {/* Hair highlight */}
              <linearGradient id="hairHL" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(80,30,10,0)" />
                <stop offset="40%" stopColor="rgba(120,50,15,0.25)" />
                <stop offset="100%" stopColor="rgba(80,30,10,0)" />
              </linearGradient>
              {/* Eye iris */}
              <radialGradient id="iris" cx="40%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#7B4FD0" />
                <stop offset="50%" stopColor="#3D2280" />
                <stop offset="100%" stopColor="#1A0A40" />
              </radialGradient>
              {/* Outfit gradient */}
              <linearGradient id="outfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8EDF5" />
                <stop offset="50%" stopColor="#CDD6E8" />
                <stop offset="100%" stopColor="#AAB8D0" />
              </linearGradient>
              {/* Outfit glow trim */}
              <linearGradient id="trim" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7C3AED" />
                <stop offset="50%" stopColor="#4F9DFF" />
                <stop offset="100%" stopColor="#7C3AED" />
              </linearGradient>
              {/* Neck shadow */}
              <radialGradient id="neckShadow" cx="50%" cy="0%" r="80%">
                <stop offset="0%" stopColor="rgba(80,40,20,0.4)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
              {/* Body glow */}
              <radialGradient id="bodyGlow" cx="50%" cy="20%" r="70%">
                <stop offset="0%" stopColor="rgba(124,58,237,0.15)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
              {/* Brow */}
              <filter id="softShadow">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.3)" />
              </filter>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* ── BODY ── */}
            {/* Torso / outfit */}
            <g>
              {/* Main body shape */}
              <path
                d="M70 390 Q60 370 55 340 Q50 310 58 285 Q70 260 90 250 Q120 238 150 236 Q180 238 210 250 Q230 260 242 285 Q250 310 245 340 Q240 370 230 390 Q220 420 200 445 Q175 465 150 470 Q125 465 100 445 Q80 420 70 390Z"
                fill="url(#outfit)"
              />
              {/* Body glow overlay */}
              <path
                d="M70 390 Q60 370 55 340 Q50 310 58 285 Q70 260 90 250 Q120 238 150 236 Q180 238 210 250 Q230 260 242 285 Q250 310 245 340 Q240 370 230 390 Q220 420 200 445 Q175 465 150 470 Q125 465 100 445 Q80 420 70 390Z"
                fill="url(#bodyGlow)"
              />
              {/* Collar / neckline detail */}
              <path
                d="M118 238 Q134 232 150 231 Q166 232 182 238 Q175 255 162 260 Q155 263 150 264 Q145 263 138 260 Q125 255 118 238Z"
                fill="white"
                opacity="0.6"
              />
              {/* Purple trim accent lines */}
              <path d="M90 295 Q120 288 150 287 Q180 288 210 295" stroke="url(#trim)" strokeWidth="2" opacity="0.7" fill="none" />
              <path d="M80 340 Q115 332 150 331 Q185 332 220 340" stroke="url(#trim)" strokeWidth="1.5" opacity="0.5" fill="none" />
              {/* Blue shoulder accents */}
              <ellipse cx="78" cy="265" rx="18" ry="12" fill="rgba(79,157,255,0.3)" transform="rotate(-15,78,265)" />
              <ellipse cx="222" cy="265" rx="18" ry="12" fill="rgba(79,157,255,0.3)" transform="rotate(15,222,265)" />
              {/* Holographic badge */}
              <rect x="136" y="298" width="28" height="20" rx="4" fill="rgba(124,58,237,0.2)" stroke="url(#trim)" strokeWidth="1" />
              <rect x="140" y="302" width="20" height="2" rx="1" fill="rgba(79,157,255,0.6)" />
              <rect x="140" y="307" width="14" height="2" rx="1" fill="rgba(168,85,247,0.5)" />
              <rect x="140" y="312" width="16" height="2" rx="1" fill="rgba(79,157,255,0.4)" />
              {/* Arms */}
              <path d="M90 252 Q72 268 65 295 Q60 320 65 345 Q70 362 80 370 Q92 350 98 320 Q102 295 100 268Z"
                fill="url(#outfit)" />
              <path d="M210 252 Q228 268 235 295 Q240 320 235 345 Q230 362 220 370 Q208 350 202 320 Q198 295 200 268Z"
                fill="url(#outfit)" />
              {/* Purple trim on sleeves */}
              <path d="M65 320 Q72 316 80 315" stroke="url(#trim)" strokeWidth="1.5" opacity="0.6" fill="none" />
              <path d="M235 320 Q228 316 220 315" stroke="url(#trim)" strokeWidth="1.5" opacity="0.6" fill="none" />
              {/* Hands */}
              <ellipse cx="68" cy="360" rx="12" ry="16" fill="url(#skin)" />
              <ellipse cx="232" cy="360" rx="12" ry="16" fill="url(#skin)" />
            </g>

            {/* ── NECK ── */}
            <rect x="136" y="215" width="28" height="38" rx="8" fill="url(#skin)" />
            <rect x="136" y="215" width="28" height="38" rx="8" fill="url(#neckShadow)" />

            {/* ── HEAD ── */}
            {/* Head base */}
            <ellipse cx="150" cy="160" rx="75" ry="82" fill="url(#skin)" filter="url(#softShadow)" />

            {/* Cheek flush */}
            <ellipse cx="100" cy="178" rx="20" ry="11" fill="rgba(210,100,80,0.18)" />
            <ellipse cx="200" cy="178" rx="20" ry="11" fill="rgba(210,100,80,0.18)" />

            {/* ── HAIR BACK ── (behind head) */}
            {/* Long flowing hair back layer */}
            <path
              d="M78 105 Q50 130 42 170 Q35 210 40 260 Q44 300 55 340 Q62 370 75 390 Q100 430 130 450 Q145 458 150 460 Q155 458 170 450 Q200 430 225 390 Q238 370 245 340 Q256 300 260 260 Q265 210 258 170 Q250 130 222 105 Q190 85 150 82 Q110 85 78 105Z"
              fill="url(#hair)"
            />
            {/* Hair highlight */}
            <path
              d="M78 105 Q50 130 42 170 Q35 210 40 260 Q44 300 55 340 Q62 370 75 390 Q100 430 130 450 Q145 458 150 460 Q155 458 170 450 Q200 430 225 390 Q238 370 245 340 Q256 300 260 260 Q265 210 258 170 Q250 130 222 105 Q190 85 150 82 Q110 85 78 105Z"
              fill="url(#hairHL)"
            />

            {/* ── FACE FEATURES ── */}

            {/* Eyebrows */}
            <path d="M108 128 Q118 122 130 123" stroke="#2D1208" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M170 123 Q182 122 192 128" stroke="#2D1208" strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* ── LEFT EYE ── */}
            <g>
              {/* Eye white */}
              <ellipse cx="119" cy="152" rx="17" ry={blink ? 1.5 : 12} fill="white" />
              {/* Iris */}
              {!blink && <ellipse cx="119" cy="153" rx="11" ry="11" fill="url(#iris)" />}
              {/* Pupil */}
              {!blink && (
                <motion.ellipse cx="119" cy="153" rx="5.5" ry="5.5" fill="#0A0020"
                  style={{ x: eyeX, y: eyeY }}
                />
              )}
              {/* Highlight dot */}
              {!blink && <ellipse cx="123" cy="148" rx="2.5" ry="2.5" fill="white" opacity="0.9" />}
              {/* Eye lashes top */}
              <path d="M102 147 Q110 136 136 143" stroke="#1A0A00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              {/* Lower lash line */}
              <path d="M103 157 Q112 163 135 159" stroke="#1A0A00" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5" />
            </g>

            {/* ── RIGHT EYE ── */}
            <g>
              <ellipse cx="181" cy="152" rx="17" ry={blink ? 1.5 : 12} fill="white" />
              {!blink && <ellipse cx="181" cy="153" rx="11" ry="11" fill="url(#iris)" />}
              {!blink && (
                <motion.ellipse cx="181" cy="153" rx="5.5" ry="5.5" fill="#0A0020"
                  style={{ x: eyeX, y: eyeY }}
                />
              )}
              {!blink && <ellipse cx="185" cy="148" rx="2.5" ry="2.5" fill="white" opacity="0.9" />}
              <path d="M164 143 Q170 136 198 147" stroke="#1A0A00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M165 159 Q178 163 197 157" stroke="#1A0A00" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5" />
            </g>

            {/* Nose */}
            <path d="M146 175 Q150 180 154 175" stroke="rgba(120,70,40,0.5)" strokeWidth="1.5" strokeLinecap="round" fill="none" />

            {/* ── MOUTH / SMILE ── */}
            <motion.path
              d={smileActive
                ? "M133 196 Q142 204 150 205 Q158 204 167 196"
                : "M135 196 Q142 200 150 201 Q158 200 165 196"}
              stroke="rgba(140,70,50,0.85)"
              strokeWidth={smileActive ? "2.5" : "2"}
              strokeLinecap="round"
              fill="none"
              animate={{ d: smileActive
                ? "M133 196 Q142 206 150 207 Q158 206 167 196"
                : "M135 196 Q142 201 150 202 Q158 201 165 196" }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            />

            {/* Lip speek animation during speech */}
            {isSpeaking && (
              <motion.ellipse
                cx="150" cy="200"
                rx="8" ry="3"
                fill="rgba(120,60,40,0.25)"
                animate={{ ry: [2, 5, 2, 4, 2] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            {/* ── HAIR FRONT ── (over face sides) */}
            {/* Left side hair */}
            <path
              d="M78 105 Q62 120 56 148 Q52 168 55 185 Q62 168 70 152 Q78 136 82 118Z"
              fill="url(#hair)"
            />
            {/* Right side hair */}
            <path
              d="M222 105 Q238 120 244 148 Q248 168 245 185 Q238 168 230 152 Q222 136 218 118Z"
              fill="url(#hair)"
            />
            {/* Top hair sweep */}
            <path
              d="M90 88 Q120 72 150 70 Q180 72 210 88 Q195 78 172 76 Q161 74 150 74 Q139 74 128 76 Q105 78 90 88Z"
              fill="url(#hair)"
            />
            {/* Hair highlight front */}
            <path
              d="M115 75 Q138 68 162 70"
              stroke="rgba(80,30,10,0.3)"
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
            />

            {/* ── HAIR ANIMATED STRANDS ── */}
            <HairStrands />

            {/* Listening glow around eyes */}
            {isListening && (
              <>
                <ellipse cx="119" cy="152" rx="20" ry="16" fill="none"
                  stroke="rgba(100,200,255,0.5)" strokeWidth="1.5" />
                <ellipse cx="181" cy="152" rx="20" ry="16" fill="none"
                  stroke="rgba(100,200,255,0.5)" strokeWidth="1.5" />
              </>
            )}

            {/* Holographic ring floating above head */}
            <HoloRing isListening={isListening} isStreaming={isStreaming} />
          </svg>
        </motion.div>
      </motion.div>

      {/* Name label */}
      <motion.div
        className="absolute"
        style={{ bottom: '1%', left: '50%', transform: 'translateX(-50%)' }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="text-xs font-medium tracking-[0.25em] text-purple-300/60 uppercase select-none">
          Yosseling
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Animated hair strands — CSS keyframe based */
function HairStrands() {
  return (
    <g>
      {/* Left flowing strand */}
      <motion.path
        d="M55 185 Q45 230 50 280 Q54 320 65 355"
        stroke="rgba(30,12,2,0.7)"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        animate={{ d: [
          "M55 185 Q45 230 50 280 Q54 320 65 355",
          "M55 185 Q48 232 54 282 Q58 322 68 357",
          "M55 185 Q43 228 48 278 Q52 318 63 353",
          "M55 185 Q45 230 50 280 Q54 320 65 355",
        ]}}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Right flowing strand */}
      <motion.path
        d="M245 185 Q255 230 250 280 Q246 320 235 355"
        stroke="rgba(30,12,2,0.7)"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        animate={{ d: [
          "M245 185 Q255 230 250 280 Q246 320 235 355",
          "M245 185 Q252 232 246 282 Q242 322 232 357",
          "M245 185 Q257 228 252 278 Q248 318 237 353",
          "M245 185 Q255 230 250 280 Q246 320 235 355",
        ]}}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      />
      {/* Center loose strand */}
      <motion.path
        d="M150 74 Q155 100 158 130 Q160 155 156 175"
        stroke="rgba(25,8,0,0.5)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        animate={{ d: [
          "M150 74 Q155 100 158 130 Q160 155 156 175",
          "M150 74 Q157 102 159 132 Q161 157 157 177",
          "M150 74 Q153 98 157 128 Q159 153 155 173",
          "M150 74 Q155 100 158 130 Q160 155 156 175",
        ]}}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
    </g>
  );
}

/** Holographic ring floating above head */
function HoloRing({ isListening, isStreaming }: { isListening: boolean; isStreaming: boolean }) {
  const color = isListening ? 'rgba(100,200,255,' : 'rgba(140,80,255,';
  const opacity = isListening ? 0.7 : isStreaming ? 0.55 : 0.3;

  return (
    <motion.g
      animate={{ y: [-4, 4, -4], rotate: [0, 360] }}
      transition={{ y: { duration: 3, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 12, repeat: Infinity, ease: 'linear' } }}
      style={{ originX: '150px', originY: '52px' }}
    >
      <ellipse cx="150" cy="52" rx="55" ry="14"
        stroke={`${color}${opacity})`}
        strokeWidth="1.5" fill="none" />
      <ellipse cx="150" cy="52" rx="42" ry="10"
        stroke={`${color}${opacity * 0.6})`}
        strokeWidth="1" fill="none" strokeDasharray="4 6" />
      {/* Orbiting dot */}
      <motion.circle r="3" fill={`${color}0.9)`}
        animate={{
          cx: [205, 150, 95, 150, 205],
          cy: [52, 38, 52, 66, 52],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />
    </motion.g>
  );
}
