import { useSyncExternalStore } from 'react';

/**
 * Today's posted sketch. The friends feed stays locked until there is one.
 * In-memory for now (resets when the app restarts); the backend will own this later.
 * Whoever builds scanning/upload should call `markPostedToday()` once the sketch is saved,
 * passing the image and Smudge's feedback when they exist.
 */
export type PostedSketch = {
  /** Seconds spent sketching (from the timer). */
  seconds: number;
  /** The scanned/uploaded image (a URI or bundled module). Not available yet. */
  image?: number;
  /** Smudge's feedback on the sketch (from the AI). */
  feedback?: string;
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
