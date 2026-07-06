/** @type {import('next').NextConfig} */

// Explicitly load .env files at config time so they're always available
// This is a safety net for environments where process.env may be stale
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
      // Only set if not already defined (don't override system env vars)
      if (val && !process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // silently ignore
  }
}

// Load env files in priority order (highest last so they win)
loadEnvFile('.env');
loadEnvFile('.env.local');

console.log('[Yosseling] Env check at config load:');
console.log('  GROQ_API_KEY:', process.env.GROQ_API_KEY ? `set (${process.env.GROQ_API_KEY.slice(0, 8)}...)` : 'NOT SET');
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'set' : 'NOT SET');
console.log('  GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'set' : 'NOT SET');

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;
