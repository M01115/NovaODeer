/**
 * Daily prompts. Everyone gets the same prompt on the same day.
 * Placeholder list until prompts come from the backend.
 */
export type Prompt = {
  text: string;
  /** Stand-in picture used until a real sketch image exists. */
  emoji: string;
  /** Longer drawing brief, when there is one. */
  brief?: string;
};

export const PROMPTS: readonly Prompt[] = [
  { text: 'A coffee mug', emoji: '☕' },
  { text: 'Your left hand', emoji: '✋' },
  { text: 'A tree in the wind', emoji: '🌳' },
  { text: 'Your favorite shoe', emoji: '👟' },
  { text: 'A cat napping', emoji: '🐈' },
  { text: 'The view from your window', emoji: '🪟' },
  { text: 'A houseplant', emoji: '🪴' },
  { text: 'Something on your desk', emoji: '🖇️' },
  { text: 'A cloud that looks like an animal', emoji: '☁️' },
  { text: 'Your breakfast', emoji: '🥐' },
  { text: 'A pair of glasses', emoji: '👓' },
  { text: 'A bicycle', emoji: '🚲' },
  { text: 'A rainy street', emoji: '🌧️' },
  { text: 'Your keys', emoji: '🔑' },
];

/** Days since 1970-01-01 in the user's local time zone. */
function localDayNumber(date: Date): number {
  const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round(localMidnight.getTime() / 86_400_000 - localMidnight.getTimezoneOffset() / 1440);
}

export function getPromptForDate(date: Date = new Date()): Prompt {
  return PROMPTS[localDayNumber(date) % PROMPTS.length];
}
