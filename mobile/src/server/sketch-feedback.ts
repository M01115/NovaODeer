/**
 * Server-only: sends one sketch to a vision model and turns the reply into validated,
 * grounded feedback: exactly 2 compliments + 1 improvement, each with an annotation box.
 *
 * Used by src/app/api/feedback+api.ts (and scripts/eval-feedback.mjs for testing).
 * Type-only imports, so the eval script can run this file directly with Node.
 */
import type { Annotation, AnnotationKind, FeedbackRequest, SketchFeedback } from '../data/feedback';
import {
  chatJSON,
  DEFAULT_MODEL,
  extractJSON,
  FeedbackFailure,
  type ModelOptions,
  text,
  TooLongFailure,
  withFallback,
  withLengthRetry,
} from './openrouter';
import { mascotName, persona, remember, toneOfTheDay, wordCount } from './voice';

export { DEFAULT_MODEL, FeedbackFailure };

/** Keep in sync with MAX_IMAGE_BYTES in src/data/feedback.ts. */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

/** Only draw a circle when the model is at least this sure of the location. */
const MIN_CONFIDENCE = 0.6;
/** Boxes bigger than this (fraction of the image) don't point at one detail. */
const MAX_BOX_AREA = 0.4;

/** Words that turn a tip into criticism. A reply using them in the tip is retried. */
const HARSH =
  /\b(wrong|bad|poor|ugly|mistake|messy|sloppy|fix|failed?|incorrect|lacks?|weak|needs? to|you must|you should)\b/i;

/** Hard caps checked in code (the prompt asks for 5–12 words; a little slack here). */
const MAX_COMMENT_WORDS = 14;
const MAX_REACTION_WORDS = 14;
const MAX_FEATURE_WORDS = 5;

function systemPrompt(name: string) {
  return `${persona(name)}

YOUR JOB RIGHT NOW: the user just finished today's quick sketch (1–5 minutes) and showed it to you. React like you're looking at it together, live.

STEP 1 (private): look closely. The image is often a phone photo of paper: ignore lighting, shadows, paper edges, the table and fingers. In "seen", plainly list what's actually drawn: shapes, lines, where things are. No guessing.

STEP 2: "kind":
- "sketch": there are drawn marks (rough doodles and abstract scribbles count!).
- "unclear": blank, too blurry/dark, or clearly not a drawing (a selfie, a screenshot, notes). Then overallReaction is a short, kind ask for a clearer photo of their sketch; the other fields still need values but are ignored.

STEP 3 (sketch only):
- subject: plain description, hedged if unsure ("what looks like a mug"). If it doesn't match the prompt, describe what you see; never pretend it matches.
- overallReaction: your first reaction, 5–12 words, about THIS drawing. E.g. the vibe of "Okayyy this little bird has so much attitude."
- compliments: EXACTLY 2, about two DIFFERENT visible details you genuinely love (a line, a shape, shading, texture, a tiny detail, a fun choice).
- improvement: EXACTLY 1 gentle, motivating "try this next" about a specific visible spot. Pick the ONE idea that fits THIS drawing best: heavier lines on near edges, a few darker marks at the focal point, one smooth sweep for a curve, a second kind of texture mark, a hint of ground or context, light shading on one side, fewer/longer strokes in a busy spot, tucking one shape behind another. (Shadows under things only if nothing else fits.) Frame it as an invite, never a correction: no "wrong", "bad", "fix", "you should", "you need to".
  For each of the three:
  - feature: 2–4 words naming the detail ("steam curls", "X-shaped legs").
  - comment: 5–12 words, in your voice, specific to that detail. Like a quick text, not an explanation. Vibe examples (don't copy): "Wait, these steam curls are so cozy." / "Lowkey obsessed with how chunky these legs are." / "Ooh, a thicker line here could really pop." / "Try a few darker marks around the eye!"
    Each comment must make sense ONLY for this drawing. Don't start two comments the same way.
  - box: snug box around that detail (for the tip: the area it's about), as fractions of the WHOLE image (0 = left/top, 1 = right/bottom). left/top = top-left corner.
  - confidence: 0–1, how sure you are the box covers that detail.`;
}

