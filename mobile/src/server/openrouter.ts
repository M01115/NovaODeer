/**
 * Server-only OpenRouter plumbing shared by sketch feedback and weekly reflections:
 * one JSON-schema chat call, error mapping, and a one-time retry on a backup model.
 * Never import this from app screens: it runs with the secret API key.
 * Type-only imports, so scripts can run it directly with Node.
 */
import type { FeedbackErrorCode } from '../data/feedback';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Default vision model. Chosen after comparing Claude Haiku 5.5, Gemini 3.8 Flash and
 * Claude Sonnet 5.5 on our sample sketches (scripts/eval-feedback.mjs): all three gave
 * grounded comments and boxes on the right details; Haiku was the fastest and cheapest
 * with no failed replies. Override with OPENROUTER_MODEL.
 */
export const DEFAULT_MODEL = 'anthropic/claude-haiku-5.5';

/**
 * Tried once if the main model fails (unavailable, timeout, unreadable reply), so a live
 * demo survives a hiccup. Override with OPENROUTER_FALLBACK_MODEL, or "none" to turn off.
 */
export const FALLBACK_MODEL = 'google/gemini-3.8-flash';

export class FeedbackFailure extends Error {
  code: FeedbackErrorCode;
  status: number;

  constructor(code: FeedbackErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** A reply whose lines broke the word limits. Carries the offending lines for a retry. */
export class TooLongFailure extends FeedbackFailure {
  lines: string[];

  constructor(lines: string[]) {
    super('malformed', 'Puff got a bit too chatty.', 502);
    this.lines = lines;
  }
}

/**
 * Runs `attempt`; if its reply is too long, asks once more with a correction listing the
 * long lines. A second too-long reply is thrown (so the backup model can try).
 */
export async function withLengthRetry<T>(
  attempt: (correction?: string) => Promise<T>,
  limits: string,
): Promise<T> {
  try {
    return await attempt();
  } catch (error) {
    if (!(error instanceof TooLongFailure)) throw error;
    console.warn('[ai] too long, asking again:', error.lines);
    const correction = `IMPORTANT: your last answer broke the length rules (${limits}). These lines were too long:\n${error.lines
      .map((l) => `- "${l}"`)
      .join('\n')}\nWrite fresh, shorter lines. Count the words.`;
    return attempt(correction);
  }
}

export type ChatContent =
  string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];

export type ModelOptions = { apiKey: string; model?: string; fallbackModel?: string };

/**
 * One chat completion that must answer with JSON matching `schema`. Returns the raw
 * text content (callers parse and validate it). Throws FeedbackFailure on any problem.
 */
export async function chatJSON(options: {
  apiKey: string;
  model: string;
  system: string;
  user: ChatContent;
  schemaName: string;
  schema: object;
  maxTokens: number;
  timeoutMs: number;
  temperature?: number;
  /** How hard the model thinks before answering. Thinking spends max_tokens too, so keep it low. */
  reasoningEffort?: 'low' | 'medium' | 'high';
}): Promise<string> {
  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(options.timeoutMs),
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'A Sketch a Day',
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens,
        temperature: options.temperature ?? 0.7,
        // Quick visual reactions don't need long private reasoning: it slowed replies and,
        // counted against max_tokens, cut answers off mid-JSON (then the backup model ran too).
        reasoning: { effort: options.reasoningEffort ?? 'low' },
        messages: [
          { role: 'system', content: options.system },
          { role: 'user', content: options.user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: options.schemaName, strict: true, schema: options.schema },
        },
      }),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new FeedbackFailure('timeout', 'Puff took too long to look. Please try again.', 504);
    }
    throw new FeedbackFailure('upstream', 'Couldn’t reach the AI service.', 502);
  }

  if (!res.ok) throw await upstreamFailure(res);

  let data: { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  try {
    data = await res.json();
  } catch {
    throw new FeedbackFailure('malformed', 'The AI sent back something unreadable.', 502);
  }
  // OpenRouter sometimes reports provider errors inside a 200 response.
  if (data.error) {
    throw new FeedbackFailure(
      'upstream',
      data.error.message ?? 'The AI service had a problem.',
      502,
    );
  }
  const choice = data.choices?.[0] as
    | { message?: { content?: string }; finish_reason?: string; native_finish_reason?: string }
    | undefined;
  if (choice?.finish_reason && choice.finish_reason !== 'stop') {
    console.warn(`[ai] ${options.model} stopped early: ${choice.finish_reason} (${choice.native_finish_reason ?? '-'})`);
  }
  const content = choice?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new FeedbackFailure('malformed', 'The AI sent back an empty answer.', 502);
  }
  return content;
}

async function upstreamFailure(res: Response): Promise<FeedbackFailure> {
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 300);
  } catch {}
  console.error(`[ai] OpenRouter ${res.status}: ${detail}`);

  if (res.status === 401 || res.status === 403) {
    return new FeedbackFailure(
      'not_configured',
      'The AI key was rejected. Check OPENROUTER_API_KEY.',
      502,
    );
  }
  if (res.status === 402) {
    return new FeedbackFailure('no_credits', 'The AI account is out of credits.', 502);
  }
  if (res.status === 429) {
    return new FeedbackFailure(
      'rate_limited',
      'Lots of sketches at once! Try again in a moment.',
      503,
    );
  }
  if (res.status === 404 || (res.status === 400 && /model/i.test(detail))) {
    return new FeedbackFailure('model_unavailable', 'The AI model isn’t available right now.', 502);
  }
  if (res.status === 408 || res.status === 504) {
    return new FeedbackFailure('timeout', 'Puff took too long to look. Please try again.', 504);
  }
  return new FeedbackFailure('upstream', 'The AI service had a problem.', 502);
}

/** Failures where trying a different model might help. */
const RETRYABLE: FeedbackErrorCode[] = ['model_unavailable', 'timeout', 'malformed', 'upstream'];

/**
 * Runs `attempt` with the main model, then once with the backup model if the first try
 * fails in a way another model might not. Throws FeedbackFailure if both fail.
 */
export async function withFallback<T>(
  options: ModelOptions,
  label: string,
  attempt: (model: string, timeoutMs: number) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const model = options.model || DEFAULT_MODEL;
  const fallback = options.fallbackModel || FALLBACK_MODEL;
  try {
    return await attempt(model, timeoutMs);
  } catch (error) {
    const retry =
      error instanceof FeedbackFailure &&
      RETRYABLE.includes(error.code) &&
      fallback !== 'none' &&
      fallback !== model;
    if (!retry) throw error;
    console.warn(`[${label}] ${model} failed (${error.code}); retrying with ${fallback}`);
    return attempt(fallback, timeoutMs);
  }
}

/** Pulls the JSON object out of a model reply (some wrap it in ``` fences or prose). */
export function extractJSON(content: string): Record<string, unknown> {
  const json = content.match(/\{[\s\S]*\}/)?.[0];
  try {
    const value = JSON.parse(json ?? '');
    if (value && typeof value === 'object') return value as Record<string, unknown>;
  } catch {}
  // Usually a reply cut off at max_tokens: the length and ending show it.
  console.warn(`[ai] unreadable JSON (${content.length} chars), ends: …${content.slice(-80).replace(/\s+/g, ' ')}`);
  throw new FeedbackFailure('malformed', 'The AI sent back something unreadable.', 502);
}

export function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}
