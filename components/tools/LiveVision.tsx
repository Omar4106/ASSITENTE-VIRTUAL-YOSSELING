'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, LoaderCircle, ScanEye, Volume2 } from 'lucide-react';
import { useVoice } from '@/hooks/useVoice';

const MAX_FRAME_EDGE = 1280;

export function LiveVision() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [question, setQuestion] = useState('Describe lo que ves y señala los detalles más importantes.');
  const [analysis, setAnalysis] = useState('');
  const [error, setError] = useState('');
  const { speak } = useVoice();

  useEffect(() => {
    setIsMounted(true);
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  const startCamera = async () => {
    setError('');
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite acceder a la cámara. Usa HTTPS y un navegador compatible.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (cameraError) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(cameraError instanceof Error && cameraError.name === 'NotAllowedError'
        ? 'Permite el acceso a la cámara desde los ajustes del navegador.'
        : 'No pude iniciar la cámara. Comprueba que no esté siendo usada por otra aplicación.');
    }
  };

  const captureAndAnalyze = async () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError('Espera a que la cámara muestre la imagen antes de capturar.');
      return;
    }
    setError('');
    setIsAnalyzing(true);
    try {
      const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('El navegador no pudo preparar la imagen.');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/jpeg', 0.82);

      const response = await fetch('/api/tools/live-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, question }),
      });
      const result = (await response.json()) as { analysis?: string; error?: string };
      if (!response.ok || !result.analysis) throw new Error(result.error ?? 'No se pudo analizar el fotograma.');
      setAnalysis(result.analysis);
      speak(result.analysis);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Error al analizar la imagen.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isMounted) {
    return <div className="p-6 text-zinc-400">Cargando herramienta...</div>;
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-white"><ScanEye size={18} className="text-emerald-300" /> Visión en directo</h2>
        <p className="mt-1 text-xs text-white/55">Vista previa local y análisis de fotogramas bajo demanda. La cámara no se transmite hasta que pulses analizar.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label="Vista previa de la cámara"
          className={`aspect-video max-h-[55vh] w-full object-contain ${cameraActive ? 'block' : 'hidden'}`}
        />
        {!cameraActive && (
          <div className="flex aspect-video max-h-[55vh] flex-col items-center justify-center gap-3 text-white/45">
            <CameraOff size={30} />
            <span className="text-xs">Cámara apagada</span>
          </div>
        )}
      </div>

      <label className="block space-y-1.5 text-xs text-white/65">
        ¿Qué quieres que analice?
        <input
          required
          value={question}
          maxLength={1000}
          onChange={(event) => setQuestion(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/50"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {!cameraActive ? (
          <button type="button" onClick={() => void startCamera()} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-300/20">
            <Camera size={14} /> Activar cámara
          </button>
        ) : (
          <>
            <button type="button" onClick={() => void captureAndAnalyze()} disabled={isAnalyzing} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-300/20 disabled:opacity-50">
              {isAnalyzing ? <LoaderCircle size={14} className="animate-spin" /> : <ScanEye size={14} />}
              {isAnalyzing ? 'Analizando…' : 'Capturar y analizar'}
            </button>
            <button type="button" onClick={stopCamera} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65 hover:bg-white/5 hover:text-white">
              <CameraOff size={14} /> Apagar cámara
            </button>
          </>
        )}
      </div>

      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      {analysis && (
        <div className="space-y-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-white">Análisis del fotograma</h3>
            <button type="button" onClick={() => speak(analysis)} className="inline-flex items-center gap-1.5 text-xs text-emerald-200 hover:text-white"><Volume2 size={14} /> Escuchar</button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">{analysis}</p>
        </div>
      )}
    </section>
  );
}
