'use client';

import { useCallback, useRef, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
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

function selectBrowserVoice(
  voices: SpeechSynthesisVoice[],
  language: string,
  preferredName: string,
): SpeechSynthesisVoice | undefined {
  const isSpanish = language !== 'en';
  const languageVoices = voices.filter((voice) =>
    isSpanish ? /^es(?:-|$)/i.test(voice.lang) : /^en(?:-|$)/i.test(voice.lang),
  );
  const preferred = languageVoices.find((voice) =>
    preferredName && voice.name.toLowerCase() === preferredName.toLowerCase(),
  );
  if (preferred) return preferred;

  const femaleVoiceNames =
    /helena|laura|sabina|mia|paulina|mónica|monica|lucía|lucia|ximena|sofia|samantha|zira|aria|jenny|female|google español|google spanish/i;
  const preferredGenderVoice = languageVoices.find((voice) => femaleVoiceNames.test(voice.name));
  if (preferredGenderVoice) return preferredGenderVoice;

  return languageVoices.find((voice) => /natural|neural|online|google/i.test(voice.name))
    ?? languageVoices.find((voice) => voice.localService)
    ?? languageVoices[0];
}

function speakWithBrowserTTS(
  text: string,
  setVoiceState: Dispatch<SetStateAction<VoiceState>>,
  setIsSpeaking: (v: boolean) => void,
  onEnd: () => void,
  voiceSettings?: { rate: number; pitch: number; volume: number; language: string; voiceName?: string },
  voices: SpeechSynthesisVoice[] = [],
  isCurrent: () => boolean = () => true,
  isMuted: () => boolean = () => false,
  onUtteranceCreated: (utterance: SpeechSynthesisUtterance | null) => void = () => undefined,
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    toast({ title: 'No se pudo generar la voz en este momento', variant: 'destructive' });
    setIsSpeaking(false);
    setVoiceState({ isSpeaking: false, isPaused: false, currentWord: '', progress: 0, duration: 0, currentTime: 0 });
    return;
  }
  const synthesis = window.speechSynthesis;
  synthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text.slice(0, 3000));
  onUtteranceCreated(utter);
  const language = voiceSettings?.language === 'en' ? 'en-US' : 'es-ES';
  utter.lang = language;
  const availableVoices = voices.length ? voices : synthesis.getVoices();
  const selectedVoice = selectBrowserVoice(
    availableVoices,
    voiceSettings?.language ?? 'es',
    voiceSettings?.voiceName ?? '',
  );
  if (selectedVoice) {
    utter.voice = selectedVoice;
    utter.lang = selectedVoice.lang;
  }
  const rate = Math.max(0.85, Math.min(1.15, voiceSettings?.rate ?? 1.02));
  utter.rate = rate;
  utter.pitch = Math.max(0.9, Math.min(1.2, voiceSettings?.pitch ?? 1.05));
  utter.volume = isMuted() ? 0 : (voiceSettings?.volume ?? 1.0);
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const estimatedDuration = Math.max(1, Math.ceil(wordCount / (2.5 * rate)));
  let elapsedBeforePause = 0;
  let startedAt = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
  };

  utter.onstart = () => {
    if (!isCurrent()) return;
    startedAt = Date.now();
    elapsedBeforePause = 0;
    stopTimer();
    timer = setInterval(() => {
      if (!isCurrent()) {
        stopTimer();
        return;
      }
      const currentTime = Math.min(estimatedDuration, elapsedBeforePause + (Date.now() - startedAt) / 1000);
      setVoiceState((state) => ({
        ...state,
        isSpeaking: true,
        isPaused: false,
        currentTime,
        duration: estimatedDuration,
        progress: Math.min(99, Math.round((currentTime / estimatedDuration) * 100)),
      }));
    }, 250);
    setVoiceState({
      isSpeaking: true,
      isPaused: false,
      currentWord: '',
      progress: 0,
      duration: estimatedDuration,
      currentTime: 0,
    });
  };
  utter.onboundary = (e) => {
    if (isCurrent() && e.name === 'word') {
      const pct = text.length > 0 ? Math.min(100, Math.round((e.charIndex / text.length) * 100)) : 0;
      setVoiceState((state) => ({
        ...state,
        isSpeaking: true,
        isPaused: false,
        currentWord: text.slice(e.charIndex, e.charIndex + 20).split(' ')[0] ?? '',
        progress: Math.max(state.progress, pct),
      }));
    }
  };
  utter.onpause = () => {
    if (!isCurrent()) return;
    elapsedBeforePause += startedAt ? (Date.now() - startedAt) / 1000 : 0;
    startedAt = 0;
    stopTimer();
    setVoiceState((state) => ({ ...state, isSpeaking: true, isPaused: true }));
  };
  utter.onresume = () => {
    if (!isCurrent()) return;
    startedAt = Date.now();
    stopTimer();
    timer = setInterval(() => {
      if (!isCurrent()) {
        stopTimer();
        return;
      }
      const currentTime = Math.min(estimatedDuration, elapsedBeforePause + (Date.now() - startedAt) / 1000);
      setVoiceState((state) => ({
        ...state,
        isSpeaking: true,
        isPaused: false,
        currentTime,
        duration: estimatedDuration,
        progress: Math.min(99, Math.round((currentTime / estimatedDuration) * 100)),
      }));
    }, 250);
    setVoiceState((state) => ({ ...state, isSpeaking: true, isPaused: false }));
  };
  utter.onend = () => {
    stopTimer();
    onUtteranceCreated(null);
    if (isCurrent()) {
      setVoiceState((state) => ({
        ...state,
        isSpeaking: false,
        isPaused: false,
        progress: 100,
        currentTime: state.duration,
      }));
      onEnd();
    }
  };
  utter.onerror = () => {
    stopTimer();
    onUtteranceCreated(null);
    if (isCurrent()) onEnd();
  };
  synthesis.speak(utter);
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
  const speechRequestRef = useRef(0);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isMutedRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isSpeaking: false,
    isPaused: false,
    currentWord: '',
    progress: 0,
    duration: 0,
    currentTime: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const synthesis = window.speechSynthesis;
    const updateVoices = () => {
      voicesRef.current = synthesis.getVoices();
    };
    updateVoices();
    synthesis.addEventListener('voiceschanged', updateVoices);
    return () => synthesis.removeEventListener('voiceschanged', updateVoices);
  }, []);

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

  const speak = useCallback(async (text: string, personality?: PersonalityStyle, preferBrowser = false) => {
    const requestId = ++speechRequestRef.current;
    const isCurrentRequest = () => speechRequestRef.current === requestId;
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

    const startBrowserFallback = () => {
      if (!isCurrentRequest()) return;
      fallbackRef.current = true;
      speakWithBrowserTTS(
        textToRead,
        setVoiceState,
        setIsSpeaking,
        resetState,
        voiceSettings,
        voicesRef.current,
        isCurrentRequest,
        () => isMutedRef.current,
        (utterance) => { activeUtteranceRef.current = utterance; },
      );
    };

    if (preferBrowser) {
      startBrowserFallback();
      return;
    }

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToRead.slice(0, 3000), personality }),
      });
      if (!isCurrentRequest()) return;

      if (!response.ok) {
        let errMsg = 'No se pudo generar la voz en este momento';
        try {
          const errData = await response.json() as { error?: string };
          if (errData.error) errMsg = errData.error;
        } catch { /* response wasn't JSON */ }
        toast({ title: 'Usando voz del navegador como respaldo', description: errMsg });
        startBrowserFallback();
        return;
      }

      const contentType = response.headers.get('Content-Type') ?? '';
      if (!contentType.includes('audio/')) {
        toast({ title: 'Usando voz del navegador como respaldo' });
        startBrowserFallback();
        return;
      }

      const audioBlob = await response.blob();
      if (!isCurrentRequest()) return;

      if (!audioBlob || audioBlob.size === 0) {
        toast({ title: 'Usando voz del navegador como respaldo' });
        startBrowserFallback();
        return;
      }

      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      audio.muted = isMutedRef.current;
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
        activeUtteranceRef.current = null;
        lastProgressRef.current = 100;
        resetState();
      };

      audio.onerror = () => {
        if (!isCurrentRequest()) return;
        URL.revokeObjectURL(audioUrl);
        lastProgressRef.current = 0;
        toast({ title: 'Usando voz del navegador como respaldo' });
        startBrowserFallback();
      };

      await audio.play();
    } catch {
      if (!isCurrentRequest()) return;
      toast({ title: 'Usando voz del navegador como respaldo' });
      startBrowserFallback();
    }
  }, [setIsSpeaking, resetState, voiceSettings]);

  const stopSpeaking = useCallback(() => {
    speechRequestRef.current += 1;
    activeUtteranceRef.current = null;
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
      if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
      }
    } else {
      audioRef.current?.pause();
    }
    setVoiceState(s => ({ ...s, isPaused: true }));
  }, []);

  const resumeSpeaking = useCallback(() => {
    if (fallbackRef.current) {
      if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } else {
      void audioRef.current?.play();
    }
    setVoiceState(s => ({ ...s, isPaused: false }));
  }, []);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    if (audioRef.current) audioRef.current.muted = nextMuted;
    if (activeUtteranceRef.current) {
      activeUtteranceRef.current.volume = nextMuted ? 0 : (voiceSettings.volume ?? 1);
    }
  }, [voiceSettings.volume]);

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
    startListening, stopListening, getAvailableVoices, toggleMute, isMuted,
    voiceState,
  };
}
