/// <reference types="node" />
/**
 * Server-only: "Sketch Wrapped" for a chapter of 7 sketches, hosted by the mascot. All
 * seven images go to a vision model in ONE request, so it can spot patterns across them
 * (it isn't an average of seven separate feedbacks). The reply is validated (every line
 * 8 words max, enforced in code), then cached on disk so reopening the gallery never pays
 * for the same chapter twice.
 *
 * Cache key = prompt version + mascot name + the 7 sketch ids + a hash of each image's
 * bytes, so changing any sketch (or renaming the mascot) gives a fresh reflection.
 * Cache lives in mobile/.cache/reflections/ (git-ignored).
 *
 * Used by src/app/api/reflection+api.ts (and scripts/eval-reflection.mjs).
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  ReflectionNote,
  ReflectionRequest,
  ReflectionSketch,
  WeeklyReflection,
} from '../data/feedback';
import {
  chatJSON,
  type ChatContent,
  extractJSON,
  FeedbackFailure,
  type ModelOptions,
  text,
  TooLongFailure,
  withFallback,
  withLengthRetry,
} from './openrouter';
import { mascotName, persona, remember, toneOfTheDay, wordCount } from './voice';

const CHAPTER_SIZE = 7;
/** Bump when the prompt or schema changes, so old cached reflections are regenerated. */
const PROMPT_VERSION = 'wrapped-v4-statements';
const TIMEOUT_MS = 45_000;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const IMAGE_TYPES = /^image\/(jpeg|png|webp)$/;

/** Hard cap for every Wrapped line, enforced in code. */
export const MAX_WRAPPED_WORDS = 8;

const TONES = ['cozy', 'hype', 'witty', 'proud', 'curious'] as const;

function systemPrompt(name: string) {
  return `${persona(name)}

YOUR JOB RIGHT NOW: every 7 sketches, you host a tiny "Sketch Wrapped" in their gallery, written exactly like Spotify Wrapped: short, confident statements ABOUT THEM and their week of drawing ("This week, you…", "Your…", "You drew…"), each a fun fact you noticed across the sketches. Not reactions or exclamations about one drawing.

You get the 7 sketches oldest first (Sketch 1 = oldest), each with its prompt. Look at ALL seven together.

STEP 1 (private): "groundedObservations": one plain line per sketch of what's actually drawn (subject, kind of lines, shading, textures, extra views, tiny details).
STEP 2 (private): "patterns": what repeats or contrasts across the seven: recurring shapes or motifs, repeated subjects, habits (doubled outlines, hatching, little extra views), experiments, a fun odd-one-out. Only claim a change over time if you can clearly see it. If they vary a lot, celebrate the variety.
STEP 3: write the Wrapped, Spotify-Wrapped style:
- headline: the chapter's biggest fact about them: what they drew most, the style they drew in, or their signature move. ${MAX_WRAPPED_WORDS} WORDS MAX.
- comment1: a second, DIFFERENT fact: a habit, a recurring shape, how their lines/shading/line weight behaved, a fun count. ${MAX_WRAPPED_WORDS} WORDS MAX.
- comment2: a third fact, or "" if you have nothing grounded to add. ${MAX_WRAPPED_WORDS} WORDS MAX.
Write them as statements about the user, mostly starting with "This week, you…", "Your…", "You…", or a "Top …: …" stat. A light playful touch is welcome at the end ("…and it worked.", "Iconic."), but keep it a fact, not a cheer.
- speakerTone: the vibe you went for (${TONES.join(', ')}).
- For headline/comment1/comment2, "sketches" lists the numbers (1–7) that clearly show it ([] for a chapter-wide vibe).
Format examples (never copy; yours must come from THESE drawings): "This week, you drew only furniture!" / "You drew in a loose, scribbly style." / "Your line weights got bolder by Friday." / "Top shape this week: the circle." / "You added a side view three times." / "Your favorite move: crossed X-shaped legs."
Count the words. Every line must be ${MAX_WRAPPED_WORDS} words or fewer.`;
}

