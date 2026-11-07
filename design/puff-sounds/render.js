// node render.js  ->  wav/<id>.wav (44.1 kHz, 16-bit mono) + sounds.json
const fs = require('fs');
const path = require('path');
const { SR, SOUNDS, render } = require('./puff-sounds.js');

const dir = path.join(__dirname, 'wav');
fs.mkdirSync(dir, { recursive: true });

function wav(samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return b;
}

const manifest = [];
for (const s of SOUNDS) {
  const t0 = Date.now();
  const data = render(s);
  let bad = 0; for (const v of data) if (!Number.isFinite(v)) bad++;
  fs.writeFileSync(path.join(dir, s.id + '.wav'), wav(data));
  manifest.push({ id: s.id, group: s.group, name: s.name, when: s.when, seconds: +(data.length / SR).toFixed(2), loop: !!s.loop });
  console.log(`${s.id.padEnd(16)} ${(data.length / SR).toFixed(2)}s  ${Date.now() - t0}ms${bad ? '  NaN x' + bad : ''}`);
}
fs.writeFileSync(path.join(__dirname, 'sounds.json'), JSON.stringify(manifest, null, 2));
