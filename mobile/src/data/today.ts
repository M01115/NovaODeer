import { useSyncExternalStore } from 'react';

import type { SketchAnalysis } from '@/data/feedback';

/**
 * Today's posted sketch. The friends feed stays locked until there is one.
 * In-memory for now (resets when the app restarts); the backend will own this later.
 * Called by the feedback screen (src/app/feedback.tsx) when the user posts their scanned
 * sketch, with the image and Puff's AI feedback.
 */
export type PostedSketch = {
  /** Stable id: today's date key (YYYY-MM-DD). */
  id?: string;
  /** Seconds spent sketching (from the timer). */
  seconds: number;
  /** The scanned/uploaded image: a data/file URI, or a bundled module (require()). */
  image?: number | string;
  /** Puff's feedback on the sketch (from the AI). */
  feedback?: string;
  /** How it was made: photographed paper, or uploaded from photos. */
  medium?: 'paper' | 'upload';
  /** Smudge's structured analysis (2 compliments + 1 tip, with annotation boxes). */
  analysis?: SketchAnalysis;
};

let posted: PostedSketch | null = null;
const listeners = new Set<() => void>();

export function markPostedToday(sketch: PostedSketch) {
  posted = sketch;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Today's posted sketch, or null if not posted yet. */
export function usePostedToday() {
  return useSyncExternalStore(
    subscribe,
    () => posted,
    () => null
  );
}
