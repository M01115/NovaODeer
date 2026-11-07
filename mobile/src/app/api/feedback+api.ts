import type { FeedbackError, FeedbackErrorCode } from '@/data/feedback';
import { analyzeWithFallback, FeedbackFailure, validateRequest } from '@/server/sketch-feedback';

/**
 * POST /api/feedback — Puff looks at a sketch and replies with specific, positive
 * feedback plus annotation boxes (see src/server/sketch-feedback.ts).
 *
 * Runs on the server (the Expo dev server for now), so the OpenRouter key never ships
 * inside the app. Set OPENROUTER_API_KEY in mobile/.env.local (git-ignored).
 * Optional: OPENROUTER_MODEL to try a different vision model, OPENROUTER_FALLBACK_MODEL
 * for the backup model (or "none").
 *
 * On failure it returns { error: { code, message } } and never made-up feedback.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return fail('not_configured', 'OPENROUTER_API_KEY is not set in mobile/.env.local.', 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('bad_request', 'Expected a JSON body.', 400);
  }

  try {
    const sketch = validateRequest(body);
    const feedback = await analyzeWithFallback(sketch, {
      apiKey,
      model: process.env.OPENROUTER_MODEL,
      fallbackModel: process.env.OPENROUTER_FALLBACK_MODEL,
    });
    return Response.json(feedback);
  } catch (error) {
    if (error instanceof FeedbackFailure) return fail(error.code, error.message, error.status);
    console.error('[feedback] unexpected error', error);
    return fail('upstream', 'Something went wrong while looking at your sketch.', 500);
  }
}

function fail(code: FeedbackErrorCode, message: string, status: number) {
  const body: FeedbackError = { error: { code, message } };
  return Response.json(body, { status });
}
