import { getPromptForDate, type Prompt } from '@/data/prompts';

/**
 * The user's day-by-day history, shown as the winding path on the home screen.
 * Mock data until sketches come from the backend.
 */
export type DayStatus =
  /** Sketch submitted. */
  | 'done'
  /** Missed, but a streak freeze kept the streak alive. */
  | 'frozen'
  /** Missed, no freeze. */
  | 'missed'
  /** Today, not submitted yet. */
  | 'today'
  /** Not unlocked yet. */
  | 'locked';

export type Day = {
  /** Local date as YYYY-MM-DD. */
  date: string;
  prompt: Prompt;
  status: DayStatus;
  /** Uploaded sketch, once the backend exists. Falls back to the prompt emoji. */
  imageUri?: string;
  /** Smudge's feedback on the sketch. */
  feedback?: string;
};

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// Oldest first. Index 0 is 10 days ago.
const MOCK_PAST: { status: Exclude<DayStatus, 'today' | 'locked'>; feedback?: string }[] = [
  { status: 'done', feedback: 'Love how loose and confident these lines are. Great start!' },
  { status: 'done', feedback: 'That shading on the left side gives it real weight. Nice!' },
  { status: 'missed' },
  { status: 'done', feedback: 'Bold composition! Try a lighter first pass next time — it’ll pop.' },
  { status: 'done', feedback: 'You nailed the proportions. Smudge is impressed.' },
  { status: 'frozen' },
  { status: 'done', feedback: 'Such a fun angle! Most people draw this straight on.' },
  { status: 'done', feedback: 'Your lines are getting steadier every day. Keep going!' },
  { status: 'done', feedback: 'The little details here make it feel alive. Lovely.' },
  { status: 'done', feedback: 'Wow, look at that texture. Your best one yet!' },
];

const LOCKED_DAYS = 3;

/** Past days, today, then a few locked future days, oldest first. */
export function getHistory(today: Date = new Date()): Day[] {
  const past: Day[] = MOCK_PAST.map((entry, i) => {
    const date = addDays(today, i - MOCK_PAST.length);
    return { date: toDateKey(date), prompt: getPromptForDate(date), ...entry };
  });

  const todayDay: Day = {
    date: toDateKey(today),
    prompt: getPromptForDate(today),
    status: 'today',
  };

  const future: Day[] = Array.from({ length: LOCKED_DAYS }, (_, i) => {
    const date = addDays(today, i + 1);
    return { date: toDateKey(date), prompt: getPromptForDate(date), status: 'locked' };
  });

  return [...past, todayDay, ...future];
}

export function getDay(dateKey: string): Day | undefined {
  return getHistory().find((d) => d.date === dateKey);
}

/** Consecutive days kept (done or frozen), counting back from yesterday. */
export function getStreak(history: Day[]): number {
  const todayIndex = history.findIndex((d) => d.status === 'today');
  let streak = 0;
  for (let i = todayIndex - 1; i >= 0; i--) {
    const status = history[i].status;
    if (status === 'done' || status === 'frozen') streak++;
    else break;
  }
  return streak;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 7". Fixed English format so web server and browser render the same text. */
export function formatShortDate(dateKey: string): string {
  const date = fromDateKey(dateKey);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}
