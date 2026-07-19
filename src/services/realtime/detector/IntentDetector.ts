/**
 * Intent Detector — analyzes a user message and decides whether realtime
 * information is needed, and which domain should handle it.
 */
import type { IntentDetectionResult, RealtimeDomain } from '../types';

interface Rule {
  domain: RealtimeDomain;
  keywords: string[];
  patterns: RegExp[];
}

const RULES: Rule[] = [
  {
    domain: 'weather',
    keywords: ['clima', 'temperatura', 'lluvia', 'huracán', 'huracan', 'nevada', 'viento', 'pronóstico', 'pronostico', 'lluvioso', 'soleado', 'humedad'],
    patterns: [/clima\s+(en|de|para)\s+\w/i, /temperatura\s+(en|de)\s+\w/i],
  },
  {
    domain: 'crypto',
    keywords: ['bitcoin', 'btc', 'ethereum', 'eth', 'cripto', 'criptomoneda', 'criptomonedas', 'litecoin', 'dogecoin', 'cardano', 'solana', 'usdt', 'binance coin'],
    patterns: [/precio\s+(del\s+)?(bitcoin|btc|ethereum|eth|cripto)/i],
  },
  {
    domain: 'stocks',
    keywords: ['acciones', 'cotización', 'cotizacion', 'bolsa', 'wall street', 'nasdaq', 'dow jones', 's&p', 'sp500', 'mercado de valores', 'ticker', 'acción', 'accion'],
    patterns: [/\b[A-Z]{1,5}\s+(stock|acción|accion|cotización|cotizacion)\b/i],
  },
  {
    domain: 'news',
    keywords: ['noticias', 'noticia', 'titulares', 'últimas noticias', 'ultimas noticias', 'actualidad', 'sucedido', 'periódico', 'periodico', 'cabecera',
      'presidente', 'presidenta', 'primer ministro', 'prime minister', 'gobernador', 'alcalde', 'secretario general', 'líder', 'dirigente', 'jefe de estado', 'jefe de gobierno',
      'quién es el', 'quien es el', 'quién es la', 'quien es la', 'quién gobierna', 'quien gobierna', 'quién ganó', 'quien gano'],
    patterns: [/noticias\s+(de|sobre|del|de las)\s/i, /(qu[ií]en|president[ea]|primer ministro|gobernador|alcalde)\s+(actual|de|del|de la)/i],
  },
  {
    domain: 'sports',
    keywords: ['resultado', 'marcador', 'partido', 'fútbol', 'futbol', 'baloncesto', 'béisbol', 'beisbol', 'tenis', 'f1', 'nfl', 'nba', 'ligue', 'champions', 'la liga', 'serie a', 'mundial', 'olímpico', 'olimpico'],
    patterns: [/resultado\s+(del|de la|de)\s/i],
  },
  {
    domain: 'flights',
    keywords: ['vuelo', 'vuelos', 'aeropuerto', 'salida de vuelo', 'llegada de vuelo', 'boarding', 'boarding pass', 'estado del vuelo'],
    patterns: [/vuelo\s+\w{2}\d{1,4}/i, /estado\s+del\s+vuelo/i],
  },
  {
    domain: 'traffic',
    keywords: ['tráfico', 'trafico', 'carretera', 'autopista', 'congestión', 'congestion', 'accidente de tráfico', 'ruta'],
    patterns: [/tr[aá]fico\s+(en|de|desde|hasta)\s/i],
  },
  {
    domain: 'location',
    keywords: ['restaurantes', 'negocios', 'horarios', 'mapa', 'mapas', 'dirección', 'direccion', 'gps', 'ubicación', 'ubicacion', 'cerca de', 'abierto ahora'],
    patterns: [/restaurantes\s+cerca\s+de/i, /d[oó]nde\s+(está|esta|queda)\s/i],
  },
  {
    domain: 'scheduler',
    keywords: ['versión', 'version', 'release', 'lanzamiento', 'actualización', 'actualizacion', 'changelog', 'github releases', 'nueva versión', 'nueva version', 'roadmap'],
    patterns: [/versi[oó]n\s+\d+\.\d+/i, /release\s+v?\d/i],
  },
];

const TEMPORAL_KEYWORDS = [
  'hoy', 'ahora', 'últimas', 'ultimo', 'último', 'esta semana', 'este mes',
  'este año', 'ayer', 'mañana', 'recientemente', 'últimamente', 'hace unas horas',
  'en vivo', 'en directo', '2026', '2027', 'actualmente', 'en este momento',
];

export function detectIntent(message: string): IntentDetectionResult {
  const text = message.trim();
  if (!text) {
    return { needsRealtime: false, domain: null, query: text, matchedKeywords: [], confidence: 0 };
  }

  const lower = text.toLowerCase();
  const matched: string[] = [];
  let domain: RealtimeDomain | null = null;
  let confidence = 0;

  for (const rule of RULES) {
    const kwHits = rule.keywords.filter(k => lower.includes(k));
    const patHits = rule.patterns.filter(p => p.test(text));
    if (kwHits.length || patHits.length) {
      matched.push(...kwHits, ...patHits.map(p => p.source));
      const score = kwHits.length + patHits.length * 2;
      if (score > confidence) {
        confidence = score;
        domain = rule.domain;
      }
    }
  }

  const temporalHits = TEMPORAL_KEYWORDS.filter(k => lower.includes(k));
  matched.push(...temporalHits);

  if (!domain && temporalHits.length > 0) {
    domain = 'search';
    confidence = Math.max(confidence, temporalHits.length);
  }

  const needsRealtime = Boolean(domain) && confidence > 0;

  return {
    needsRealtime,
    domain,
    query: text,
    matchedKeywords: Array.from(new Set(matched))
      .filter(k => k.length > 1)
      .slice(0, 12),
    confidence,
  };
}
