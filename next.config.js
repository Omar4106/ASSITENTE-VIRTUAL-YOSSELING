/** @type {import('next').NextConfig} */

const fs = require('fs');
const path = require('path');

function loadEnvFile(file) {
  try {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) return;
    const content = fs.readFileSync(fullPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eqIdx = trimmed.indexOf('=');
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (val && !process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {}
}

loadEnvFile('.env');
loadEnvFile('.env.local');

console.log('[Yosseling] Env check at config load:');
console.log('  GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'set' : 'NOT SET');
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'set' : 'NOT SET');
console.log('  GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'set' : 'NOT SET');
console.log('  OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'set' : 'NOT SET');
console.log('  CEREBRAS_API_KEY:', process.env.CEREBRAS_API_KEY ? 'set' : 'NOT SET');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.groq.com https://api.openai.com https://generativelanguage.googleapis.com https://openrouter.ai https://api.cerebras.ai https://image.pollinations.ai",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; '),
  },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
