import { useSyncExternalStore } from 'react';

/**
 * Whether the user has posted today's sketch. The friends feed stays locked until then.
 * In-memory for now (resets when the app restarts); the backend will own this later.
 * Whoever builds scanning/upload should call `markPostedToday()` once the sketch is saved.
 */
let postedToday = false;
const listeners = new Set<() => void>();

export function markPostedToday() {
  if (postedToday) return;
  postedToday = true;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePostedToday() {
  return useSyncExternalStore(
    subscribe,
    () => postedToday,
    () => false
  );
}
