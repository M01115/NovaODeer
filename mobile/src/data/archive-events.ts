/**
 * Lets other screens (e.g. the streak screen's "See past sketches") ask Home to slide the
 * archive open. Home owns the archive layer and its drag animation, so it does the opening.
 *
 * The request is queued and Home takes it when it's focused: the streak screen sits on top
 * of Home and closes first, and an animation started while Home is still hidden behind it
 * gets lost (seen on the web preview).
 */
let pending = false;

export function requestArchiveOpen() {
  pending = true;
}

/** Home calls this when it comes into focus; true means "open the archive now". */
export function takeArchiveRequest() {
  const was = pending;
  pending = false;
  return was;
}