const OBSERVATION = {
  type: 'object',
  additionalProperties: false,
  required: ['feature', 'comment', 'box', 'confidence'],
  properties: {
    feature: { type: 'string' },
    comment: { type: 'string' },
    box: {
      type: 'object',
      additionalProperties: false,
      required: ['left', 'top', 'width', 'height'],
      properties: {
        left: { type: 'number' },
        top: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
      },
    },
    confidence: { type: 'number' },
  },
} as const;

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['seen', 'kind', 'subject', 'overallReaction', 'compliments', 'improvement'],
  properties: {
    seen: { type: 'string' },
    kind: { type: 'string', enum: ['sketch', 'unclear'] },
    subject: { type: 'string' },
    overallReaction: { type: 'string' },
    compliments: { type: 'array', minItems: 2, maxItems: 2, items: OBSERVATION },
    improvement: OBSERVATION,
  },
} as const;

/** Checks the request body. Throws FeedbackFailure('bad_request' | 'bad_image'). */
export function validateRequest(body: unknown): FeedbackRequest {
  if (!body || typeof body !== 'object') {
    throw new FeedbackFailure('bad_request', 'Expected a JSON body.', 400);
  }
  const b = body as Record<string, unknown>;
  if (typeof b.image !== 'string') {
    throw new FeedbackFailure('bad_image', 'No image was sent.', 400);
  }
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,/.exec(b.image);
  if (!match) {
    throw new FeedbackFailure('bad_image', 'Please upload a JPG, PNG or WebP image.', 415);
  }
  const base64Length = b.image.length - match[0].length;
  if (base64Length * 0.75 > MAX_IMAGE_BYTES) {
    throw new FeedbackFailure('bad_image', 'That image is too large. Try a smaller photo.', 413);
  }
  if (base64Length < 200) {
    throw new FeedbackFailure('bad_image', 'That image looks empty.', 400);
  }
  const medium = b.medium === 'paper' || b.medium === 'app' ? b.medium : 'upload';
  return {
    image: b.image,
    prompt: typeof b.prompt === 'string' ? b.prompt.slice(0, 200) : '',
    medium,
    seconds: typeof b.seconds === 'number' && b.seconds >= 0 ? b.seconds : undefined,
    mascotName: mascotName(b.mascotName),
  };
}

const MEDIUM_TEXT: Record<FeedbackRequest['medium'], string> = {
  paper: 'drawn on paper and photographed with a phone camera',
  upload: 'an image they uploaded (maybe drawn on an iPad or in another app, or a photo of paper)',
  app: 'drawn directly in the app on their phone',
};

/** Main model, then the backup model once if needed. Throws FeedbackFailure if both fail. */
export function analyzeWithFallback(
  request: FeedbackRequest,
  options: ModelOptions,
): Promise<SketchFeedback> {
  return withFallback(
    options,
    'feedback',
    (model, timeoutMs) => analyzeSketch(request, { apiKey: options.apiKey, model, timeoutMs }),
    TIMEOUT_MS,
  );
}

/** One model call, validated. Throws FeedbackFailure on any problem. */
export async function analyzeSketch(
  request: FeedbackRequest,
  options: { apiKey: string; model?: string; timeoutMs?: number },
): Promise<SketchFeedback> {
  const model = options.model || DEFAULT_MODEL;
  const minutes = request.seconds ? Math.max(1, Math.round(request.seconds / 60)) : null;
  const name = mascotName(request.mascotName);
  const tone = toneOfTheDay();
  const userText = [
    request.prompt ? `Today's prompt was: "${request.prompt}"` : null,
    `Medium: ${MEDIUM_TEXT[request.medium]}`,
    minutes ? `They sketched for about ${minutes} minute${minutes === 1 ? '' : 's'}.` : null,
    tone,
    'Here is their sketch.',
  ]
    .filter(Boolean)
    .join('\n');

  const feedback = await withLengthRetry(async (correction) => {
    const content = await chatJSON({
      apiKey: options.apiKey,
      model,
      system: systemPrompt(name),
      user: [
        { type: 'text', text: correction ? `${userText}\n\n${correction}` : userText },
        { type: 'image_url', image_url: { url: request.image } },
      ],
      schemaName: 'sketch_feedback',
      schema: RESPONSE_SCHEMA,
      maxTokens: 1400,
      timeoutMs: options.timeoutMs ?? TIMEOUT_MS,
      temperature: 0.85,
    });
    return parseFeedback(content, model);
  }, `comments ${MAX_COMMENT_WORDS} words max, overallReaction ${MAX_REACTION_WORDS} words max`);

  if (feedback.status === 'ok') {
    remember([feedback.overallReaction, ...feedback.annotations.map((a) => a.comment)]);
  }
  return feedback;
}

