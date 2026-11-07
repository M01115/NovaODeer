#!/usr/bin/env node
/**
 * Try Smudge's weekly "Sketch Wrapped" on 7 images, outside the app.
 *
 *   node scripts/eval-reflection.mjs [--model id] a.jpg b.jpg c.jpg d.jpg e.jpg f.jpg g.jpg
 *
 * Uses the same code and on-disk cache as the app (mobile/.cache/reflections), so running
 * it twice on the same 7 images shows a cache hit (no second AI call).
 * Reads OPENROUTER_API_KEY from mobile/.env.local. Needs Node 22.18+.
 */
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { basename, extname } from 'node:path';

register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function resolve(s, c, next) {
        try { return await next(s, c); }
        catch (e) { if (s.startsWith('.') && !s.endsWith('.ts')) return next(s + '.ts', c); throw e; }
      }`,
    ),
);

const { getReflection, validateReflectionRequest } =
  await import('../src/server/weekly-reflection.ts');

try {
  process.loadEnvFile(new URL('../.env.local', import.meta.url));
} catch {}
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('Set OPENROUTER_API_KEY in mobile/.env.local first.');
  process.exit(1);
}

const args = process.argv.slice(2);
let model = process.env.OPENROUTER_MODEL;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model') model = args[++i];
  else files.push(args[i]);
}

const MIME = { '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.webp': 'webp' };
const sketches = files.map((file) => ({
  id: basename(file),
  title: basename(file, extname(file)).replace(/^\d+-/, '').replace(/-/g, ' '),
  image: `data:image/${MIME[extname(file).toLowerCase()] ?? 'jpeg'};base64,${readFileSync(file).toString('base64')}`,
}));

const started = Date.now();
try {
  const request = validateReflectionRequest({ sketches });
  const result = await getReflection(request, { apiKey, model, origin: 'http://localhost' });
  console.log(`(${((Date.now() - started) / 1000).toFixed(1)}s, cached: ${result.cached})`);
  console.log(JSON.stringify({ ...result, sketchIds: undefined }, null, 2));
} catch (error) {
  console.log(`FAILED: ${error.code ?? ''} ${error.message}`);
}
