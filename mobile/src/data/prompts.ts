/**
 * Daily prompts. Everyone gets the same prompt on the same day.
 * Each prompt comes with its own time, set by how hard it is: 30 seconds, 2 minutes or
 * 5 minutes. Users don't choose. Placeholder list until prompts come from the backend.
 */
export type Prompt = {
  /** Stable id, links a prompt to friends' sketches of it (data/friends.ts). */
  id?: string;
  text: string;
  /** Stand-in picture used until a real sketch image exists. */
  emoji: string;
  /** Longer drawing brief, when there is one. */
  brief?: string;
  /** Sketching time for this prompt, by difficulty: 30, 120 or 300 seconds. */
  seconds?: number;
};

export const PROMPTS: readonly Prompt[] = [
  { text: 'A coffee mug', emoji: '☕', seconds: 30 },
  { text: 'Your left hand', emoji: '✋', seconds: 300 },
  { text: 'A tree in the wind', emoji: '🌳', seconds: 120 },
  { text: 'Your favorite shoe', emoji: '👟', seconds: 120 },
  { text: 'A cat napping', emoji: '🐈', seconds: 120 },
  { text: 'The view from your window', emoji: '🪟', seconds: 300 },
  { text: 'A houseplant', emoji: '🪴', seconds: 120 },
  { text: 'Something on your desk', emoji: '🖇️', seconds: 30 },
  { text: 'A cloud that looks like an animal', emoji: '☁️', seconds: 30 },
  { text: 'Your breakfast', emoji: '🥐', seconds: 120 },
  { text: 'A pair of glasses', emoji: '👓', seconds: 30 },
  { text: 'A bicycle', emoji: '🚲', seconds: 300 },
  { text: 'A rainy street', emoji: '🌧️', seconds: 300 },
  { text: 'Your keys', emoji: '🔑', seconds: 30 },
];

/** Default when a prompt has no time set. */
export const DEFAULT_SECONDS = 120;

/** Days since 1970-01-01 in the user's local time zone. */
function localDayNumber(date: Date): number {
  const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round(localMidnight.getTime() / 86_400_000 - localMidnight.getTimezoneOffset() / 1440);
}

/**
 * Today's prompt, pinned for the demo: the deer is "today" whichever day the app is
 * opened. Other days follow the rotation below.
 */
export const TODAY_PROMPT: Prompt = {
  id: 'deer',
  text: 'A deer',
  emoji: '🦌',
  brief: 'A quick 30-second deer: just the big shapes, antlers and legs.',
  seconds: 30,
};

export function getPromptForDate(date: Date = new Date()): Prompt {
  if (localDayNumber(date) === localDayNumber(new Date())) return TODAY_PROMPT;
  return PROMPTS[localDayNumber(date) % PROMPTS.length];
}

/** "30 sec", "2 min", "5 min". */
export function formatDuration(seconds: number) {
  return seconds < 60 ? `${seconds} sec` : `${Math.round(seconds / 60)} min`;
}

/** "Thirty seconds", "Two minutes", "Five minutes" (for Puff's lines). */
export function sayDuration(seconds: number) {
  if (seconds === 30) return 'Thirty seconds';
  if (seconds === 120) return 'Two minutes';
  if (seconds === 300) return 'Five minutes';
  return formatDuration(seconds);
}
