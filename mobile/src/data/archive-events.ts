/**
 * Lets other screens (e.g. the streak screen) ask Home to slide the archive open.
 * Home owns the archive layer and its drag animation, so it does the opening.
 */
let listener: (() => void) | null = null;
let pending = false;

export function requestArchiveOpen() {
  if (listener) listener();
  else pending = true;
}

/** Home subscribes; returns an unsubscribe function. */
export function onArchiveRequest(fn: () => void) {
  listener = fn;
  if (pending) {
    pending = false;
    fn();
  }
  return () => {
    if (listener === fn) listener = null;
  };
}
