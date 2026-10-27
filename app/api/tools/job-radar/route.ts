import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getClientIp } from '@/lib/security';

export const runtime = 'nodejs';

const requestSchema = z.object({
  cvText: z.string().trim().min(30).max(100_000),
  country: z.string().trim().min(2).max(80),
  profession: z.string().trim().min(2).max(100),
});

const SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Python', 'SQL',
  'AWS', 'Azure', 'Docker', 'Git', 'Linux', 'Soporte técnico', 'Redes',
  'Ciberseguridad', 'Excel', 'Atención al cliente', 'Ventas', 'Comunicación',
  'Gestión de proyectos', 'Análisis de datos', 'Investigación', 'Laboratorio',
  'Biología', 'Microbiología', 'Bioinformática', 'Control de calidad',
  'Documentación', 'Resolución de problemas', 'Inglés',
];

const ROLE_REQUIREMENTS: Array<{ title: string; keywords: string[] }> = [
  { title: 'Desarrollador/a Frontend', keywords: ['JavaScript', 'TypeScript', 'React', 'Next.js', 'Git'] },
  { title: 'Desarrollador/a Backend', keywords: ['Node.js', 'Python', 'SQL', 'Docker', 'Git'] },
  { title: 'Analista de datos', keywords: ['Python', 'SQL', 'Excel', 'Análisis de datos', 'Comunicación'] },
  { title: 'Especialista de soporte IT', keywords: ['Soporte técnico', 'Redes', 'Linux', 'Resolución de problemas', 'Documentación'] },
  { title: 'Técnico/a de laboratorio', keywords: ['Laboratorio', 'Biología', 'Microbiología', 'Control de calidad', 'Documentación'] },
  { title: 'Asistente de investigación biológica', keywords: ['Biología', 'Investigación', 'Laboratorio', 'Análisis de datos', 'Inglés'] },
  { title: 'Representante de servicio al cliente', keywords: ['Atención al cliente', 'Comunicación', 'Resolución de problemas', 'Excel', 'Inglés'] },
  { title: 'Coordinador/a de proyectos', keywords: ['Gestión de proyectos', 'Comunicación', 'Excel', 'Documentación', 'Inglés'] },
];

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getRelevantRole(profession: string) {
  const normalizedProfession = normalize(profession);
  const professionMatches: Array<{ keywords: string[]; title: string }> = [
    { keywords: ['backend', 'back end', 'servidor'], title: 'Desarrollador/a Backend' },
    { keywords: ['frontend', 'front end'], title: 'Desarrollador/a Frontend' },
    { keywords: ['desarrollador', 'software', 'web'], title: 'Desarrollador/a Frontend' },
    { keywords: ['datos', 'data', 'analista'], title: 'Analista de datos' },
    { keywords: ['soporte', 'sistemas', 'redes', 'it'], title: 'Especialista de soporte IT' },
    { keywords: ['laboratorio', 'microbiologia', 'tecnico de laboratorio'], title: 'Técnico/a de laboratorio' },
    { keywords: ['biologia', 'biologo', 'investigacion', 'biotecnologia'], title: 'Asistente de investigación biológica' },
    { keywords: ['cliente', 'ventas', 'servicio'], title: 'Representante de servicio al cliente' },
    { keywords: ['proyecto', 'administracion', 'coordinador'], title: 'Coordinador/a de proyectos' },
  ];
  const explicitMatch = professionMatches.find(({ keywords }) =>
    keywords.some((keyword) => normalizedProfession.includes(normalize(keyword))),
  );
  if (explicitMatch) {
    return ROLE_REQUIREMENTS.find((role) => role.title === explicitMatch.title) ?? ROLE_REQUIREMENTS[0];
  }

  return ROLE_REQUIREMENTS
    .map((role) => ({
      role,
      score: normalize(role.title).split(/\W+/).filter((word) =>
        word.length > 3 && normalizedProfession.includes(word),
      ).length,
    }))
    .sort((a, b) => b.score - a.score)[0]?.role ?? ROLE_REQUIREMENTS[0];
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(`job-radar:${getClientIp(request)}`, 12);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Has enviado demasiados análisis de CV. Espera un minuto.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'El cuerpo de la solicitud debe ser JSON válido.' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Adjunta un CV legible y proporciona país y profesión válidos.' },
      { status: 400 },
    );
  }

  const { cvText, country, profession } = parsed.data;
  const normalizedCv = normalize(cvText);
  const skills = SKILLS.filter((skill) => normalizedCv.includes(normalize(skill)));
  const years = cvText.match(/\b(\d{1,2})\s*\+?\s*(?:años|years)\b/i);
  const education = cvText.match(/\b(?:licenciatura|grado|maestr[ií]a|master|doctorado|phd|ingenier[ií]a|tecnicatura|bachillerato)\b/i);
  const profile = {
    skills,
    experience: years ? `${years[1]} años (extraído del CV)` : 'No se detectó duración; revisar CV',
    education: education?.[0] ?? 'No se detectó formación; revisar CV',
  };
  const relevantRole = getRelevantRole(profession);
  const skillGap = relevantRole.keywords.filter((skill) =>
    !normalizedCv.includes(normalize(skill)),
  );
  const interviewQuestions = [
    `¿Cómo has utilizado ${relevantRole.keywords[0]} en un proyecto o experiencia real?`,
    `Para el puesto de ${relevantRole.title}, ¿cómo abordarías un problema técnico que no hayas resuelto antes?`,
    'Cuéntame sobre una ocasión en la que colaboraste con otras personas para resolver un reto y qué aprendiste.',
  ];

  const query = new URLSearchParams({ keywords: profession, location: country });
  const jobs = ROLE_REQUIREMENTS.map((role, index) => {
    const matchedRequirements = role.keywords.filter((skill) =>
      normalizedCv.includes(normalize(skill)),
    );
    const missingRequirements = role.keywords.filter((skill) =>
      !matchedRequirements.includes(skill),
    );
    const score = Math.round((matchedRequirements.length / role.keywords.length) * 100);
    const search = new URLSearchParams({
      keywords: `${profession} ${role.title}`,
      location: country,
    });

    return {
      id: `sample-${index}`,
      title: role.title,
      company: 'Resultados de LinkedIn Jobs (por verificar)',
      matchScore: score,
      matchedRequirements,
      missingRequirements,
      applyUrl: `https://www.linkedin.com/jobs/search/?${search.toString()}`,
      sourceLabel: 'Búsqueda orientativa · vacantes y requisitos por verificar en el portal',
    };
  })
    .filter((job) => job.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 6);

  return NextResponse.json({
    profile,
    skillGap,
    interviewQuestions,
    jobs: jobs.length > 0 ? jobs : [{
      id: 'search',
      title: `Vacantes de ${profession}`,
      company: 'Búsqueda en LinkedIn Jobs (por verificar)',
      matchScore: 0,
      matchedRequirements: [],
      missingRequirements: skills.length ? [] : ['Añade habilidades explícitas al CV para calcular coincidencias'],
      applyUrl: `https://www.linkedin.com/jobs/search/?${query.toString()}`,
      sourceLabel: 'Búsqueda orientativa · no se encontraron habilidades coincidentes en el CV',
    }],
  });
}
