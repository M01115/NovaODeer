/**
 * Tests for the AI features' logic (no network, no API key needed):
 *
 *   node --test scripts/
 *
 * - chapter grouping (0, 1, 6, 7, 8, 14, 15 sketches)
 * - per-sketch feedback validation: always 2 compliments + 1 encouraging tip
 * - weekly reflection validation and the on-disk cache (no repeat AI calls; a changed
 *   sketch gets a fresh reflection)
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function resolve(s, c, next) {
        try { return await next(s, c); }
        catch (e) { if (s.startsWith('.') && !s.endsWith('.ts')) return next(s + '.ts', c); throw e; }
      }`,
    ),
);

// The reflection cache is written under the working directory: use a throwaway one.
process.chdir(mkdtempSync(join(tmpdir(), 'sketch-ai-test-')));

const { groupIntoChapters } = await import('../src/data/chapters.ts');
const { parseFeedback } = await import('../src/server/sketch-feedback.ts');
const { getReflection, parseReflection, validateReflectionRequest } =
  await import('../src/server/weekly-reflection.ts');

// ---------------------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------------------

test('groups sketches into chapters of 7; only full chapters are complete', () => {
  const cases = {
    0: [],
    1: [[1, false]],
    6: [[6, false]],
    7: [[7, true]],
    8: [
      [7, true],
      [1, false],
    ],
    14: [
      [7, true],
      [7, true],
    ],
    15: [
      [7, true],
      [7, true],
      [1, false],
    ],
  };
  for (const [count, expected] of Object.entries(cases)) {
    const sketches = Array.from({ length: Number(count) }, (_, i) => i);
    const chapters = groupIntoChapters(sketches);
    assert.deepEqual(
      chapters.map((c) => [c.items.length, c.complete]),
      expected,
      `${count} sketches`,
    );
    // Chronological, no sketch lost or repeated.
    assert.deepEqual(
      chapters.flatMap((c) => c.items),
      sketches,
    );
    chapters.forEach((c, i) => assert.equal(c.start, i * 7));
  }
});

// ---------------------------------------------------------------------------------------
// Per-sketch feedback: 2 compliments + 1 tip
// ---------------------------------------------------------------------------------------

const obs = (feature, comment, box = { left: 0.2, top: 0.2, width: 0.2, height: 0.2 }) => ({
  feature,
  comment,
  box,
  confidence: 0.8,
});

const reply = (overrides = {}) =>
  JSON.stringify({
    seen: 'a mug with steam',
    kind: 'sketch',
    subject: 'a mug',
    overallReaction: 'Cozy mug!',
    compliments: [obs('steam', 'The steam curls feel warm.'), obs('hatching', 'Nice hatching.')],
    improvement: obs('base', 'Try a heavier line along the base so it sits firmly.'),
    ...overrides,
  });

test('feedback is exactly compliment, compliment, improvement', () => {
  const result = parseFeedback(reply(), 'test-model');
  assert.equal(result.status, 'ok');
  assert.deepEqual(
    result.annotations.map((a) => a.kind),
    ['compliment', 'compliment', 'improvement'],
  );
});

test('an extra compliment from the model is trimmed to two', () => {
  const result = parseFeedback(
    reply({
      compliments: [obs('a', 'One.'), obs('b', 'Two.'), obs('c', 'Three.')],
    }),
    'test-model',
  );
  assert.equal(result.annotations.filter((a) => a.kind === 'compliment').length, 2);
});

test('missing compliments or tip is rejected (so the backup model retries)', () => {
  assert.throws(() => parseFeedback(reply({ compliments: [obs('a', 'One.')] }), 'm'), {
    code: 'malformed',
  });
  assert.throws(() => parseFeedback(reply({ improvement: null }), 'm'), { code: 'malformed' });
});

test('a tip that sounds like criticism is rejected', () => {
  for (const harsh of [
    'Your proportions are wrong.',
    'The shading is bad.',
    'You need to work on perspective.',
    'You should fix the handle.',
  ]) {
    assert.throws(() => parseFeedback(reply({ improvement: obs('x', harsh) }), 'm'), {
      code: 'malformed',
    });
  }
});

test('unclear images get a kind message and no observations', () => {
  const result = parseFeedback(reply({ kind: 'unclear' }), 'm');
  assert.equal(result.status, 'unclear');
});

test('a huge or low-confidence box is shown as a card, not a circle', () => {
  const big = parseFeedback(
    reply({
      improvement: obs('all', 'Try more contrast.', { left: 0, top: 0, width: 1, height: 1 }),
    }),
    'm',
  );
  assert.equal(big.annotations[2].located, false);
});

// ---------------------------------------------------------------------------------------
// Weekly reflections
// ---------------------------------------------------------------------------------------

// A real 1×1 JPEG, varied per sketch so each image hashes differently.
const JPEG =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=';
const sketchList = (variant = '') =>
  Array.from({ length: 7 }, (_, i) => ({
    id: `2026-11-0${i + 1}`,
    title: `Sketch ${i + 1}`,
    // `variant` swaps one byte of the last sketch's image (a different drawing).
    image: `data:image/jpeg;base64,${i === 6 && variant ? JPEG.replace('AQEASABI', variant) : JPEG}`,
  }));

test('a reflection needs exactly 7 sketches with unique ids', () => {
  assert.throws(() => validateReflectionRequest({ sketches: sketchList().slice(0, 6) }), {
    code: 'bad_request',
  });
  const dup = sketchList();
  dup[1].id = dup[0].id;
  assert.throws(() => validateReflectionRequest({ sketches: dup }), { code: 'bad_request' });
  assert.equal(validateReflectionRequest({ sketches: sketchList() }).sketches.length, 7);
});

test('reflection sketch numbers map to ids; invalid numbers are dropped', () => {
  const request = validateReflectionRequest({ sketches: sketchList() });
  const result = parseReflection(
    JSON.stringify({
      groundedObservations: [],
      patterns: '',
      speakerTone: 'hype',
      headline: { text: 'You were in your curves era.', sketches: [1, 3, 3, 9, 0] },
      comment1: { text: 'Tiny details? Obsessed.', sketches: [7] },
      comment2: { text: '', sketches: [] },
    }),
    request,
    'key',
    'm',
  );
  assert.deepEqual(result.headline.sketchIds, ['2026-11-01', '2026-11-03']);
  assert.deepEqual(result.comments[0].sketchIds, ['2026-11-07']);
  assert.equal(result.comments.length, 1, 'an empty comment2 is dropped');
  assert.equal(result.tone, 'hype');
});

test('an incomplete reflection is rejected', () => {
  const request = validateReflectionRequest({ sketches: sketchList() });
  assert.throws(
    () =>
      parseReflection(
        JSON.stringify({
          headline: { text: 'x', sketches: [] },
          comment1: { text: '', sketches: [] },
        }),
        request,
        'k',
        'm',
      ),
    { code: 'malformed' },
  );
});

test('reflections are cached: same 7 images = no second AI call; a changed sketch regenerates', async () => {
  let calls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls++;
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                groundedObservations: [],
                patterns: '',
                speakerTone: 'cozy',
                headline: { text: `Circle era, take ${calls}.`, sketches: [1] },
                comment1: { text: 'Lots of hatching. Love that.', sketches: [2] },
                comment2: { text: '', sketches: [] },
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  try {
    const opts = { apiKey: 'test', origin: 'http://localhost', fallbackModel: 'none' };
    const first = await getReflection(validateReflectionRequest({ sketches: sketchList() }), opts);
    assert.equal(first.cached, false);
    assert.equal(calls, 1);

    // Reopening the gallery: same chapter, served from disk.
    const again = await getReflection(validateReflectionRequest({ sketches: sketchList() }), opts);
    assert.equal(again.cached, true);
    assert.equal(again.headline.text, first.headline.text);
    assert.equal(calls, 1);

    // Two requests at once for a new chapter share one AI call.
    const changed = validateReflectionRequest({ sketches: sketchList('AQEAYABg') });
    const [a, b] = await Promise.all([getReflection(changed, opts), getReflection(changed, opts)]);
    assert.equal(calls, 2);
    assert.equal(a.key, b.key);
    assert.notEqual(a.key, first.key);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('reflection images from other websites are refused', async () => {
  const sketches = sketchList();
  sketches[0].image = 'https://example.com/steal.jpg';
  await assert.rejects(
    getReflection(validateReflectionRequest({ sketches }), {
      apiKey: 'test',
      origin: 'http://localhost:8081',
    }),
    { code: 'bad_image' },
  );
});

// ---------------------------------------------------------------------------------------
// Voice: length limits are enforced, not just requested
// ---------------------------------------------------------------------------------------

test('a Wrapped line over 8 words is rejected for a rewrite', () => {
  const request = validateReflectionRequest({ sketches: sketchList() });
  assert.throws(
    () =>
      parseReflection(
        JSON.stringify({
          headline: {
            text: 'You really spent this whole week drawing every circle ever',
            sketches: [],
          },
          comment1: { text: 'Cute.', sketches: [] },
          comment2: { text: '', sketches: [] },
        }),
        request,
        'k',
        'm',
      ),
    (error) => error.name === 'Error' && Array.isArray(error.lines) && error.lines.length === 1,
  );
});

test('a feedback comment over 14 words is rejected for a rewrite', () => {
  const long = 'This is a very long comment that goes on and on about the steam curls forever';
  assert.throws(
    () => parseFeedback(reply({ compliments: [obs('a', long), obs('b', 'So cute.')] }), 'm'),
    (error) => Array.isArray(error.lines) && error.lines[0] === long,
  );
});

test('the mascot name is sanitized before it reaches a prompt', async () => {
  const { mascotName } = await import('../src/server/voice.ts');
  assert.equal(mascotName('Odeer'), 'Odeer');
  assert.equal(mascotName('<script>Odeer</script>'), 'scriptOdeerscript');
  assert.equal(mascotName(''), 'Puff');
  assert.equal(mascotName(undefined), 'Puff');
});

test('the length retry asks again once, quoting the long lines', async () => {
  const { withLengthRetry, TooLongFailure } = await import('../src/server/openrouter.ts');
  const corrections = [];
  const result = await withLengthRetry(async (correction) => {
    corrections.push(correction);
    if (!correction) throw new TooLongFailure(['way too many words here']);
    return 'ok';
  }, '8 words max');
  assert.equal(result, 'ok');
  assert.equal(corrections.length, 2);
  assert.match(corrections[1], /way too many words here/);
});
