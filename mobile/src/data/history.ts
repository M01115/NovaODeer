import { getPromptForDate, type Prompt } from '@/data/prompts';
import { SAMPLE_SKETCHES } from '@/data/sketches';

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
  /** The sketch image (sample sketches for now; uploads later). Falls back to the prompt emoji. */
  image?: number;
  /** Smudge's feedback on the sketch. */
  feedback?: string;
  /** Minutes spent sketching (from the timer). */
  minutes?: number;
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

// Oldest first. Index 0 is 24 days ago, so the archive's S path has a few turns.
// Each 'done' day gets the next sample sketch (and its prompt) in order.
const MOCK_PAST: {
  status: Exclude<DayStatus, 'today' | 'locked'>;
  feedback?: string;
  minutes?: number;
}[] = [
  { status: 'done', feedback: 'Day one! Smudge is so proud you showed up.' },
  { status: 'done', feedback: 'Nice round ellipse. Those are tricky!' },
  { status: 'done', feedback: 'Clean and simple. That is exactly the point.' },
  { status: 'done', minutes: 3, feedback: 'A brave first sketch! Every streak starts exactly like this.' },
  { status: 'done', minutes: 4, feedback: 'Nice simple shapes. That is how the pros start too.' },
  { status: 'missed' },
  { status: 'done', minutes: 5, feedback: 'Look at that confident outline. Love it.' },
  { status: 'done', minutes: 2, feedback: 'Quick and expressive. Speed sketches suit you!' },
  { status: 'done', minutes: 6, feedback: 'The proportions here are spot on. Smudge approves.' },
  { status: 'done', minutes: 4, feedback: 'Great use of light and shadow on this one.' },
  { status: 'missed' },
  { status: 'done', minutes: 5, feedback: 'You found a fun angle. Very playful.' },
  { status: 'done', minutes: 7, feedback: 'So much texture! You really took your time.' },
  { status: 'done', minutes: 4, feedback: 'Clean lines and a calm composition. Lovely.' },
  { status: 'done', minutes: 4, feedback: 'Love how loose and confident these lines are. Great start!' },
  { status: 'done', minutes: 6, feedback: 'That shading on the left side gives it real weight. Nice!' },
  { status: 'missed' },
  { status: 'done', minutes: 5, feedback: 'Bold composition! Try a lighter first pass next time — it’ll pop.' },
  { status: 'done', minutes: 3, feedback: 'You nailed the proportions. Smudge is impressed.' },
  { status: 'frozen' },
  { status: 'done', minutes: 7, feedback: 'Such a fun angle! Most people draw this straight on.' },
  { status: 'done', minutes: 5, feedback: 'Your lines are getting steadier every day. Keep going!' },
  { status: 'done', minutes: 9, feedback: 'The little details here make it feel alive. Lovely.' },
  { status: 'done', minutes: 6, feedback: 'Wow, look at that texture. Your best one yet!' },
];

const LOCKED_DAYS = 3;

/** Past days, today, then a few locked future days, oldest first. */
export function getHistory(today: Date = new Date()): Day[] {
  let sketchIndex = 0;
  const past: Day[] = MOCK_PAST.map((entry, i) => {
    const date = addDays(today, i - MOCK_PAST.length);
    const day: Day = { date: toDateKey(date), prompt: getPromptForDate(date), ...entry };
    const sample = entry.status === 'done' ? SAMPLE_SKETCHES[sketchIndex++] : undefined;
    if (sample) {
      day.prompt = { id: sample.promptId, text: sample.title, emoji: sample.emoji, brief: sample.brief };
      day.image = sample.image;
      day.minutes = sample.minutes;
    }
    return day;
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

export type WeekStats = {
  /** First and last day of the 7-day window, as YYYY-MM-DD. */
  from: string;
  to: string;
  sketched: number;
  minutes: number;
  freezes: number;
};

/** Stats for the 7 days ending on `dateKey` (inclusive). */
export function getWeekStats(dateKey: string, history: Day[] = getHistory()): WeekStats {
  const end = fromDateKey(dateKey);
  const from = toDateKey(addDays(end, -6));
  const week = history.filter((d) => d.date >= from && d.date <= dateKey);
  return {
    from,
    to: dateKey,
    sketched: week.filter((d) => d.status === 'done').length,
    minutes: week.reduce((sum, d) => sum + (d.status === 'done' ? (d.minutes ?? 0) : 0), 0),
    freezes: week.filter((d) => d.status === 'frozen').length,
  };
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
