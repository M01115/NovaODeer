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
