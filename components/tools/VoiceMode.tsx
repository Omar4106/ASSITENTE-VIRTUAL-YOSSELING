'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

interface VoiceModeProps {
  onAskVision?: (question: string) => Promise<string | null>;
  onStatusChange?: (status: VoiceModeStatus) => void;
}

export interface VoiceModeStatus {
  active: boolean;
  listening: boolean;
  restarting: boolean;
  transcript: string;
  error: string;
}

export function VoiceMode({ onAskVision, onStatusChange }: VoiceModeProps = {}) {
  const { speak, stopSpeaking, voiceState } = useVoice();
  const { chats, activeChatId, isStreaming, sendMessage } = useAppStore();
  const [active, setActive] = useState(false);
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
  const onAskVisionRef = useRef(onAskVision);
  isSpeakingRef.current = voiceState.isSpeaking;
  isStreamingRef.current = isStreaming;
  onAskVisionRef.current = onAskVision;

  useEffect(() => {
    onStatusChange?.({
      active,
      listening,
      restarting,
      transcript,
      error,
    });
  }, [active, error, listening, onStatusChange, restarting, transcript]);

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

  const startConversation = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (activeRef.current) return;
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      setError('Este navegador no ofrece reconocimiento de voz. Prueba con una versión reciente de Chrome o Edge.');
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setError('Este navegador no ofrece reconocimiento de voz. Prueba con una versión reciente de Chrome o Edge.');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-ES';
    recognition.onstart = () => {
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
        restartAttemptsRef.current = 0;
        stopSpeaking();
        shouldListenRef.current = false;
        waitingForReplyRef.current = true;
        resumeAfterSpeechRef.current = true;
        pendingNavigationRef.current = getVoiceNavigationTarget(finalText);
        setListening(false);
        recognition.stop();
        void (async () => {
          try {
            const visualReply = await onAskVisionRef.current?.(finalText);
            if (visualReply !== null && visualReply !== undefined) {
              waitingForReplyRef.current = false;
              if (!activeRef.current) return;
              shouldListenRef.current = false;
              resumeAfterSpeechRef.current = true;
              await speak(visualReply, undefined, true);
              return;
            }
            await sendMessage(finalText);
          } catch (sendError: unknown) {
            pendingNavigationRef.current = null;
            waitingForReplyRef.current = false;
            if (sendError instanceof Error && sendError.name === 'AbortError') {
              if (activeRef.current) {
                shouldListenRef.current = true;
                startListening();
              }
              return;
            }
            setError(sendError instanceof Error ? sendError.message : 'No se pudo enviar la consulta por voz.');
            if (activeRef.current) {
              shouldListenRef.current = true;
              startListening();
            }
          }
        })();
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
  }, [scheduleRestart, sendMessage, speak, startListening, stopSpeaking]);

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
      if (target === 'vision') {
        window.dispatchEvent(new Event('yosseling:open-vision'));
      } else {
        window.dispatchEvent(new CustomEvent<VoiceNavigationTarget>('yosseling:navigate-tool', { detail: target }));
      }
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
    const handleVoiceStart = () => startConversation();
    const handleVoiceStop = () => stopConversation();
    window.addEventListener('yosseling:voice-start', handleVoiceStart);
    window.addEventListener('yosseling:voice-stop', handleVoiceStop);
    return () => {
      window.removeEventListener('yosseling:voice-start', handleVoiceStart);
      window.removeEventListener('yosseling:voice-stop', handleVoiceStop);
    };
  }, [startConversation, stopConversation]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      shouldListenRef.current = false;
      if (typeof window !== 'undefined' && restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
      recognitionRef.current?.abort();
      stopSpeaking();
    };
  }, [stopSpeaking]);

  return null;
}
