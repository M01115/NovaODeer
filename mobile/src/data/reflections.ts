import { Asset } from 'expo-asset';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import type { FeedbackError, ReflectionSketch, WeeklyReflection } from '@/data/feedback';

/**
 * Client side of the weekly "Sketch Wrapped": asks /api/reflection for a complete
 * chapter's reflection, once. Results (and requests in progress) are kept per chapter
 * key in a small shared store, so re-renders, scrolling, or reopening the archive never
 * call the AI again. The server also caches on disk, so even an app restart costs
 * nothing for a chapter it has already seen.
 */
export type ChapterSketch = {
  /** Stable id (the sketch's date key). */
  id: string;
  title: string;
  /** Bundled module (sample sketches) or a data/file URI (an uploaded sketch). */
  image: number | string;
};

export type ReflectionState =
  | { status: 'loading' }
  | { status: 'ready'; reflection: WeeklyReflection }
  | { status: 'error'; message: string };

const states = new Map<string, ReflectionState>();
const listeners = new Set<() => void>();

function setChapterState(key: string, state: ReflectionState) {
  states.set(key, state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Bundled images become a URL on the app's own server; uploads are sent as data URIs. */
function toRequestImage(image: number | string): string {
  if (typeof image === 'string') return image;
  return Asset.fromModule(image).uri;
}

/** A cheap fingerprint of an image, so changing a sketch changes the chapter key. */
function fingerprint(image: number | string) {
  if (typeof image !== 'string') return `m:${toRequestImage(image)}`;
  let hash = 5381;
  // Sample the string (data URIs are long): length + ~4k characters spread across it.
  const step = Math.max(1, Math.floor(image.length / 4096));
  for (let i = 0; i < image.length; i += step) hash = (hash * 33) ^ image.charCodeAt(i);
  return `s${image.length}:${(hash >>> 0).toString(36)}`;
}

export function chapterKey(sketches: ChapterSketch[]) {
  return sketches.map((s) => `${s.id}=${fingerprint(s.image)}`).join('|');
}

/** Starts a request unless one is running or already succeeded (`force` retries errors). */
function load(key: string, sketches: ChapterSketch[], mascotName: string, force = false) {
  const current = states.get(key);
  if (current?.status === 'loading' || current?.status === 'ready') return;
  if (current?.status === 'error' && !force) return;
  setChapterState(key, { status: 'loading' });

  const body: { sketches: ReflectionSketch[]; mascotName: string } = {
    sketches: sketches.map((s) => ({ id: s.id, title: s.title, image: toRequestImage(s.image) })),
    mascotName,
  };
  fetch('/api/reflection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then((res) => res.json() as Promise<WeeklyReflection | FeedbackError>)
    .then((data) => {
      if ('error' in data) setChapterState(key, { status: 'error', message: data.error.message });
      else if (data.status === 'ready') setChapterState(key, { status: 'ready', reflection: data });
      else setChapterState(key, { status: 'error', message: 'Puff got a confusing answer.' });
    })
    .catch(() =>
      setChapterState(key, { status: 'error', message: 'Couldn’t reach Puff’s server.' }),
    );
}

/**
 * The reflection for one chapter. Pass `null` for incomplete chapters: nothing is
 * requested (we never make up a recap for fewer than 7 sketches).
 */
export function useChapterReflection(sketches: ChapterSketch[] | null, mascotName: string) {
  // The mascot hosts the recap, so a rename gives a fresh one.
  const key = sketches ? `${mascotName}|${chapterKey(sketches)}` : null;
  const state = useSyncExternalStore(
    subscribe,
    () => (key ? (states.get(key) ?? null) : null),
    () => null,
  );

  useEffect(() => {
    if (key && sketches) load(key, sketches, mascotName);
    // `sketches` is fully described by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const retry = useCallback(() => {
    if (key && sketches) load(key, sketches, mascotName, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Until the first request starts, a complete chapter counts as loading.
  return { state: state ?? (key ? ({ status: 'loading' } as const) : null), retry };
}
