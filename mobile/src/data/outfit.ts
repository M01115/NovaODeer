import { useSyncExternalStore } from 'react';

/**
 * The mascot's look: which of his accessories he's wearing. Shown everywhere he appears.
 * The accessories are layers from the team's mascot PSD (assets/mascot). To add more, draw
 * them as new layers in the same PSD, export, and add them here and in components/smudge.tsx.
 * In-memory for now (resets when the app restarts); save it to the backend later.
 */
export type Hat = 'none' | 'beret';
export type Eyewear = 'none' | 'glasses';
export type Hold = 'none' | 'brush';

export type Outfit = {
  hat: Hat;
  eyes: Eyewear;
  hold: Hold;
};

export type Slot = keyof Outfit;

/** As drawn: striped beret, glasses and his paintbrush. */
export const DEFAULT_OUTFIT: Outfit = { hat: 'beret', eyes: 'glasses', hold: 'brush' };

type Item<V extends string> = {
  id: V;
  label: string;
  /** Streak (days) needed to unlock; 0 = free. */
  unlockStreak: number;
};

/** The wardrobe, by slot. Items with an unlockStreak are earned by keeping a streak. */
export const WARDROBE: { [S in Slot]: { title: string; items: Item<Outfit[S]>[] } } = {
  hat: {
    title: 'Hat',
    items: [
      { id: 'beret', label: 'Striped beret', unlockStreak: 0 },
      { id: 'none', label: 'None', unlockStreak: 0 },
    ],
  },
  eyes: {
    title: 'Glasses',
    items: [
      { id: 'glasses', label: 'Glasses', unlockStreak: 0 },
      { id: 'none', label: 'None', unlockStreak: 0 },
    ],
  },
  hold: {
    title: 'Brush',
    items: [
      { id: 'brush', label: 'Paintbrush', unlockStreak: 0 },
      { id: 'none', label: 'None', unlockStreak: 0 },
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
