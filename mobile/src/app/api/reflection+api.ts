import type { FeedbackError, FeedbackErrorCode } from '@/data/feedback';
import { FeedbackFailure } from '@/server/openrouter';
import { getReflection, validateReflectionRequest } from '@/server/weekly-reflection';

/**
 * POST /api/reflection — Smudge's "Sketch Wrapped" for one complete chapter of 7 sketches
 * (see src/server/weekly-reflection.ts). Cached on disk by the 7 images, so asking again
 * for the same chapter returns instantly without another AI call.
 *
 * Body: { sketches: [{ id, title, image }] × 7 }, image = data URI or a URL path on this
 * server (bundled sample sketches). On failure: { error: { code, message } }.
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
    const chapter = validateReflectionRequest(body);
    const reflection = await getReflection(chapter, {
      apiKey,
      model: process.env.OPENROUTER_MODEL,
      fallbackModel: process.env.OPENROUTER_FALLBACK_MODEL,
      origin: new URL(request.url).origin,
    });
    return Response.json(reflection);
  } catch (error) {
    if (error instanceof FeedbackFailure) return fail(error.code, error.message, error.status);
    console.error('[reflection] unexpected error', error);
    return fail('upstream', 'Something went wrong while writing this chapter’s recap.', 500);
  }
}

function fail(code: FeedbackErrorCode, message: string, status: number) {
  const body: FeedbackError = { error: { code, message } };
  return Response.json(body, { status });
}
