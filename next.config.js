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
console.log('  GROQ_API_KEY:', process.env.GROQ_API_KEY ? `set (${process.env.GROQ_API_KEY.slice(0, 8)}...)` : 'NOT SET');
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'set' : 'NOT SET');
console.log('  GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'set' : 'NOT SET');
console.log('  OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'set' : 'NOT SET');
console.log('  CEREBRAS_API_KEY:', process.env.CEREBRAS_API_KEY ? 'set' : 'NOT SET');

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
};

module.exports = nextConfig;
