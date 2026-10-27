'use client';

import { useEffect, useState } from 'react';
import { BriefcaseBusiness, Check, Clipboard, ExternalLink, FileText, LoaderCircle, Mail, Upload, X } from 'lucide-react';
import type { JobRadarResponse } from '@/lib/tools';

const MAX_CV_BYTES = 10 * 1024 * 1024;
const JOB_RADAR_CACHE_PREFIX = 'yosseling-job-radar-v1:';
const JOB_RADAR_CACHE_TTL_MS = 15 * 60 * 1000;

interface JobRadarCacheEntry {
  createdAt: number;
  result: JobRadarResponse;
}

function isJobRadarResponse(value: unknown): value is JobRadarResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<JobRadarResponse>;
  return Boolean(
    candidate.profile &&
    Array.isArray(candidate.profile.skills) &&
    typeof candidate.profile.experience === 'string' &&
    typeof candidate.profile.education === 'string' &&
    Array.isArray(candidate.skillGap) &&
    Array.isArray(candidate.interviewQuestions) &&
    Array.isArray(candidate.jobs),
  );
}

async function getJobRadarCacheKey(cvText: string, country: string, profession: string): Promise<string | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
  try {
    const input = JSON.stringify([cvText.trim(), country.trim(), profession.trim()]);
    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${JOB_RADAR_CACHE_PREFIX}${hash}`;
  } catch (cacheError) {
    console.warn('[JobRadar] Session cache key could not be generated:', cacheError);
    return null;
  }
}

async function readJobRadarCache(key: string | null): Promise<JobRadarResponse | null> {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<JobRadarCacheEntry>;
    if (
      typeof entry.createdAt !== 'number' ||
      Date.now() - entry.createdAt > JOB_RADAR_CACHE_TTL_MS ||
      !isJobRadarResponse(entry.result)
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return entry.result;
  } catch (cacheError) {
    console.warn('[JobRadar] Session cache could not be read:', cacheError);
    return null;
  }
}

function writeJobRadarCache(key: string | null, result: JobRadarResponse): void {
  if (!key || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ createdAt: Date.now(), result } satisfies JobRadarCacheEntry));
  } catch (cacheError) {
    console.warn('[JobRadar] Session cache could not be saved:', cacheError);
  }
}

const COUNTRIES = [
  'Panamá', 'Colombia', 'México', 'España', 'Estados Unidos', 'Argentina',
  'Chile', 'Costa Rica', 'Perú', 'Ecuador', 'Guatemala', 'El Salvador',
  'Honduras', 'Nicaragua', 'República Dominicana', 'Uruguay', 'Paraguay',
  'Bolivia', 'Venezuela', 'Canadá', 'Reino Unido', 'Alemania', 'Otro',
];

const PROFESSIONS = [
  'Desarrollador de software', 'Desarrollador frontend', 'Desarrollador backend',
  'Analista de datos', 'Soporte IT', 'Administrador de sistemas',
  'Ciberseguridad', 'Biólogo', 'Biotecnología', 'Microbiología',
  'Asistente de laboratorio', 'Investigación científica', 'Administración',
  'Recursos humanos', 'Contabilidad', 'Atención al cliente', 'Ventas',
  'Marketing digital', 'Diseño gráfico', 'Gestión de proyectos',
  'Servicios generales', 'Otro',
];

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return pages.join('\n');
}

export function JobRadar() {
  const [isMounted, setIsMounted] = useState(false);
  const [cvName, setCvName] = useState('');
  const [cvText, setCvText] = useState('');
  const [country, setCountry] = useState('');
  const [profession, setProfession] = useState('');
  const [result, setResult] = useState<JobRadarResponse | null>(null);
  const [error, setError] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [letterCopied, setLetterCopied] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleFile = async (file?: File) => {
    if (typeof window === 'undefined') return;
    if (!file) return;
    setError('');
    setResult(null);
    setCoverLetter('');
    if (file.size > MAX_CV_BYTES) {
      setError('El CV supera el límite de 10 MB.');
      return;
    }

    setIsReading(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'pdf' || file.type === 'application/pdf') {
        setCvText(await extractPdfText(file));
      } else if (extension === 'txt' || file.type.startsWith('text/')) {
        setCvText(await file.text());
      } else {
        throw new Error('Formato no compatible. Sube un archivo PDF o TXT.');
      }
      setCvName(file.name);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'No pude leer el CV.');
      setCvText('');
      setCvName('');
    } finally {
      setIsReading(false);
    }
  };

  const analyze = async (event: React.FormEvent<HTMLFormElement>) => {
    if (typeof window === 'undefined') return;
    event.preventDefault();
    setError('');
    setResult(null);
    setCoverLetter('');
    setIsSearching(true);
    try {
      const cacheKey = await getJobRadarCacheKey(cvText, country, profession);
      const cachedResult = await readJobRadarCache(cacheKey);
      if (cachedResult) {
        setResult(cachedResult);
        return;
      }

      const response = await fetch('/api/tools/job-radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvText, country, profession }),
      });
      const data = (await response.json()) as JobRadarResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'No se pudo analizar el perfil.');
      if (!isJobRadarResponse(data)) throw new Error('El servicio devolvió un análisis con formato inválido.');
      writeJobRadarCache(cacheKey, data);
      setResult(data);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Error al buscar coincidencias.');
    } finally {
      setIsSearching(false);
    }
  };

  const generateCoverLetter = () => {
    if (!result) return;
    const firstLine = cvText.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 1 && line.length < 70);
    const candidateName = firstLine && !/curriculum|resume|perfil profesional/i.test(firstLine)
      ? firstLine
      : 'Candidato/a';
    const topSkills = result.profile.skills.slice(0, 4);
    setCoverLetter([
      `Estimado equipo de selección:`,
      '',
      `Me gustaría postularme a oportunidades de ${profession} en ${country}. Mi experiencia y formación, resumidas en mi CV, me han permitido desarrollar una base profesional que deseo aportar a su equipo.`,
      topSkills.length ? `Entre mis competencias relevantes se encuentran ${topSkills.join(', ')}.` : 'Estoy motivado/a para aportar mis conocimientos, aprender y contribuir a los objetivos del equipo.',
      `Me interesa especialmente seguir creciendo en ${profession} y aportar compromiso, capacidad de aprendizaje y atención a la calidad del trabajo.`,
      '',
      'Gracias por considerar mi perfil. Quedo disponible para conversar sobre cómo puedo contribuir a la posición.',
      '',
      `Atentamente,\n${candidateName}`,
    ].join('\n\n'));
  };

  const copyCoverLetter = async () => {
    if (!coverLetter || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(coverLetter);
      setLetterCopied(true);
      window.setTimeout(() => setLetterCopied(false), 1800);
    } catch (copyError) {
      setError(copyError instanceof Error ? 'No se pudo copiar la carta. Selecciona el texto y cópialo manualmente.' : 'No se pudo copiar la carta.');
    }
  };

  if (!isMounted) {
    return <div className="p-6 text-zinc-400">Cargando herramienta...</div>;
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <BriefcaseBusiness size={18} className="text-cyan-300" /> Radar de empleo
        </h2>
        <p className="mt-1 text-xs text-white/55">Analiza tu CV y calcula coincidencias. Los enlaces llevan a búsquedas externas; no son ofertas verificadas.</p>
      </div>

      <form onSubmit={analyze} className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <label className="flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-dashed border-white/15 p-3 hover:border-cyan-300/40">
          <Upload size={17} className="text-cyan-300" />
          <span className="min-w-0 flex-1 text-sm text-white/80">
            {isReading ? 'Leyendo CV...' : cvName || 'Subir CV PDF o TXT'}
          </span>
          {isReading && <LoaderCircle size={16} className="animate-spin text-cyan-300" />}
          <input
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="sr-only"
            disabled={isReading || isSearching}
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </label>
        {cvText && (
          <p className="flex items-center gap-1 text-xs text-green-300">
            <FileText size={13} /> Texto extraído ({cvText.length.toLocaleString()} caracteres)
          </p>
        )}
        {cvText && <p className="text-[11px] text-white/40">El resultado se puede guardar en la sesión actual hasta 15 minutos. El texto original del CV no se almacena en la caché.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs text-white/65">
            País o región
            <input
              list="job-radar-countries"
              required
              maxLength={80}
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              placeholder="Busca o escribe un país"
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50"
            />
            <datalist id="job-radar-countries">
              {COUNTRIES.map((item) => <option key={item} value={item} />)}
            </datalist>
          </label>
          <label className="space-y-1.5 text-xs text-white/65">
            Profesión objetivo
            <input
              list="job-radar-professions"
              required
              maxLength={100}
              value={profession}
              onChange={(event) => setProfession(event.target.value)}
              placeholder="Busca o escribe un área"
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50"
            />
            <datalist id="job-radar-professions">
              {PROFESSIONS.map((item) => <option key={item} value={item} />)}
            </datalist>
          </label>
        </div>
        <button
          type="submit"
          disabled={!cvText || isReading || isSearching}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSearching ? <LoaderCircle size={15} className="animate-spin" /> : <BriefcaseBusiness size={15} />}
          Analizar compatibilidad
        </button>
        {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      </form>

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-medium text-white">Perfil detectado</h3>
            <p className="mt-2 text-xs text-white/60">Experiencia: {result.profile.experience} · Formación: {result.profile.education}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.profile.skills.length ? result.profile.skills.map((skill) => (
                <span key={skill} className="rounded-full bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-100">{skill}</span>
              )) : <span className="text-xs text-white/50">No se detectaron habilidades del catálogo.</span>}
            </div>
          </div>

          <div className="rounded-xl border border-orange-300/15 bg-orange-300/[0.04] p-4">
            <h3 className="text-sm font-medium text-white">Habilidades y tecnologías por reforzar</h3>
            <p className="mt-1 text-[11px] text-white/50">Sugerencias orientativas para fortalecer tu perfil y su relevancia en filtros ATS.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {result.skillGap.length ? result.skillGap.map((skill) => (
                <span key={skill} className="rounded-full border border-orange-200/10 bg-orange-200/[0.06] px-2.5 py-1 text-xs text-orange-100">{skill}</span>
              )) : <p className="text-xs text-green-200">No se detectaron brechas en las habilidades clave de este perfil.</p>}
            </div>
          </div>

          <div className="rounded-xl border border-purple-300/15 bg-purple-300/[0.04] p-4">
            <h3 className="text-sm font-medium text-white">Simulador de entrevista</h3>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-xs leading-relaxed text-white/70">
              {result.interviewQuestions.map((question) => <li key={question}>{question}</li>)}
            </ol>
          </div>

          <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-white">Carta de presentación</h3>
                <p className="mt-1 text-[11px] text-white/50">Borrador orientativo basado en la información extraída de tu CV.</p>
              </div>
              <button type="button" onClick={generateCoverLetter} className="inline-flex items-center gap-2 rounded-lg bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-100 transition-colors hover:bg-cyan-400/20">
                <Mail size={14} /> {coverLetter ? 'Regenerar carta' : 'Generar Carta de Presentación'}
              </button>
            </div>
            {coverLetter && (
              <div className="mt-3 space-y-2">
                <textarea
                  aria-label="Borrador de carta de presentación"
                  value={coverLetter}
                  onChange={(event) => setCoverLetter(event.target.value)}
                  rows={9}
                  className="w-full resize-y rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-white/75 outline-none focus:border-cyan-300/40"
                />
                <button type="button" onClick={() => void copyCoverLetter()} className="inline-flex items-center gap-1.5 text-xs text-cyan-200 hover:text-white">
                  {letterCopied ? <Check size={13} /> : <Clipboard size={13} />}
                  {letterCopied ? 'Copiada' : 'Copiar carta'}
                </button>
              </div>
            )}
          </div>

          <ul className="space-y-3">
            {result.jobs.map((job) => (
              <li key={job.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{job.title}</h3>
                    <p className="mt-1 text-xs text-white/55">{job.company}</p>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
                    {job.matchScore}% match
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    {job.matchedRequirements.map((requirement) => (
                      <p key={requirement} className="flex items-center gap-1.5 text-xs text-green-200/80"><Check size={12} />{requirement}</p>
                    ))}
                    {!job.matchedRequirements.length && <p className="text-xs text-white/45">Sin requisitos coincidentes aún.</p>}
                  </div>
                  <div className="space-y-1">
                    {job.missingRequirements.map((requirement) => (
                      <p key={requirement} className="flex items-center gap-1.5 text-xs text-orange-200/75"><X size={12} />{requirement}</p>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                  <span className="text-[10px] text-white/40">{job.sourceLabel}</span>
                  <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-cyan-200 hover:text-white">
                    Buscar vacantes <ExternalLink size={12} />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
