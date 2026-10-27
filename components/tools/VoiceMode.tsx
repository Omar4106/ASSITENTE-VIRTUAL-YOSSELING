'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Headphones, LoaderCircle, Mic, MicOff, Radio, Volume2 } from 'lucide-react';
import { useVoice } from '@/hooks/useVoice';
import { useAppStore } from '@/lib/store';

interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}

interface RecognitionEvent extends Event {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

interface RecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type VoiceNavigationTarget = 'job' | 'doctor' | 'vision' | 'downloads' | 'settings';

function getVoiceNavigationTarget(text: string): VoiceNavigationTarget | null {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const command = normalized.trim().replace(/[.!?]+$/, '');
  if (/^(?:(?:ir a|abre|abrir|ve a|navega a)\s+)?(?:empleo|trabajo|vacantes)$/.test(command)) return 'job';
  if (/^(?:(?:ir a|abre|abrir|ve a|navega a)\s+)?(?:dispositivos|doctor|equipo)$/.test(command)) return 'doctor';
  if (/^(?:(?:ir a|abre|abrir|ve a|navega a)\s+)?(?:vision|camara)$/.test(command)) return 'vision';
  if (/^(?:(?:ir a|abre|abrir|ve a|navega a)\s+)?(?:descargas|cola de descargas)$/.test(command)) return 'downloads';
  if (/^(?:(?:ir a|abre|abrir|ve a|navega a)\s+)?(?:configuracion|ajustes)$/.test(command)) return 'settings';
  return null;
}

export function VoiceMode() {
  const { speak, stopSpeaking, voiceState } = useVoice();
  const { chats, activeChatId, isStreaming, sendMessage } = useAppStore();
  const [isMounted, setIsMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const shouldListenRef = useRef(false);
  const waitingForReplyRef = useRef(false);
  const wasStreamingRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const restartAttemptsRef = useRef(0);
  const scheduleRestartRef = useRef<() => void>(() => undefined);
  const resumeAfterSpeechRef = useRef(false);
  const pendingNavigationRef = useRef<VoiceNavigationTarget | null>(null);
  const wasSpeakingRef = useRef(false);
  const isSpeakingRef = useRef(voiceState.isSpeaking);
  const isStreamingRef = useRef(isStreaming);
  isSpeakingRef.current = voiceState.isSpeaking;
  isStreamingRef.current = isStreaming;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined' || !activeRef.current || !shouldListenRef.current || !recognitionRef.current || waitingForReplyRef.current) return;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try {
      recognitionRef.current.start();
      setRestarting(false);
    } catch {
      setListening(false);
      scheduleRestartRef.current();
    }
  }, []);

  const scheduleRestart = useCallback(() => {
    if (
      typeof window === 'undefined' ||
      !activeRef.current ||
      !shouldListenRef.current ||
      waitingForReplyRef.current ||
      restartTimerRef.current !== null
    ) return;

    restartAttemptsRef.current += 1;
    if (restartAttemptsRef.current > 10) {
      shouldListenRef.current = false;
      activeRef.current = false;
      setActive(false);
      setListening(false);
      setRestarting(false);
      setError('El reconocimiento de voz se detuvo repetidamente. Comprueba la conexión y los permisos, y vuelve a iniciar el modo de voz.');
      return;
    }

    setListening(false);
    setRestarting(true);
    const delay = Math.min(500 * (2 ** Math.min(restartAttemptsRef.current - 1, 3)), 4000);
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      startListening();
    }, delay);
  }, [startListening]);
  scheduleRestartRef.current = scheduleRestart;

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (typeof window !== 'undefined' && restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    recognitionRef.current?.stop();
    setListening(false);
    setRestarting(false);
  }, []);

  const stopConversation = useCallback(() => {
    activeRef.current = false;
    shouldListenRef.current = false;
    waitingForReplyRef.current = false;
    resumeAfterSpeechRef.current = false;
    if (typeof window !== 'undefined' && restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    stopSpeaking();
    setActive(false);
    setListening(false);
    setTranscript('');
  }, [stopSpeaking]);

  const startConversation = () => {
    if (typeof window === 'undefined') return;
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      setSupported(false);
      setError('Este navegador no ofrece reconocimiento de voz. Prueba con una versión reciente de Chrome o Edge.');
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      setError('Este navegador no ofrece reconocimiento de voz. Prueba con una versión reciente de Chrome o Edge.');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-ES';
    recognition.onstart = () => {
      restartAttemptsRef.current = 0;
      setListening(true);
      setRestarting(false);
      setError('');
    };
    recognition.onresult = (event) => {
      let interim = '';
      const finalParts: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalParts.push(result[0].transcript.trim());
        else interim += result[0].transcript;
      }
      const finalText = finalParts.join(' ').trim();
      setTranscript(finalText || interim.trim());

      if (finalText) {
        stopSpeaking();
        shouldListenRef.current = false;
        waitingForReplyRef.current = true;
        resumeAfterSpeechRef.current = true;
        pendingNavigationRef.current = getVoiceNavigationTarget(finalText);
        setListening(false);
        recognition.stop();
        void sendMessage(finalText).catch((sendError: unknown) => {
          pendingNavigationRef.current = null;
          waitingForReplyRef.current = false;
          setError(sendError instanceof Error ? sendError.message : 'No se pudo enviar la consulta por voz.');
          if (activeRef.current) {
            shouldListenRef.current = true;
            startListening();
          }
        });
      } else if (interim.trim().length > 2 && isSpeakingRef.current) {
        stopSpeaking();
        setTranscript(interim.trim());
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldListenRef.current = false;
        activeRef.current = false;
        setActive(false);
        setRestarting(false);
        setError('El navegador bloqueó el micrófono. Permite el reconocimiento de voz en los permisos del sitio y vuelve a intentarlo.');
      } else if (event.error === 'audio-capture') {
        shouldListenRef.current = false;
        activeRef.current = false;
        setActive(false);
        setRestarting(false);
        setError('No se encontró un micrófono disponible. Conecta o habilita uno y vuelve a intentarlo.');
      } else if (event.error === 'network') {
        setError('El servicio de reconocimiento perdió la conexión; intentando reconectar…');
      } else if (event.error === 'language-not-supported') {
        shouldListenRef.current = false;
        activeRef.current = false;
        setActive(false);
        setRestarting(false);
        setError('El navegador no admite reconocimiento en español.');
      } else if (event.error === 'no-speech' || event.error === 'aborted') {
        setError('');
      } else {
        setError(`Error de reconocimiento (${event.error}). Comprueba el micrófono y vuelve a intentarlo.`);
      }
    };
    recognition.onend = () => {
      setListening(false);
      if (activeRef.current && shouldListenRef.current && !waitingForReplyRef.current && !isSpeakingRef.current && !isStreamingRef.current) {
        scheduleRestart();
      }
    };

    recognitionRef.current = recognition;
    activeRef.current = true;
    shouldListenRef.current = true;
    restartAttemptsRef.current = 0;
    setActive(true);
    setRestarting(true);
    setTranscript('');
    setError('');
    startListening();
  };

  useEffect(() => {
    const wasStreaming = wasStreamingRef.current;
    wasStreamingRef.current = isStreaming;
    if (!wasStreaming || isStreaming || !waitingForReplyRef.current) return;

    waitingForReplyRef.current = false;
    const chat = chats.find((item) => item.id === activeChatId);
    const reply = [...(chat?.messages ?? [])].reverse().find((message) => message.role === 'assistant' && message.content.trim());
    if (reply) {
      shouldListenRef.current = false;
      void speak(reply.content, undefined, true);
    } else if (activeRef.current) {
      shouldListenRef.current = true;
      startListening();
    }
  }, [activeChatId, chats, isStreaming, speak, startListening]);

  useEffect(() => {
    const wasSpeaking = wasSpeakingRef.current;
    wasSpeakingRef.current = voiceState.isSpeaking;
    if (
      wasSpeaking &&
      !voiceState.isSpeaking &&
      !isStreaming &&
      pendingNavigationRef.current
    ) {
      const target = pendingNavigationRef.current;
      pendingNavigationRef.current = null;
      resumeAfterSpeechRef.current = false;
      window.dispatchEvent(new CustomEvent<VoiceNavigationTarget>('yosseling:navigate-tool', { detail: target }));
      return;
    }

    if (!resumeAfterSpeechRef.current || voiceState.isSpeaking || isStreaming || waitingForReplyRef.current) return;
    if (activeRef.current) {
      resumeAfterSpeechRef.current = false;
      shouldListenRef.current = true;
      setRestarting(true);
      if (typeof window !== 'undefined') restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        startListening();
      }, 450);
    }
  }, [isStreaming, startListening, voiceState.isSpeaking]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      shouldListenRef.current = false;
      if (typeof window !== 'undefined' && restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
      recognitionRef.current?.abort();
      stopSpeaking();
    };
  }, [stopSpeaking]);

  if (!isMounted) {
    return <div className="p-6 text-zinc-400">Cargando herramienta...</div>;
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-white"><Headphones size={18} className="text-pink-300" /> Conversación por voz</h2>
        <p className="mt-1 text-xs text-white/55">Habla con Yosseling sin tocar enviar. El reconocimiento de voz depende del navegador y los permisos del micrófono.</p>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-2xl border border-pink-300/15 bg-pink-300/[0.04] px-5 py-8 text-center">
        <div className={`flex h-20 w-20 items-center justify-center rounded-full border transition-all duration-300 ${listening ? 'border-pink-300/50 bg-pink-400/15 shadow-lg shadow-pink-950/30' : 'border-white/10 bg-white/[0.04]'}`}>
          {isStreaming || (active && voiceState.currentWord === 'Generando voz...') ? (
            <LoaderCircle size={30} className="animate-spin text-pink-200" />
          ) : listening ? <Radio size={30} className="animate-pulse text-pink-200" /> : <Mic size={30} className="text-white/55" />}
        </div>
        <div>
          <p className="text-sm font-medium text-white">
            {isStreaming ? 'Yosseling está pensando…' : voiceState.isSpeaking ? 'Yosseling está hablando' : listening ? 'Micrófono activo · te escucho' : restarting ? 'Reactivando micrófono…' : active ? 'Modo manos libres activo' : 'Conversación pausada'}
          </p>
          <p className="mt-1 min-h-5 text-xs text-white/55">{transcript || (active ? 'Mantén esta pestaña abierta y permite el acceso al micrófono.' : 'Pulsa para iniciar y permite el acceso al micrófono.')}</p>
        </div>
        {active && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${listening ? 'bg-green-400/10 text-green-200' : 'bg-amber-300/10 text-amber-100'}`}>
            {listening ? (
              <span className="inline-flex h-3 items-center gap-0.5" aria-label="Ondas de audio: escuchando">
                <span className="h-1 w-0.5 animate-pulse rounded-full bg-green-200" />
                <span className="h-3 w-0.5 animate-pulse rounded-full bg-green-200 [animation-delay:120ms]" />
                <span className="h-2 w-0.5 animate-pulse rounded-full bg-green-200 [animation-delay:240ms]" />
                <span className="h-1.5 w-0.5 animate-pulse rounded-full bg-green-200 [animation-delay:360ms]" />
              </span>
            ) : <span className={`h-2 w-2 rounded-full ${restarting ? 'animate-pulse bg-amber-200' : 'bg-amber-200'}`} />}
            {listening ? 'Escuchando' : restarting ? 'Reconectando' : 'En espera'}
          </span>
        )}
        <button
          type="button"
          disabled={!supported}
          onClick={active ? stopConversation : startConversation}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500/80 to-purple-500/80 px-5 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
        >
          {active ? <MicOff size={16} /> : <Mic size={16} />}
          {active ? 'Finalizar conversación' : 'Iniciar conversación'}
        </button>
        {voiceState.isSpeaking && (
          <button type="button" onClick={stopSpeaking} className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white">
            <Volume2 size={13} /> Interrumpir voz
          </button>
        )}
        {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      </div>
    </section>
  );
}
