'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_FRAME_EDGE = 1280;

type VisionQuestionHandler = (question: string) => Promise<string>;

export interface LiveVisionStatus {
  cameraActive: boolean;
  cameraStarting: boolean;
  isAnalyzing: boolean;
  error: string;
  analysis: string;
}

interface LiveVisionProps {
  autoStart?: boolean;
  onAskReady?: (handler: VisionQuestionHandler | null) => void;
  onStatusChange?: (status: LiveVisionStatus) => void;
}

export function LiveVision({ autoStart = false, onAskReady, onStatusChange }: LiveVisionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const isComponentMountedRef = useRef(false);
  const didAutoStartRef = useRef(false);
  const cameraStartingRef = useRef(false);
  const cameraActiveRef = useRef(false);
  const isAnalyzingRef = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    isComponentMountedRef.current = true;
    return () => {
      isComponentMountedRef.current = false;
      cameraActiveRef.current = false;
      analysisAbortRef.current?.abort();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopCamera = useCallback(() => {
    cameraActiveRef.current = false;
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setIsAnalyzing(false);
    isAnalyzingRef.current = false;
  }, []);

  const captureAndAnalyze = useCallback(async (question: string) => {
    if (!cameraActiveRef.current) {
      throw new Error('La cámara todavía no está activa. Espera un momento y vuelve a preguntar.');
    }
    if (isAnalyzingRef.current) {
      throw new Error('Ya estoy analizando la pregunta anterior. Espera un momento.');
    }
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      throw new Error('La cámara todavía no tiene un fotograma disponible. Vuelve a preguntar en un momento.');
    }

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    setError('');
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    try {
      const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('El navegador no pudo preparar la imagen de la cámara.');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/jpeg', 0.74);

      const response = await fetch('/api/tools/live-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, question }),
        signal: controller.signal,
      });
      const result = (await response.json()) as { analysis?: string; error?: string };
      if (!response.ok || !result.analysis) {
        throw new Error(result.error ?? 'No se pudo analizar el fotograma.');
      }
      if (!isComponentMountedRef.current) throw new Error('La visión en directo se cerró antes de completar el análisis.');
      setAnalysis(result.analysis);
      return result.analysis;
    } catch (analysisError) {
      if (isComponentMountedRef.current && !controller.signal.aborted) {
        setError(analysisError instanceof Error ? analysisError.message : 'Error al analizar la imagen.');
      }
      throw analysisError;
    } finally {
      if (analysisAbortRef.current === controller) analysisAbortRef.current = null;
      isAnalyzingRef.current = false;
      if (isComponentMountedRef.current) setIsAnalyzing(false);
    }
  }, []);

  useEffect(() => {
    onAskReady?.(captureAndAnalyze);
    return () => onAskReady?.(null);
  }, [captureAndAnalyze, onAskReady]);

  useEffect(() => {
    onStatusChange?.({ cameraActive, cameraStarting, isAnalyzing, error, analysis });
  }, [analysis, cameraActive, cameraStarting, error, isAnalyzing, onStatusChange]);

  const startCamera = useCallback(async () => {
    if (cameraStartingRef.current || cameraActiveRef.current) return;
    setError('');
    cameraStartingRef.current = true;
    setCameraStarting(true);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite acceder a la cámara. Usa HTTPS y un navegador compatible.');
      cameraStartingRef.current = false;
      setCameraStarting(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (!isComponentMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('No se pudo preparar la vista de la cámara.');
      video.srcObject = stream;
      await video.play();
      if (!isComponentMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      cameraActiveRef.current = true;
      setCameraActive(true);
    } catch (cameraError) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (!isComponentMountedRef.current) return;
      if (cameraError instanceof Error && ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(cameraError.name)) {
        setError('El acceso a la cámara está denegado. Habilítalo en los permisos del sitio y vuelve a intentarlo.');
      } else if (cameraError instanceof Error && cameraError.name === 'NotFoundError') {
        setError('No se encontró una cámara disponible en este dispositivo.');
      } else if (cameraError instanceof Error && cameraError.name === 'NotReadableError') {
        setError('La cámara está ocupada por otra aplicación. Ciérrala e inténtalo de nuevo.');
      } else {
        setError(cameraError instanceof Error
          ? `No se pudo iniciar la cámara: ${cameraError.message}`
          : 'No se pudo iniciar la cámara. Comprueba los permisos y vuelve a intentarlo.');
      }
    } finally {
      cameraStartingRef.current = false;
      if (isComponentMountedRef.current) setCameraStarting(false);
    }
  }, []);

  useEffect(() => {
    if (!autoStart || didAutoStartRef.current) return;
    didAutoStartRef.current = true;
    void startCamera();
  }, [autoStart, startCamera]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      aria-hidden="true"
      tabIndex={-1}
      className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
    />
  );
}
