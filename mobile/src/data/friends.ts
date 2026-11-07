/**
 * Placeholder friends and their sketches until accounts and friends come from the backend.
 * Everyone draws the same prompt each day, so friends' sketches are grouped by prompt id
 * (Prompt.id) and a day only ever shows friends' drawings of that day's prompt.
 *
 * The drawings are AI-generated stand-ins for fictional drawing hands (not real people's
 * submissions), from Documents/Codex/2026-11-07/gene/outputs: three-artist-sets (Sam, Jun,
 * Riley) and twelve-friends-5min (Maya, Theo, Nia, Owen, Luca).
 */
export type Friend = {
  id: 'sam' | 'jun' | 'riley' | 'maya' | 'theo' | 'nia' | 'owen' | 'luca';
  name: string;
  initial: string;
  /** Avatar colour. */
  color: string;
  /** What they like to draw with. */
  medium: string;
};

export const FRIENDS: Record<Friend['id'], Friend> = {
  sam: { id: 'sam', name: 'Sam', initial: 'S', color: '#A4BCD4', medium: 'graphite pencil' },
  jun: { id: 'jun', name: 'Jun', initial: 'J', color: '#E2C98A', medium: 'blue ballpoint' },
  riley: { id: 'riley', name: 'Riley', initial: 'R', color: '#D9A6A0', medium: 'colored pencils' },
  maya: { id: 'maya', name: 'Maya', initial: 'M', color: '#C9C2E8', medium: 'black fineliner' },
  theo: { id: 'theo', name: 'Theo', initial: 'T', color: '#BFC5C9', medium: 'soft 6B graphite' },
  nia: { id: 'nia', name: 'Nia', initial: 'N', color: '#E3B8E6', medium: 'violet colored pencil' },
  owen: { id: 'owen', name: 'Owen', initial: 'O', color: '#B7D1B0', medium: 'green fountain pen' },
  luca: { id: 'luca', name: 'Luca', initial: 'L', color: '#EBC1A4', medium: 'sanguine chalk' },
};

export type FriendSketch = {
  friend: Friend;
  image: number;
  /** Minutes they spent. */
  minutes: number;
  /** Reaction counts, in REACTIONS order (data/reactions.ts). */
  counts: number[];
};

const sketch = (id: Friend['id'], image: number, minutes: number, counts: number[]): FriendSketch => ({
  friend: FRIENDS[id],
  image,
  minutes,
  counts,
});

/** Friends' sketches by prompt id. */
export const FRIEND_SKETCHES: Record<string, FriendSketch[]> = {
  // Riley's Brad Pitt stands in for yours today (MY_SAMPLE_SKETCHES), so it isn't listed twice.
  'brad-pitt': [
    sketch('sam', require('@/assets/friends/brad-pitt-5min-sam.jpg'), 5, [5, 2, 3, 1, 1, 1]),
    sketch('jun', require('@/assets/friends/brad-pitt-5min-jun.jpg'), 5, [9, 6, 4, 3, 2, 2]),
    sketch('maya', require('@/assets/friends/brad-pitt-5min-maya.jpg'), 5, [6, 2, 3, 2, 3, 1]),
    sketch('theo', require('@/assets/friends/brad-pitt-5min-theo.jpg'), 5, [8, 5, 2, 1, 1, 3]),
    sketch('nia', require('@/assets/friends/brad-pitt-5min-nia.jpg'), 5, [7, 1, 4, 5, 2, 2]),
    sketch('owen', require('@/assets/friends/brad-pitt-5min-owen.jpg'), 5, [10, 4, 5, 3, 2, 1]),
    sketch('luca', require('@/assets/friends/brad-pitt-5min-luca.jpg'), 5, [5, 3, 2, 2, 4, 2]),
  ],
  'open-laptop': [
    sketch('sam', require('@/assets/friends/open-laptop-2min-sam.jpg'), 2, [3, 1, 2, 0, 1, 0]),
    sketch('jun', require('@/assets/friends/open-laptop-2min-jun.jpg'), 2, [6, 4, 2, 1, 1, 1]),
    sketch('riley', require('@/assets/friends/open-laptop-2min-riley.jpg'), 2, [4, 2, 1, 2, 2, 3]),
  ],
  radio: [
    sketch('sam', require('@/assets/friends/radio-30s-sam.jpg'), 0.5, [4, 1, 3, 0, 1, 0]),
    sketch('jun', require('@/assets/friends/radio-30s-jun.jpg'), 0.5, [5, 3, 2, 1, 2, 1]),
    sketch('riley', require('@/assets/friends/radio-30s-riley.jpg'), 0.5, [6, 2, 1, 3, 2, 2]),
  ],
};

/** Friends' sketches for a prompt (empty if none yet). */
export function getFriendSketches(promptId?: string): FriendSketch[] {
  return (promptId && FRIEND_SKETCHES[promptId]) || [];
}

/**
 * Stand-in for your own sketch of a prompt, until scanning saves a real photo: shown in the
 * feed when the posted sketch has no image (the scan buttons are still stubs).
 */
export const MY_SAMPLE_SKETCHES: Record<string, number> = {
  'brad-pitt': require('@/assets/friends/brad-pitt-5min-riley.jpg'),
};
