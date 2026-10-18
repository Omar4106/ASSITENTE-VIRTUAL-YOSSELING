'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { toast } from '@/hooks/use-toast';
import type { PersonalityStyle } from '@/types';

export interface VoiceState {
  isSpeaking: boolean;
  isPaused: boolean;
  currentWord: string;
  progress: number;
  duration: number;
  currentTime: number;
}

function speakWithBrowserTTS(text: string, setVoiceState: (s: VoiceState) => void, setIsSpeaking: (v: boolean) => void, onEnd: () => void, voiceSettings?: { rate: number; pitch: number; volume: number; language: string }) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    toast({ title: 'No se pudo generar la voz en este momento', variant: 'destructive' });
    setIsSpeaking(false);
    setVoiceState({ isSpeaking: false, isPaused: false, currentWord: '', progress: 0, duration: 0, currentTime: 0 });
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text.slice(0, 3000));
  utter.lang = voiceSettings?.language === 'en' ? 'en-US' : 'es-ES';
  utter.rate = voiceSettings?.rate ?? 1.0;
  utter.pitch = voiceSettings?.pitch ?? 1.0;
  utter.volume = voiceSettings?.volume ?? 1.0;
  utter.onstart = () => {
    setVoiceState({ isSpeaking: true, isPaused: false, currentWord: '', progress: 0, duration: 0, currentTime: 0 });
  };
  utter.onboundary = (e) => {
    if (e.name === 'word') {
      const pct = text.length > 0 ? Math.min(100, Math.round((e.charIndex / text.length) * 100)) : 0;
      setVoiceState({ isSpeaking: true, isPaused: false, currentWord: text.slice(e.charIndex, e.charIndex + 20).split(' ')[0] ?? '', progress: pct, duration: 0, currentTime: 0 });
    }
  };
  utter.onend = onEnd;
  utter.onerror = onEnd;
  window.speechSynthesis.speak(utter);
}