const NOTE = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'sketches'],
  properties: {
    text: { type: 'string' },
    sketches: { type: 'array', items: { type: 'integer' } },
  },
} as const;

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['groundedObservations', 'patterns', 'speakerTone', 'headline', 'comment1', 'comment2'],
  properties: {
    groundedObservations: { type: 'array', items: { type: 'string' } },
    patterns: { type: 'string' },
    speakerTone: { type: 'string', enum: TONES },
    headline: NOTE,
    comment1: NOTE,
    comment2: NOTE,
  },
} as const;

/** Checks the body: exactly 7 sketches with unique ids and an image each. */
export function validateReflectionRequest(body: unknown): ReflectionRequest {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const list = Array.isArray(b.sketches) ? b.sketches : null;
  if (!list || list.length !== CHAPTER_SIZE) {
    throw new FeedbackFailure(
      'bad_request',
      `A chapter needs exactly ${CHAPTER_SIZE} sketches.`,
      400,
    );
  }
  const sketches: ReflectionSketch[] = list.map((s) => {
    const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id || typeof o.image !== 'string' || !o.image) {
      throw new FeedbackFailure('bad_request', 'Each sketch needs an id and an image.', 400);
    }
    return { id: o.id.slice(0, 64), title: text(o.title, 120), image: o.image };
  });
  if (new Set(sketches.map((s) => s.id)).size !== CHAPTER_SIZE) {
    throw new FeedbackFailure('bad_request', 'Sketch ids must be unique.', 400);
  }
  return { sketches, mascotName: mascotName(b.mascotName) };
}

/**
 * Turns a sketch's image into a data URI. Data URIs are used as-is; anything else must be
 * a URL on the app's OWN server (bundled sample sketches), so this can't be used to make
 * the server fetch arbitrary sites.
 */
async function loadImage(
  image: string,
  origin: string,
): Promise<{ dataUri: string; bytes: Buffer }> {
  const data = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/s.exec(image);
  if (data) {
    const bytes = Buffer.from(data[2], 'base64');
    if (bytes.length > MAX_IMAGE_BYTES)
      throw new FeedbackFailure('bad_image', 'A sketch image is too large.', 413);
    return { dataUri: image, bytes };
  }

  let url: URL;
  try {
    url = new URL(image, origin);
  } catch {
    throw new FeedbackFailure('bad_image', 'A sketch image link is invalid.', 400);
  }
  if (url.origin !== new URL(origin).origin) {
    throw new FeedbackFailure('bad_image', 'Sketch images must come from the app.', 400);
  }
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new FeedbackFailure('bad_image', 'Couldn’t load a sketch image.', 502);
  }
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!res.ok || !IMAGE_TYPES.test(type)) {
    throw new FeedbackFailure('bad_image', 'A sketch image couldn’t be read.', 502);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new FeedbackFailure('bad_image', 'A sketch image is too large.', 413);
  return { dataUri: `data:${type};base64,${bytes.toString('base64')}`, bytes };
}

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

const CACHE_DIR = join(process.cwd(), '.cache', 'reflections');
/** Requests for a chapter that's already being generated share the same AI call. */
const inFlight = new Map<string, Promise<WeeklyReflection>>();

async function readCache(key: string): Promise<WeeklyReflection | null> {
  try {
    const cached = JSON.parse(await readFile(join(CACHE_DIR, `${key}.json`), 'utf8'));
    return cached?.status === 'ready' && cached.key === key ? { ...cached, cached: true } : null;
  } catch {
    return null;
  }
}

async function writeCache(reflection: WeeklyReflection) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, `${reflection.key}.json`), JSON.stringify(reflection, null, 2));
  } catch (error) {
    // Not fatal: the reflection still goes back to the app (and its own cache).
    console.warn('[reflection] could not write cache', error);
  }
}

/**
 * Returns the chapter's reflection: from the cache when the same 7 images were already
 * reflected on, otherwise from one AI call (deduplicated across concurrent requests).
 */
