'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/lib/store';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void) | null;
  start(): void;
  stop(): void;
}

export function useVoice() {
  const { settings, setIsSpeaking, setIsListening } = useAppStore();
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synthRef.current.getVoices();
    const lang = settings.voice.language === 'es' ? 'es' : 'en';
    const voice = voices.find(v => v.lang.startsWith(lang) && v.name.toLowerCase().includes('female'))
      || voices.find(v => v.lang.startsWith(lang))
      || voices.find(v => settings.voice.voiceName && v.name === settings.voice.voiceName);
    if (voice) utterance.voice = voice;
    utterance.rate = settings.voice.rate;
    utterance.pitch = settings.voice.pitch;
    utterance.volume = settings.voice.volume;
    utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthRef.current.speak(utterance);
  }, [settings.voice, setIsSpeaking]);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, [setIsSpeaking]);

  const startListening = useCallback((onResult: (text: string) => void) => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRecognitionCls = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionCls) {
      alert('El reconocimiento de voz no es compatible con este navegador.');
      return;
    }
    const recognition = new SpeechRecognitionCls();
    recognition.lang = settings.voice.language === 'es' ? 'es-ES' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
    };
    recognition.start();
    recognitionRef.current = recognition;
  }, [settings.voice.language, setIsListening]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, [setIsListening]);

  return { speak, stopSpeaking, startListening, stopListening };
}