/**
 * Parses and checks the model's JSON: exactly 2 compliments + 1 encouraging improvement.
 * Anything else throws FeedbackFailure('malformed'), which makes the backup model try.
 */
export function parseFeedback(content: string, model: string): SketchFeedback {
  const raw = extractJSON(content);

  const overallReaction = text(raw.overallReaction, 200);
  if (!overallReaction) {
    throw new FeedbackFailure('malformed', 'The AI forgot to say anything.', 502);
  }
  if (raw.kind === 'unclear') {
    if (wordCount(overallReaction) > 20) throw new TooLongFailure([overallReaction]);
    return { status: 'unclear', overallReaction, model };
  }

  // Models occasionally send a third compliment despite the schema; keep the first two.
  const compliments = (Array.isArray(raw.compliments) ? raw.compliments : [])
    .map((o, i) => toAnnotation(o, `c${i}`, 'compliment'))
    .filter((a): a is Annotation => a !== null)
    .slice(0, 2);
  const improvement = toAnnotation(raw.improvement, 'i0', 'improvement');

  if (compliments.length !== 2 || !improvement) {
    console.warn(
      `[feedback] incomplete reply: ${compliments.length} compliments, improvement=${!!improvement}`,
      JSON.stringify({ compliments: raw.compliments, improvement: raw.improvement }).slice(0, 600),
    );
    throw new FeedbackFailure('malformed', 'Puff’s notes came back incomplete.', 502);
  }
  if (HARSH.test(improvement.comment)) {
    console.warn(`[feedback] tip sounded critical, retrying: ${improvement.comment}`);
    throw new FeedbackFailure('malformed', 'Puff’s tip came out too harsh.', 502);
  }

  // Short and punchy, enforced: anything over the caps gets rewritten (see withLengthRetry).
  const tooLong = [
    ...(wordCount(overallReaction) > MAX_REACTION_WORDS ? [overallReaction] : []),
    ...[...compliments, improvement]
      .filter((a) => wordCount(a.comment) > MAX_COMMENT_WORDS)
      .map((a) => a.comment),
  ];
  if (tooLong.length) throw new TooLongFailure(tooLong);
  for (const a of [...compliments, improvement]) {
    if (wordCount(a.feature) > MAX_FEATURE_WORDS) {
      a.feature = a.feature.split(/\s+/).slice(0, 4).join(' ');
    }
  }

  return {
    status: 'ok',
    subject: text(raw.subject, 120),
    overallReaction,
    annotations: [...compliments, improvement],
    model,
  };
}

function toAnnotation(value: unknown, id: string, kind: AnnotationKind): Annotation | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const feature = text(o.feature, 60);
  const comment = text(o.comment, 280);
  if (!comment) return null;

  const box = (o.box && typeof o.box === 'object' ? o.box : o) as Record<string, unknown>;
  let [x, y, width, height] = [box.left ?? box.x, box.top ?? box.y, box.width, box.height].map(
    Number,
  );
  let confidence = Number(o.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.min(1, Math.max(0, confidence > 1 ? confidence / 100 : confidence));

  let located = [x, y, width, height].every(Number.isFinite);
  if (located) {
    // Some models answer in percent (0–100) or per-mille (0–1000) instead of fractions.
    const biggest = Math.max(x, y, width, height);
    const scale = biggest > 100 ? 1000 : biggest > 1.5 ? 100 : 1;
    [x, y, width, height] = [x, y, width, height].map((n) => n / scale);
    // Keep the box inside the image.
    x = clamp01(x);
    y = clamp01(y);
    width = Math.min(Math.max(0, width), 1 - x);
    height = Math.min(Math.max(0, height), 1 - y);
    const area = width * height;
    // Tiny boxes are fine (the app draws a minimum-size circle); empty or huge ones aren't.
    located = confidence >= MIN_CONFIDENCE && area > 0 && area <= MAX_BOX_AREA;
  } else {
    [x, y, width, height] = [0, 0, 0, 0];
  }

  return { id, kind, feature, comment, x, y, width, height, confidence, located };
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}
