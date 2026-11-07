#!/usr/bin/env node
/**
 * Try Smudge's sketch feedback on your own images, outside the app.
 *
 *   node scripts/eval-feedback.mjs [--model google/gemini-3.8-flash] [--out ./eval-out] sketch1.jpg sketch2.png ...
 *
 * Prints each result and writes <name>.overlay.svg next to --out, with every
 * annotation box drawn on the image, so you can check whether the circles land
 * on the right details. Reads OPENROUTER_API_KEY from mobile/.env.local.
 * Needs Node 22.18+ (runs the TypeScript server code directly).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { basename, extname, join } from 'node:path';

// The server code imports siblings without extensions (as Metro expects); let Node find
// the .ts files.
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function resolve(s, c, next) {
        try { return await next(s, c); }
        catch (e) { if (s.startsWith('.') && !s.endsWith('.ts')) return next(s + '.ts', c); throw e; }
      }`,
    ),
);

const { analyzeSketch, validateRequest, DEFAULT_MODEL } =
  await import('../src/server/sketch-feedback.ts');

try {
  process.loadEnvFile(new URL('../.env.local', import.meta.url));
} catch {}
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('Set OPENROUTER_API_KEY in mobile/.env.local first.');
  process.exit(1);
}

const args = process.argv.slice(2);
let model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
let outDir = 'eval-out';
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model') model = args[++i];
  else if (args[i] === '--out') outDir = args[++i];
  else files.push(args[i]);
}
if (!files.length) {
  console.error('Usage: node scripts/eval-feedback.mjs [--model id] [--out dir] image ...');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const MIME = { '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.webp': 'webp' };

/** Image width/height from JPEG or PNG bytes (enough for the overlay). */
function imageSize(buf) {
  if (buf[0] === 0x89) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return { width: 1000, height: 1000 };
}

for (const file of files) {
  const buf = readFileSync(file);
  const type = MIME[extname(file).toLowerCase()] ?? 'jpeg';
  const image = `data:image/${type};base64,${buf.toString('base64')}`;
  const started = Date.now();
  try {
    const request = validateRequest({ image, prompt: '', medium: 'upload' });
    const result = await analyzeSketch(request, { apiKey, model });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n=== ${basename(file)}  (${model}, ${seconds}s)`);
    console.log(JSON.stringify(result, null, 2));

    const { width, height } = imageSize(buf);
    const boxes = result.status === 'ok' ? result.annotations : [];
    const colors = ['#E5483B', '#2E7D32', '#1E88E5'];
    const overlay = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}">
<image width="${width}" height="${height}" xlink:href="${image}"/>
${boxes
  .map((a, i) => {
    const c = colors[i % colors.length];
    const dash = a.located ? '' : ' stroke-dasharray="10 8"';
    return `<rect x="${a.x * width}" y="${a.y * height}" width="${a.width * width}" height="${a.height * height}" fill="none" stroke="${c}" stroke-width="4"${dash}/>
<text x="${a.x * width + 6}" y="${a.y * height + 26}" font-size="24" font-family="Helvetica" font-weight="bold" fill="${c}">${a.kind === 'improvement' ? 'TIP' : i + 1}. ${a.feature.replace(/[<&]/g, '')} (${a.confidence.toFixed(2)})</text>`;
  })
  .join('\n')}
</svg>`;
    writeFileSync(join(outDir, `${basename(file, extname(file))}.overlay.svg`), overlay);
  } catch (error) {
    console.log(`\n=== ${basename(file)}  FAILED: ${error.code ?? ''} ${error.message}`);
  }
}
