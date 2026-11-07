import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

/**
 * Puff's sound kit (Morris's morris/puff-sounds branch: synthesized sea sounds in D major
 * pentatonic; rising pitch = good, nothing ever sounds like a buzzer). Only the sounds the
 * app has a moment for are bundled. Players are created on first use and reused.
 *
 *   playSound('tap')                      one-shot, restarts if already playing
 *   playSound('overtime-creak', { rate }) faster = more urgent
 *   startLoop('thinking-loop') / stopSound('thinking-loop')
 */
const SOURCES = {
  // Taps and UI
  tap: require('@/assets/sounds/tap.m4a'), // main buttons
  tab: require('@/assets/sounds/tab.m4a'), // small toggles and chips
  back: require('@/assets/sounds/back.m4a'), // close / dismiss
  // App open
  'app-open': require('@/assets/sounds/app-open.m4a'),
  // Sketch countdown
  'session-start': require('@/assets/sounds/session-start.m4a'),
  'one-minute': require('@/assets/sounds/one-minute.m4a'),
  'thirty-sec': require('@/assets/sounds/thirty-sec.m4a'),
  tick: require('@/assets/sounds/tick.m4a'),
  'tick-high': require('@/assets/sounds/tick-high.m4a'),
  'time-up': require('@/assets/sounds/time-up.m4a'),
  'overtime-creak': require('@/assets/sounds/overtime-creak.m4a'),
  inflate: require('@/assets/sounds/inflate.m4a'),
  pop: require('@/assets/sounds/pop.m4a'),
  reform: require('@/assets/sounds/reform.m4a'),
  snap: require('@/assets/sounds/snap.m4a'),
  // Puff's feedback
  scan: require('@/assets/sounds/scan.m4a'),
  'thinking-loop': require('@/assets/sounds/thinking-loop.wav'),
  aha: require('@/assets/sounds/aha.m4a'),
  'type-blip': require('@/assets/sounds/type-blip.m4a'),
  notice: require('@/assets/sounds/notice.m4a'),
  // Posting and streaks
  post: require('@/assets/sounds/post.m4a'),
  streak: require('@/assets/sounds/streak.m4a'),
  milestone: require('@/assets/sounds/milestone.m4a'),
  'unlock-feed': require('@/assets/sounds/unlock-feed.m4a'),
  reaction: require('@/assets/sounds/reaction.m4a'),
} as const;

export type SoundId = keyof typeof SOURCES;

const players = new Map<SoundId, AudioPlayer>();
let modeSet = false;

function player(id: SoundId) {
  if (!modeSet) {
    modeSet = true;
    // Mix with whatever music is playing; UI sounds never stop other apps.
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  }
  let p = players.get(id);
  if (!p) {
    p = createAudioPlayer(SOURCES[id]);
    players.set(id, p);
  }
  return p;
}

/*
 * Browsers (Chrome, and phone browsers even more so) block audio until the first tap.
 * - A sound asked for before that tap (the launch chime) waits, and plays on a tap that
 *   comes within a few seconds instead of being silently dropped.
 * - On that first tap every sound is started silently and stopped at once. Phone browsers
 *   (iPhone Safari) only let a sound play later from a timer (countdown ticks, time up,
 *   Puff's "aha", the streak) if it already played once during a tap.
 * The native app (Expo Go / a build) has no such limit.
 */
const IS_WEB = Platform.OS === 'web';
const PENDING_MS = 12000;
let unlocked = !IS_WEB;
let pending: { id: SoundId; at: number } | null = null;

function canPlayNow() {
  if (unlocked) return true;
  const activation = (globalThis.navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    ?.userActivation;
  if (activation?.hasBeenActive) unlocked = true;
  return unlocked;
}

/** Runs once, on the first tap or key press. */
function unlockAll() {
  unlocked = true;
  (Object.keys(SOURCES) as SoundId[]).forEach((id) => {
    try {
      const p = player(id);
      if (p.playing) return;
      // Silent and left to finish (they're short): stopping it early would cancel the play()
      // the browser needs to see complete inside this tap. playSound() sets the volume again.
      p.volume = 0;
      p.loop = false;
      p.play();
    } catch {}
  });
  const waiting = pending;
  pending = null;
  if (waiting && Date.now() - waiting.at < PENDING_MS) setTimeout(() => playSound(waiting.id), 60);
}

if (IS_WEB && typeof window !== 'undefined') {
  const onFirstGesture = () => {
    window.removeEventListener('pointerdown', onFirstGesture, true);
    window.removeEventListener('keydown', onFirstGesture, true);
    unlockAll();
  };
  window.addEventListener('pointerdown', onFirstGesture, true);
  window.addEventListener('keydown', onFirstGesture, true);
}

/** Plays a sound from the start. Never throws: sound is a nice-to-have. */
export function playSound(id: SoundId, { rate = 1, volume = 1 }: { rate?: number; volume?: number } = {}) {
  if (!canPlayNow()) {
    // Before the first tap in a browser: hold it (see above) rather than lose it.
    pending = { id, at: Date.now() };
    return;
  }
  try {
    const p = player(id);
    p.loop = false;
    p.volume = volume;
    p.playbackRate = rate;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // e.g. the browser blocks audio before the first tap
  }
}

/** Starts a looping sound (e.g. while waiting for the AI). */
export function startLoop(id: SoundId, volume = 1) {
  if (!canPlayNow()) return;
  try {
    const p = player(id);
    p.loop = true;
    p.volume = volume;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {}
}

export function stopSound(id: SoundId) {
  try {
    players.get(id)?.pause();
  } catch {}
}

/** Load the sounds used right away (first tap, app open) so they play without delay. */
export function preloadSounds(ids: SoundId[]) {
  ids.forEach((id) => {
    try {
      player(id);
    } catch {}
  });
}
