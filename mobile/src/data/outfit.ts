import { useSyncExternalStore } from 'react';

/**
 * Smudge's look: what he's wearing and his pencil colour. Shown everywhere Smudge appears.
 * In-memory for now (resets when the app restarts); save it to the backend later.
 */
export type Hat = 'none' | 'beret' | 'beanie' | 'party' | 'crown';
export type Eyewear = 'none' | 'round' | 'shades';
export type Neckwear = 'none' | 'scarf' | 'bowtie';
export type BodyColor = 'graphite' | 'blue' | 'red' | 'sage';

export type Outfit = {
  hat: Hat;
  eyes: Eyewear;
  neck: Neckwear;
  color: BodyColor;
};

export type Slot = keyof Outfit;

export const DEFAULT_OUTFIT: Outfit = { hat: 'none', eyes: 'none', neck: 'none', color: 'graphite' };

type Item<V extends string> = {
  id: V;
  label: string;
  /** Streak (days) needed to unlock; 0 = free. */
  unlockStreak: number;
};

/** The wardrobe, by slot. Items with an unlockStreak are earned by keeping a streak. */
export const WARDROBE: { [S in Slot]: { title: string; items: Item<Outfit[S]>[] } } = {
  hat: {
    title: 'Hats',
    items: [
      { id: 'none', label: 'None', unlockStreak: 0 },
      { id: 'beret', label: 'Beret', unlockStreak: 0 },
      { id: 'beanie', label: 'Beanie', unlockStreak: 0 },
      { id: 'party', label: 'Party hat', unlockStreak: 7 },
      { id: 'crown', label: 'Crown', unlockStreak: 30 },
    ],
  },
  eyes: {
    title: 'Glasses',
    items: [
      { id: 'none', label: 'None', unlockStreak: 0 },
      { id: 'round', label: 'Round', unlockStreak: 0 },
      { id: 'shades', label: 'Shades', unlockStreak: 14 },
    ],
  },
  neck: {
    title: 'Neck',
    items: [
      { id: 'none', label: 'None', unlockStreak: 0 },
      { id: 'scarf', label: 'Scarf', unlockStreak: 0 },
      { id: 'bowtie', label: 'Bow tie', unlockStreak: 3 },
    ],
  },
  color: {
    title: 'Color',
    items: [
      { id: 'graphite', label: 'Graphite', unlockStreak: 0 },
      { id: 'blue', label: 'Blue pencil', unlockStreak: 0 },
      { id: 'red', label: 'Red pencil', unlockStreak: 5 },
      { id: 'sage', label: 'Sage pencil', unlockStreak: 21 },
    ],
  },
};

let outfit: Outfit = DEFAULT_OUTFIT;
let name = 'Smudge';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setOutfit(change: Partial<Outfit>) {
  outfit = { ...outfit, ...change };
  emit();
}

export function setMascotName(next: string) {
  name = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOutfit() {
  return useSyncExternalStore(
    subscribe,
    () => outfit,
    () => DEFAULT_OUTFIT
  );
}

export function useMascotName() {
  return useSyncExternalStore(
    subscribe,
    () => name,
    () => 'Smudge'
  );
}