export function useVoice() {
  const { setIsSpeaking, setIsListening, settings } = useAppStore();
  const voiceSettings = settings.voice;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const lastProgressRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const fallbackRef = useRef(false);
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isSpeaking: false,
    isPaused: false,
    currentWord: '',
    progress: 0,
    duration: 0,
    currentTime: 0,
  });

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const resetState = useCallback(() => {
    setIsSpeaking(false);
    setVoiceState({ isSpeaking: false, isPaused: false, currentWord: '', progress: 0, duration: 0, currentTime: 0 });
  }, [setIsSpeaking]);

  const speak = useCallback(async (text: string, personality?: PersonalityStyle) => {
    const selection = window.getSelection?.();
    const selectedText = selection?.toString().trim();
    const textToRead = selectedText && selectedText.length > 3 ? selectedText : text;

    if (!textToRead || textToRead.trim().length === 0) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    fallbackRef.current = false;
    lastProgressRef.current = 0;

    setIsSpeaking(true);
    setVoiceState({ isSpeaking: true, isPaused: false, currentWord: 'Generando voz...', progress: 0, duration: 0, currentTime: 0 });

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToRead.slice(0, 3000), personality }),
      });

      if (!response.ok) {
        let errMsg = 'No se pudo generar la voz en este momento';
        try {
          const errData = await response.json() as { error?: string };
          if (errData.error) errMsg = errData.error;
        } catch { /* response wasn't JSON */ }
        toast({ title: 'Usando voz del navegador como respaldo', description: errMsg });
        fallbackRef.current = true;
        speakWithBrowserTTS(textToRead, setVoiceState, setIsSpeaking, () => {
          resetState();
        }, voiceSettings);
        return;
      }

      const contentType = response.headers.get('Content-Type') ?? '';
      if (!contentType.includes('audio/')) {
        toast({ title: 'Usando voz del navegador como respaldo' });
        fallbackRef.current = true;
        speakWithBrowserTTS(textToRead, setVoiceState, setIsSpeaking, () => {
          resetState();
        }, voiceSettings);
        return;
      }

      const audioBlob = await response.blob();

      if (!audioBlob || audioBlob.size === 0) {
        toast({ title: 'Usando voz del navegador como respaldo' });
        fallbackRef.current = true;
        speakWithBrowserTTS(textToRead, setVoiceState, setIsSpeaking, () => {
          resetState();
        }, voiceSettings);
        return;
      }

      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      const words = textToRead.split(/\s+/).filter(Boolean);
      let wordIdx = 0;

      audio.ontimeupdate = () => {
        const dur = audio.duration || 0;
        const cur = audio.currentTime;
        const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
        const pctRounded = Math.round(pct);
        if (pctRounded === lastProgressRef.current) return;
        lastProgressRef.current = pctRounded;
        wordIdx = Math.min(Math.round((pct / 100) * words.length), words.length - 1);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          setVoiceState(s => ({ ...s, currentWord: words[wordIdx] ?? '', progress: pctRounded, currentTime: cur, duration: dur }));
        });
      };

      audio.onloadedmetadata = () => {
        setVoiceState(s => ({ ...s, duration: audio.duration || 0 }));
      };

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        lastProgressRef.current = 100;
        resetState();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        lastProgressRef.current = 0;
        toast({ title: 'Usando voz del navegador como respaldo' });
        fallbackRef.current = true;
        speakWithBrowserTTS(textToRead, setVoiceState, setIsSpeaking, () => {
          resetState();
        }, voiceSettings);
      };

      await audio.play();
    } catch {
      toast({ title: 'Usando voz del navegador como respaldo' });
      fallbackRef.current = true;
      speakWithBrowserTTS(textToRead, setVoiceState, setIsSpeaking, () => {
        resetState();
      }, voiceSettings);
    }
  }, [setIsSpeaking, resetState, voiceSettings]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    lastProgressRef.current = 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    resetState();
  }, [resetState]);

  const pauseSpeaking = useCallback(() => {
    if (fallbackRef.current) {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.pause();
    } else {
      audioRef.current?.pause();
    }
    setVoiceState(s => ({ ...s, isPaused: true }));
  }, []);

  const resumeSpeaking = useCallback(() => {
    if (fallbackRef.current) {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.resume();
    } else {
      audioRef.current?.play();
    }
    setVoiceState(s => ({ ...s, isPaused: false }));
  }, []);

  const seek = useCallback((time: number) => {
    if (!fallbackRef.current && audioRef.current) {
      const dur = audioRef.current.duration || 0;
      audioRef.current.currentTime = Math.max(0, Math.min(time, dur));
      setVoiceState(s => ({ ...s, currentTime: audioRef.current?.currentTime ?? 0 }));
    }
  }, []);

  const skipBy = useCallback((seconds: number) => {
    if (!fallbackRef.current && audioRef.current) {
      const dur = audioRef.current.duration || 0;
      const target = Math.max(0, Math.min(audioRef.current.currentTime + seconds, dur));
      audioRef.current.currentTime = target;
      setVoiceState(s => ({ ...s, currentTime: target }));
    }
  }, []);

  const getAvailableVoices = useCallback((): string[] => {
    return ['Voz de Yosseling'];
  }, []);

  const startListening = useCallback(async (onResult: (text: string) => void) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        setIsListening(false);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) return;

        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice.webm');

        try {
          const response = await fetch('/api/stt', {
            method: 'POST',
            body: formData,
          });
          const result = await response.json() as { text?: string; error?: string };
          if (result.text && result.text.trim()) {
            onResult(result.text.trim());
          }
        } catch {
          // silently fail
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch {
      alert('No pude acceder al micrófono. Verifica los permisos.');
      setIsListening(false);
    }
  }, [setIsListening]);

  const stopListening = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setIsListening(false);
  }, [setIsListening]);

  return {
    speak, stopSpeaking, pauseSpeaking, resumeSpeaking, seek, skipBy,
    startListening, stopListening, getAvailableVoices,
    voiceState,
  };
}
