import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

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
  tap: require('@/assets/sounds/tap.wav'), // main buttons
  tab: require('@/assets/sounds/tab.wav'), // small toggles and chips
  back: require('@/assets/sounds/back.wav'), // close / dismiss
  // App open
  'app-open': require('@/assets/sounds/app-open.wav'),
  // Sketch countdown
  'session-start': require('@/assets/sounds/session-start.wav'),
  'one-minute': require('@/assets/sounds/one-minute.wav'),
  'thirty-sec': require('@/assets/sounds/thirty-sec.wav'),
  tick: require('@/assets/sounds/tick.wav'),
  'tick-high': require('@/assets/sounds/tick-high.wav'),
  'time-up': require('@/assets/sounds/time-up.wav'),
  'overtime-creak': require('@/assets/sounds/overtime-creak.wav'),
  inflate: require('@/assets/sounds/inflate.wav'),
  pop: require('@/assets/sounds/pop.wav'),
  reform: require('@/assets/sounds/reform.wav'),
  snap: require('@/assets/sounds/snap.wav'),
  // Puff's feedback
  scan: require('@/assets/sounds/scan.wav'),
  'thinking-loop': require('@/assets/sounds/thinking-loop.wav'),
  aha: require('@/assets/sounds/aha.wav'),
  'type-blip': require('@/assets/sounds/type-blip.wav'),
  notice: require('@/assets/sounds/notice.wav'),
  // Posting and streaks
  post: require('@/assets/sounds/post.wav'),
  streak: require('@/assets/sounds/streak.wav'),
  milestone: require('@/assets/sounds/milestone.wav'),
  'unlock-feed': require('@/assets/sounds/unlock-feed.wav'),
  reaction: require('@/assets/sounds/reaction.wav'),
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

/** Plays a sound from the start. Never throws: sound is a nice-to-have. */
export function playSound(id: SoundId, { rate = 1, volume = 1 }: { rate?: number; volume?: number } = {}) {
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
