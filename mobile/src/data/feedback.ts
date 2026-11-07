/**
 * Shared types for Smudge's AI: per-sketch feedback and weekly (7-sketch) reflections.
 * Used by the app screens and by the server code in src/server/. No imports, so both
 * sides (and Node scripts) can use it.
 */

/** Upload formats the app accepts. Everything is converted to JPEG before upload. */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

/** Largest image (decoded bytes) the server will analyze. The app shrinks photos well below this. */
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

// ---------------------------------------------------------------------------------------
// Per-sketch feedback: exactly 2 compliments + 1 improvement
// ---------------------------------------------------------------------------------------

/** "Love this!" / "Nice touch!" for the two compliments, "Try this next!" for the tip. */
export type AnnotationKind = 'compliment' | 'improvement';

/**
 * One observation about a specific detail, with where it is on the sketch.
 * Box values are fractions (0–1) of the image: x/y is the TOP-LEFT corner.
 */
export type Annotation = {
  id: string;
  kind: AnnotationKind;
  /** What the detail is, e.g. "Steam curls". */
  feature: string;
  /** One or two warm, specific sentences about it. */
  comment: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The model's own guess (0–1) at how well the box matches the detail. Not ground truth. */
  confidence: number;
  /**
   * Whether to draw the circle on the sketch. False when the location looks unreliable
   * (low confidence, or a box too big to point at anything): the comment is then shown
   * in its card only, never with a misleading circle.
   */
  located: boolean;
};

export type SketchFeedback =
  | {
      status: 'ok';
      /** Short, hedged description of what the sketch shows. */
      subject: string;
      /** One-line reaction shown in Smudge's speech bubble. */
      overallReaction: string;
      /**
       * Always exactly three, in this order: compliment, compliment, improvement.
       * Use getCompliments()/getImprovement() rather than indexing.
       */
      annotations: Annotation[];
      model: string;
    }
  | {
      /** Blank, illegible, or not a drawing: Smudge kindly asks for a clearer photo. */
      status: 'unclear';
      overallReaction: string;
      model: string;
    };

export type OkFeedback = Extract<SketchFeedback, { status: 'ok' }>;

export function getCompliments(feedback: OkFeedback) {
  return feedback.annotations.filter((a) => a.kind === 'compliment');
}

export function getImprovement(feedback: OkFeedback) {
  return feedback.annotations.find((a) => a.kind === 'improvement');
}

/** Card labels, in order. */
export const ANNOTATION_LABELS = ['Love this!', 'Nice touch!', 'Try this next!'] as const;

/**
 * What we keep for each analyzed sketch (today's post now; the backend later):
 * the structured feedback plus which sketch it belongs to and how the analysis went.
 */
export type SketchAnalysis = {
  sketchId: string;
  status: 'pending' | 'ok' | 'unclear' | 'failed' | 'skipped';
  feedback?: SketchFeedback;
  analyzedAt?: number;
};

export type FeedbackErrorCode =
  | 'bad_request'
  | 'bad_image'
  | 'not_configured'
  | 'no_credits'
  | 'rate_limited'
  | 'model_unavailable'
  | 'timeout'
  | 'malformed'
  | 'upstream';

/** Returned instead of feedback when analysis fails. The app never invents feedback. */
export type FeedbackError = { error: { code: FeedbackErrorCode; message: string } };

export type FeedbackRequest = {
  /** The sketch as a data URI: data:image/(jpeg|png|webp);base64,... */
  image: string;
  /** Today's prompt, e.g. "A coffee mug". */
  prompt: string;
  /** How the sketch was made. */
  medium: 'paper' | 'upload' | 'app';
  /** Time spent sketching, in seconds. */
  seconds?: number;
  /** The mascot's (user-chosen) name, so it speaks as itself. */
  mascotName?: string;
};

// ---------------------------------------------------------------------------------------
// Weekly reflections ("Sketch Wrapped"): one per complete group of 7 sketches
// ---------------------------------------------------------------------------------------

/** One sketch sent for a chapter reflection. */
export type ReflectionSketch = {
  /** Stable id (the sketch's date key). */
  id: string;
  /** Prompt title, e.g. "A desk lamp". */
  title: string;
  /**
   * The image: a data URI (uploaded sketch) or a URL path on the app's own server
   * (bundled sample sketches, e.g. /assets/...). Other hosts are refused.
   */
  image: string;
};

export type ReflectionRequest = {
  sketches: ReflectionSketch[];
  /** The mascot's (user-chosen) name: it hosts the Wrapped. */
  mascotName?: string;
};

/** A short observation about the chapter, linked to the sketches that show it. */
export type ReflectionNote = {
  text: string;
  /** Ids of the sketches that inspired it (only ones the model pointed at; may be empty). */
  sketchIds: string[];
};

export type WeeklyReflection = {
  status: 'ready';
  /** Ids of the 7 sketches in this chapter, oldest first. */
  sketchIds: string[];
  /** The mascot's superlative for the chapter, e.g. "You were in your curves era." (≤ 8 words) */
  headline: ReflectionNote;
  /** 1–2 quick mascot reactions (≤ 8 words each). */
  comments: ReflectionNote[];
  /** The vibe the mascot went for: cozy, hype, witty, proud or curious. */
  tone: string;
  model: string;
  /** Cache key: changes whenever any of the 7 images (or the mascot's name) change. */
  key: string;
  generatedAt: number;
  /** True when served from the cache (no AI call was made). */
  cached: boolean;
};
