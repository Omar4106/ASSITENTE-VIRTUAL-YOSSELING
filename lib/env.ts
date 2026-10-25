import fs from 'fs';
import path from 'path';

/**
 * Reads an environment variable from process.env first,
 * then falls back to reading .env.local and .env files directly.
 *
 * This is necessary in environments (e.g. Bolt sandbox) where the dev server
 * does not restart when .env files change, leaving process.env stale.
 */
export function getEnvVar(key: string): string | undefined {
  // 1. Standard process.env — works in production and proper dev setups
  const fromProcess = process.env[key];
  if (fromProcess && fromProcess.trim() !== '') {
    return fromProcess.trim();
  }

  // 2. Read directly from .env files at request time (dev fallback)
  if (process.env.NODE_ENV !== 'production') {
    const envFiles = ['.env.local', '.env'];
    const cwd = process.cwd();

    for (const file of envFiles) {
      try {
        const fullPath = path.join(cwd, file);
        if (!fs.existsSync(fullPath)) continue;
        const content = fs.readFileSync(fullPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
          const eqIdx = trimmed.indexOf('=');
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (k === key && v !== '') return v;
        }
      } catch {
        // silently ignore unreadable files
      }
    }
  }

  return undefined;
}

/**
 * Returns whether each key is configured, without exposing values.
 */
export function checkEnvVars(keys: string[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const key of keys) {
    result[key] = Boolean(getEnvVar(key));
  }
  return result;
}