export async function getReflection(
  request: ReflectionRequest,
  options: ModelOptions & { origin: string },
): Promise<WeeklyReflection> {
  const images = await Promise.all(request.sketches.map((s) => loadImage(s.image, options.origin)));
  const name = mascotName(request.mascotName);
  const key = sha256(
    [
      PROMPT_VERSION,
      name,
      ...request.sketches.map((s, i) => `${s.id}:${sha256(images[i].bytes)}`),
    ].join('|'),
  ).slice(0, 32);

  const cached = await readCache(key);
  if (cached) return cached;

  let pending = inFlight.get(key);
  if (!pending) {
    pending = withFallback(
      options,
      'reflection',
      (model, timeoutMs) =>
        generate(
          request,
          name,
          images.map((i) => i.dataUri),
          key,
          { apiKey: options.apiKey, model, timeoutMs },
        ),
      TIMEOUT_MS,
    )
      .then(async (reflection) => {
        await writeCache(reflection);
        return reflection;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

async function generate(
  request: ReflectionRequest,
  name: string,
  dataUris: string[],
  key: string,
  options: { apiKey: string; model: string; timeoutMs: number },
): Promise<WeeklyReflection> {
  const intro = `${toneOfTheDay()}\n\nHere are the 7 sketches in this chapter, oldest first.`;
  const reflection = await withLengthRetry(async (correction) => {
    const user: ChatContent = [
      { type: 'text', text: correction ? `${intro}\n\n${correction}` : intro },
    ];
    request.sketches.forEach((s, i) => {
      user.push({
        type: 'text',
        text: `Sketch ${i + 1}${s.title ? ` (prompt: "${s.title}")` : ''}:`,
      });
      user.push({ type: 'image_url', image_url: { url: dataUris[i] } });
    });

    const content = await chatJSON({
      apiKey: options.apiKey,
      model: options.model,
      system: systemPrompt(name),
      user,
      schemaName: 'chapter_wrapped',
      schema: RESPONSE_SCHEMA,
      maxTokens: 2400,
      timeoutMs: options.timeoutMs,
      temperature: 0.9,
    });
    return parseReflection(content, request, key, options.model);
  }, `every line ${MAX_WRAPPED_WORDS} words max`);

  remember([reflection.headline.text, ...reflection.comments.map((c) => c.text)]);
  return reflection;
}

/**
 * Validates the model's JSON: a headline + 1–2 comments, each 8 words max (a longer line
 * throws TooLongFailure so the model rewrites it), and maps sketch numbers to ids.
 */
export function parseReflection(
  content: string,
  request: ReflectionRequest,
  key: string,
  model: string,
): WeeklyReflection {
  const raw = extractJSON(content);
  const ids = request.sketches.map((s) => s.id);

  const note = (value: unknown): ReflectionNote | null => {
    const o = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const noteText = text(o.text, 120);
    if (!noteText) return null;
    const numbers = Array.isArray(o.sketches) ? o.sketches : [];
    const sketchIds = [
      ...new Set(
        numbers
          .map(Number)
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= ids.length)
          .map((n) => ids[n - 1]),
      ),
    ];
    return { text: noteText, sketchIds };
  };

  const headline = note(raw.headline);
  const comments = [note(raw.comment1), note(raw.comment2)].filter(
    (n): n is ReflectionNote => n !== null,
  );

  if (!headline || comments.length === 0) {
    console.warn(
      '[reflection] incomplete reply',
      JSON.stringify({ headline: raw.headline, c1: raw.comment1, c2: raw.comment2 }).slice(0, 600),
    );
    throw new FeedbackFailure('malformed', 'The chapter recap came back incomplete.', 502);
  }

  const tooLong = [headline, ...comments]
    .map((n) => n.text)
    .filter((t) => wordCount(t) > MAX_WRAPPED_WORDS);
  if (tooLong.length) throw new TooLongFailure(tooLong);

  const tone = TONES.find((t) => t === raw.speakerTone) ?? 'cozy';

  return {
    status: 'ready',
    sketchIds: ids,
    headline,
    comments,
    tone,
    model,
    key,
    generatedAt: Date.now(),
    cached: false,
  };
}
