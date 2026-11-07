/**
 * Daily prompts. Everyone gets the same prompt on the same day.
 * Placeholder list until prompts come from the backend.
 */
export const PROMPTS = [
  'A coffee mug',
  'Your left hand',
  'A tree in the wind',
  'Your favorite shoe',
  'A cat napping',
  'The view from your window',
  'A houseplant',
  'Something on your desk',
  'A cloud that looks like an animal',
  'Your breakfast',
  'A pair of glasses',
  'A bicycle',
  'A rainy street',
  'Your keys',
] as const;

/** Days since 1970-01-01 in the user's local time zone. */
function localDayNumber(date: Date): number {
  const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round(localMidnight.getTime() / 86_400_000 - localMidnight.getTimezoneOffset() / 1440);
}

export function getPromptForDate(date: Date = new Date()): string {
  return PROMPTS[localDayNumber(date) % PROMPTS.length];
}
