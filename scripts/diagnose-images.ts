/* eslint-disable no-console */
/**
 * Diagnostic script — verifies the ImageRouter routing policy and prints
 * a full TRACE for the exact user query:
 *   "créame una imagen de un hombre sentado frente al mar"
 *
 * Enables IMAGE_TRACE so the OpenAI/Gemini providers print the full HTTP
 * request and response.
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
  // Enable full HTTP trace in the providers.
  process.env.IMAGE_TRACE = '1';

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
    { q: 'créame una imagen de un hombre sentado frente al mar', expectMode: 'generate' },
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

  // 5. Full flow trace for the exact user query
  const userQuery = 'créame una imagen de un hombre sentado frente al mar';
  console.log(`\n[5] Full flow trace for: "${userQuery}"`);
  console.log('  Step 1: Usuario escribe el prompt');
  const intent = detectImageIntent(userQuery, false);
  console.log(`  Step 2: ImageRouter.detect() → mode=${intent.mode} confidence=${intent.confidence}`);
  console.log(`          keywords: [${intent.matchedKeywords.join(', ')}]`);
  const decision = selectProvider(intent.mode as 'generate' | 'edit' | 'analyze');
  console.log(`  Step 3: Provider seleccionado: ${decision.provider ?? 'null'}`);
  console.log(`          reason: ${decision.reason}`);
  console.log('  Step 4: Llamada a OpenAI Images API (gpt-image-1)');
  console.log('  Step 5: Imagen generada → Frontend');

  if (intent.mode !== 'generate') {
    console.log(`  FAIL — expected mode=generate, got mode=${intent.mode}`);
  }
  if (decision.provider !== 'openai' && openaiKey) {
    console.log(`  FAIL — expected provider=openai, got provider=${decision.provider}`);
  }
  if (decision.provider === 'gemini') {
    console.log('  FAIL — Gemini was selected for GENERATE. This must never happen.');
  }

  // 6. Attempt real generation if OpenAI key is present
  console.log('\n[6] Real generation test (with full HTTP TRACE):');
  if (!openaiKey) {
    console.log('  SKIPPED — OPENAI_API_KEY is not set. Cannot run real generation test.');
    console.log('  To run this test, add OPENAI_API_KEY=sk-... to .env and re-run:');
    console.log('    npx tsx scripts/diagnose-images.ts');
    console.log('\n========== END DIAGNOSTIC ==========');
    return;
  }

  console.log('  OPENAI_API_KEY present. Attempting real generation with TRACE enabled...');
  try {
    const result = await imageRouter.generate({
      prompt: userQuery,
      size: '1024x1024',
      quality: 'medium',
      style: 'fotografia',
    });
    console.log('\n  SUCCESS — image generated!');
    console.log(`    provider: ${result.provider}`);
    console.log(`    mimeType: ${result.mimeType}`);
    console.log(`    b64 length: ${result.b64.length}`);
    console.log(`    revisedPrompt: ${result.revisedPrompt ?? '(none)'}`);
    console.log(`    cost: $${result.costEstimate.toFixed(6)}`);
    console.log(`    time: ${result.generationMs}ms`);

    if (result.provider !== 'openai') {
      console.log(`  FAIL — provider was ${result.provider}, expected openai`);
    } else {
      console.log('  PASS — provider is OpenAI. No Gemini involved.');
    }

    const outDir = path.join(process.cwd(), 'scripts', 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `test-image-${Date.now()}.png`);
    fs.writeFileSync(outPath, Buffer.from(result.b64, 'base64'));
    console.log(`    saved to: ${outPath}`);
  } catch (e) {
    console.error('\n  FAILED — generation error:', e instanceof Error ? e.message : e);
    if (e instanceof Error && e.stack) console.error(e.stack);
  }

  console.log('\n========== END DIAGNOSTIC ==========');
}

main().catch((e) => {
  console.error('Fatal diagnostic error:', e);
  process.exit(1);
});
