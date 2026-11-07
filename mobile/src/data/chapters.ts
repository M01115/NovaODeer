/**
 * Groups completed sketches into "chapters" of 7, oldest first: sketches 1–7 are chapter
 * 1, 8–14 chapter 2, and so on. Counts completed sketches, not calendar days, so missed
 * days don't split a chapter. Only a full chapter gets an AI reflection.
 *
 * Generic and import-free so it can be unit-tested with plain Node
 * (scripts/chapters.test.mjs).
 */
export const CHAPTER_SIZE = 7;

export type Chapter<T> = {
  /** 0-based chapter number. */
  index: number;
  /** Index (in the full sketch list) of this chapter's first sketch. */
  start: number;
  /** The chapter's sketches, oldest first (1–7 of them). */
  items: T[];
  /** True once the chapter has all 7 sketches; only then is a reflection generated. */
  complete: boolean;
};

export function groupIntoChapters<T>(sketches: T[], size: number = CHAPTER_SIZE): Chapter<T>[] {
  const chapters: Chapter<T>[] = [];
  for (let start = 0; start < sketches.length; start += size) {
    const items = sketches.slice(start, start + size);
    chapters.push({ index: chapters.length, start, items, complete: items.length === size });
  }
  return chapters;
}
