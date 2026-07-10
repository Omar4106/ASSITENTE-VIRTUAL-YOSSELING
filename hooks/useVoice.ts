'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';

export interface VoiceState {
  isSpeaking: boolean;
  isPaused: boolean;
  currentWord: string;
  progress: number; // 0-100
}

export function useVoice() {
  const { settings, setIsSpeaking, setIsListening } = useAppStore();
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<unknown>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isSpeaking: false,
    isPaused: false,
    currentWord: '',
    progress: 0,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  /** Pick best available voice — prefer female Spanish voices */
  const selectVoice = useCallback((): SpeechSynthesisVoice | null => {
    const synth = synthRef.current;
    if (!synth) return null;
    const voices = synth.getVoices();
    if (!voices.length) return null;
    const lang = settings.voice.language === 'es' ? 'es' : 'en';

    // Priority: female ES voice > any ES voice > female voice > first voice
    const esVoices = voices.filter(v => v.lang.toLowerCase().startsWith(lang));
    const femaleEsVoice = esVoices.find(v => {
      const n = v.name.toLowerCase();
      return n.includes('female') || n.includes('femenina') || n.includes('paulina') ||
             n.includes('mónica') || n.includes('monica') || n.includes('lucia') ||
             n.includes('lucia') || n.includes('lupe') || n.includes('marisol') ||
             n.includes('helena') || n.includes('jorge') === false;
    });
    if (femaleEsVoice) return femaleEsVoice;
    if (esVoices.length) return esVoices[0];
    const fallback = voices.find(v => v.name.toLowerCase().includes('female')) ?? voices[0];
    return fallback ?? null;
  }, [settings.voice.language]);

  const speak = useCallback((text: string) => {
    const synth = synthRef.current;
    if (!synth) return;
    synth.cancel();

    // If user has selected text, read only that
    const selection = window.getSelection?.();
    const selectedText = selection?.toString().trim();
    const textToRead = selectedText && selectedText.length > 3 ? selectedText : text;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    const voice = selectVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = settings.voice.rate;
    utterance.pitch = settings.voice.pitch;
    utterance.volume = settings.voice.volume;
    utterance.lang = settings.voice.language === 'es' ? 'es-ES' : 'en-US';

    const words = textToRead.split(/\s+/).filter(Boolean);
    let wordIdx = 0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setVoiceState({ isSpeaking: true, isPaused: false, currentWord: words[0] ?? '', progress: 0 });
    };
    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        wordIdx = Math.min(wordIdx + 1, words.length - 1);
        const progress = Math.round((wordIdx / words.length) * 100);
        setVoiceState(s => ({ ...s, currentWord: words[wordIdx] ?? '', progress }));
      }
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setVoiceState({ isSpeaking: false, isPaused: false, currentWord: '', progress: 100 });
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setVoiceState({ isSpeaking: false, isPaused: false, currentWord: '', progress: 0 });
    };

    utteranceRef.current = utterance;
    synth.speak(utterance);
  }, [settings.voice, selectVoice, setIsSpeaking]);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
    setVoiceState({ isSpeaking: false, isPaused: false, currentWord: '', progress: 0 });
  }, [setIsSpeaking]);

  const pauseSpeaking = useCallback(() => {
    synthRef.current?.pause();
    setVoiceState(s => ({ ...s, isPaused: true }));
  }, []);

  const resumeSpeaking = useCallback(() => {
    synthRef.current?.resume();
    setVoiceState(s => ({ ...s, isPaused: false }));
  }, []);

  const getAvailableVoices = useCallback((): SpeechSynthesisVoice[] => {
    return synthRef.current?.getVoices() ?? [];
  }, []);

  /** Speech-to-text */
  interface SpeechRecognitionLike {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    maxAlternatives: number;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onresult: ((e: { results: SpeechRecognitionResultList }) => void) | null;
    start(): void;
    stop(): void;
  }

  const startListening = useCallback((onResult: (text: string) => void, continuous = false) => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRecognitionCls = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SpeechRecognitionCls) {
      alert('El reconocimiento de voz no está disponible en este navegador. Prueba con Chrome.');
      return;
    }
    const recognition = new SpeechRecognitionCls();
    recognition.lang = settings.voice.language === 'es' ? 'es-ES' : 'en-US';
    recognition.interimResults = false;
    recognition.continuous = continuous;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e) => {
      console.warn('[Yosseling Voice] STT error:', e.error);
      setIsListening(false);
    };
    recognition.onresult = (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript;
      if (transcript.trim()) onResult(transcript.trim());
    };
    recognition.start();
    recognitionRef.current = recognition;
  }, [settings.voice.language, setIsListening]);

  const stopListening = useCallback(() => {
    (recognitionRef.current as SpeechRecognitionLike | null)?.stop();
    setIsListening(false);
  }, [setIsListening]);

  return {
    speak, stopSpeaking, pauseSpeaking, resumeSpeaking,
    startListening, stopListening, getAvailableVoices,
    voiceState,
  };
}
