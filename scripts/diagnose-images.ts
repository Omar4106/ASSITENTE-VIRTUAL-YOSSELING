/* eslint-disable no-console */
/**
 * Diagnostic script — verifies the ImageRouter routing policy:
 *   generate → OpenAI
 *   edit     → OpenAI
 *   analyze  → Gemini
 *
 * Also confirms that no Gemini image-generation model is referenced anywhere.
 *
 * Run with:  npx tsx scripts/diagnose-images.ts
 */
import fs from 'fs';
import path from 'path';

async function main() {
  // Load .env
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const i = t.indexOf('=');
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      if (k && v) process.env[k] = v;
    }
  }
  process.env.NODE_ENV = 'development';

  const { imageRouter, detectImageIntent, selectProvider } = await import('../src/services/images');

  console.log('========== IMAGE ROUTER DIAGNOSTIC ==========\n');

  // 1. Provider configuration
  console.log('[1] Provider configuration:');
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  console.log(`  OPENAI_API_KEY: ${openaiKey ? `present (len=${openaiKey.length})` : 'ABSENT'}`);
  console.log(`  GEMINI_API_KEY: ${geminiKey ? `present (len=${geminiKey.length})` : 'ABSENT'}`);
  console.log(`  imageRouter.isConfigured(): ${imageRouter.isConfigured()}`);
  console.log(`  imageRouter.canGenerate(): ${imageRouter.canGenerate()}`);
  console.log(`  imageRouter.canAnalyze(): ${imageRouter.canAnalyze()}`);

  // 2. Routing policy verification
  console.log('\n[2] Routing policy verification:');
  const cases: Array<{ mode: 'generate' | 'edit' | 'analyze'; expected: 'openai' | 'gemini' | null }> = [
    { mode: 'generate', expected: 'openai' },
    { mode: 'edit', expected: 'openai' },
    { mode: 'analyze', expected: 'gemini' },
  ];
  for (const c of cases) {
    const decision = selectProvider(c.mode);
    // When the required key is absent, null is the correct answer.
    let pass: boolean;
    if (c.expected === 'openai') {
      pass = openaiKey ? decision.provider === 'openai' : decision.provider === null;
    } else if (c.expected === 'gemini') {
      pass = geminiKey ? decision.provider === 'gemini' : decision.provider === null;
    } else {
      pass = decision.provider === c.expected;
    }
    console.log(`  ${c.mode.padEnd(8)} → ${decision.provider ?? 'null'} (expected: ${c.expected}) ${pass ? 'PASS' : 'FAIL'}`);
    console.log(`    reason: ${decision.reason}`);
  }

  // 3. Intent detection tests
  console.log('\n[3] Intent detection tests:');
  const testQueries = [
    { q: 'crea una imagen de un hotel moderno frente al mar', expectMode: 'generate' },
    { q: 'genera un logo para Vuelo Urbano', expectMode: 'generate' },
    { q: 'dibuja un gato', expectMode: 'generate' },
    { q: 'haz una ilustración de un dragón', expectMode: 'generate' },
    { q: 'haz un wallpaper del espacio', expectMode: 'generate' },
    { q: 'diseña un banner para mi tienda', expectMode: 'generate' },
    { q: 'qué ves en esta imagen', expectMode: 'analyze', hasImage: true },
    { q: 'descríbela', expectMode: 'analyze', hasImage: true },
    { q: 'analízala y extrae el texto', expectMode: 'analyze', hasImage: true },
    { q: 'convierte esta foto a estilo anime', expectMode: 'edit', hasImage: true },
    { q: 'quita el fondo de esta imagen', expectMode: 'edit', hasImage: true },
  ];
  for (const t of testQueries) {
    const intent = detectImageIntent(t.q, t.hasImage ?? false);
    const pass = intent.mode === t.expectMode;
    console.log(`  ${pass ? 'PASS' : 'FAIL'} "${t.q}" → mode=${intent.mode} (expected: ${t.expectMode}) confidence=${intent.confidence}`);
  }

  // 4. Verify no Gemini image-generation model is referenced
  console.log('\n[4] Scanning for forbidden Gemini image-generation model references...');
  const forbidden = ['gemini-2.0-flash-preview-image-generation', 'gemini-2.0-flash-image', 'gemini-2.0-flash-image-generation'];
  const scanDirs = ['src/services/images', 'app/api/images'];
  let violations = 0;
  for (const dir of scanDirs) {
    const fullDir = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullDir)) continue;
    for (const file of fs.readdirSync(fullDir, { recursive: true }) as string[]) {
      const fullPath = path.join(fullDir, file);
      if (!fs.statSync(fullPath).isFile()) continue;
      if (!/\.(ts|tsx|js)$/.test(file)) continue;
      const content = fs.readFileSync(fullPath, 'utf-8');
      for (const f of forbidden) {
        if (content.includes(f)) {
          console.log(`  VIOLATION: "${f}" found in ${fullPath}`);
          violations++;
        }
      }
    }
  }
  if (violations === 0) {
    console.log('  PASS — no forbidden Gemini image-generation model references found.');
  } else {
    console.log(`  FAIL — ${violations} violation(s) found.`);
  }

  // 5. Attempt real generation if OpenAI key is present
  console.log('\n[5] Real generation test:');
  if (!openaiKey) {
    console.log('  SKIPPED — OPENAI_API_KEY is not set. Cannot run real generation test.');
    console.log('  To run this test, add OPENAI_API_KEY=sk-... to .env and re-run.');
    console.log('\n========== END DIAGNOSTIC ==========');
    return;
  }

  console.log('  OPENAI_API_KEY present. Attempting real generation...');
  try {
    const result = await imageRouter.generate({
      prompt: 'un hotel moderno frente al mar',
      size: '1024x1024',
      quality: 'standard',
      style: 'fotografia',
    });
    console.log('  SUCCESS — image generated!');
    console.log(`    provider: ${result.provider}`);
    console.log(`    mimeType: ${result.mimeType}`);
    console.log(`    b64 length: ${result.b64.length}`);
    console.log(`    revisedPrompt: ${result.revisedPrompt ?? '(none)'}`);
    console.log(`    cost: $${result.costEstimate.toFixed(6)}`);
    console.log(`    time: ${result.generationMs}ms`);

    const outDir = path.join(process.cwd(), 'scripts', 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `test-image-${Date.now()}.png`);
    fs.writeFileSync(outPath, Buffer.from(result.b64, 'base64'));
    console.log(`    saved to: ${outPath}`);
  } catch (e) {
    console.error('  FAILED — generation error:', e instanceof Error ? e.message : e);
    if (e instanceof Error && e.stack) console.error(e.stack);
  }

  console.log('\n========== END DIAGNOSTIC ==========');
}

main().catch((e) => {
  console.error('Fatal diagnostic error:', e);
  process.exit(1);
});
