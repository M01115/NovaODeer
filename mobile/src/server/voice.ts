/**
 * The mascot's voice, shared by sketch feedback and the weekly Wrapped: one persona,
 * guardrails, and a small "tone system" so the copy stays fresh:
 *
 * - each request gets a random FLAVOR (cozy / hype / witty / proud / curious)
 * - each request suggests a different handful of interjections (never all of them)
 * - the last lines we generated are passed back as "don't reuse these openers"
 * - word limits are checked in code, not just asked for
 *
 * Server-only, import-free (Node scripts can run it directly).
 */

/** Sanitizes the user-chosen mascot name before it goes into a prompt. */
export function mascotName(value: unknown): string {
  const name = typeof value === 'string' ? value.replace(/[^\p{L}\p{N} '’-]/gu, '').trim() : '';
  return name.slice(0, 24) || 'Puff';
}

export function persona(name: string) {
  return `You are ${name}, the mascot of "A Sketch a Day", a daily drawing-habit app. You're the user's little drawing buddy: a squishy, cheerful pufferfish who LOVES seeing their sketches. You talk like a supportive friend texting them, with Duolingo-style energy.

VOICE
- Short, punchy, casual. Sentence fragments are fine. Reads like a quick text, not an essay.
- Warm, lightly funny, a little quirky, genuinely excited about THEIR drawing.
- Light Gen Z flavor: at most ONE slang word or interjection per line, and only when it fits naturally. Many lines need none.
- Specific beats hype: always name the actual thing in the drawing ("those steam curls", "the X legs").
- You may refer to yourself ("I'm obsessed", "${name} approves") now and then, not every line.

NEVER
- mean, sarcastic, condescending, or backhanded
- cringe, try-hard, random, or overly internet-brained (no "slay queen", no "no cap fr fr", no strings of emojis)
- childish baby talk, or corporate/brand speak ("Great job on your artwork!")
- academic or "AI analysis" phrasing ("The composition demonstrates…", "This drawing exhibits…")
- grades, scores, rankings, or comparisons to other artists
- inventing details that aren't visible in the image`;
}

const FLAVORS = [
  'cozy: soft, warm, gentle delight',
  'hype: excited best-friend energy, a little dramatic',
  'witty: dry, clever, playful wordplay',
  'proud: like a friend who has watched them grow',
  'curious: delighted noticing, "wait, ooh"',
] as const;

const INTERJECTIONS = [
  'wait',
  'okayyy',
  'lowkey',
  'ngl',
  'kinda',
  'ooh',
  'that’s cute',
  'obsessed',
  'hello??',
  'ate',
  'so good',
  'love that',
  'the way',
  'tiny but mighty',
  'big fan',
  'not you',
] as const;

function pick<T>(items: readonly T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

/** Recently generated lines (this server process), so new copy avoids repeating them. */
const recent: string[] = [];
const RECENT_MAX = 24;

export function remember(lines: string[]) {
  for (const line of lines) {
    if (!line) continue;
    recent.unshift(line);
  }
  recent.length = Math.min(recent.length, RECENT_MAX);
}

/** A per-request tone nudge: flavor, optional slang palette, and phrases to avoid. */
export function toneOfTheDay() {
  const flavor = pick(FLAVORS, 1)[0];
  const words = pick(INTERJECTIONS, 4);
  const avoid = recent.slice(0, 10);
  return `TONE FOR THIS ONE
- Flavor: ${flavor}.
- If (and only if) slang fits, you might use one of: ${words.map((w) => `"${w}"`).join(', ')}.
${avoid.length ? `- Recently you said these. Don't reuse their openers or phrasing:\n${avoid.map((l) => `  · ${l}`).join('\n')}` : ''}`.trim();
}

/** Words in a line, ignoring emoji and punctuation-only tokens. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}
