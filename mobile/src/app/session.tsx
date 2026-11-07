import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { CloseButton } from '@/components/close-button';
import { Screen } from '@/components/screen';
import { Smudge, type SmudgeMood } from '@/components/smudge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ink, nunito, Spacing } from '@/constants/theme';
import { DEFAULT_SECONDS, formatDuration, getPromptForDate } from '@/data/prompts';
import { PICK_ERRORS, pickSketch } from '@/data/submission';
import { ChunkyButton } from '@/components/chunky-button';
import { useTheme } from '@/hooks/use-theme';
import { playSound, type SoundId } from '@/lib/sounds';

type Phase = 'setup' | 'running' | 'paused' | 'done';

/**
 * Scan the paper (camera) or pick a photo, then open Smudge's feedback screen. Posting
 * (markPostedToday → streak completion → feed) happens there, after the AI feedback.
 */
async function scanSketch(source: 'camera' | 'library', seconds: number) {
  const picked = await pickSketch(source, Math.round(seconds));
  if (picked.ok) {
    router.push('/feedback');
    return;
  }
  const message = PICK_ERRORS[picked.reason];
  if (message) Alert.alert('Hmm', message);
}

function haptic(kind: 'warning' | 'success') {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(
    kind === 'warning'
      ? Haptics.NotificationFeedbackType.Warning
      : Haptics.NotificationFeedbackType.Success
  );
}

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Sketch session, opened from "+ Snap my sketch": pick a time, sketch while Puff
 * watches, keep going past the timer if you like, then scan the paper.
 */
export default function SessionScreen() {
  const theme = useTheme();
  const prompt = useMemo(() => getPromptForDate(), []);

  const [phase, setPhase] = useState<Phase>('setup');
  // Elapsed time is tracked from timestamps so it stays accurate if the app stalls.
  const [elapsedBefore, setElapsedBefore] = useState(0); // ms banked before the current run
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase]);

  const elapsed = (elapsedBefore + (runStartedAt ? now - runStartedAt : 0)) / 1000;
  // The time comes with the prompt (30s / 2 min / 5 min by difficulty); users don't choose.
  const total = prompt.seconds ?? DEFAULT_SECONDS;
  const remaining = total - elapsed;
  const overtime = elapsed > total;

  // One nudge with a minute left, one when time is up. Never more.
  const nudged = useRef({ minute: false, up: false });
  useEffect(() => {
    if (phase !== 'running') return;
    if (!nudged.current.minute && total > 60 && remaining <= 60) {
      nudged.current.minute = true;
      haptic('warning');
    }
    if (!nudged.current.up && remaining <= 0) {
      nudged.current.up = true;
      haptic('success');
    }
  }, [phase, remaining, total]);

  // Sound cues (Morris's sound kit): sonar ping at 1:00, double ping at 0:30, water-drop
  // ticks for the last 10 seconds, a friendly bell at 0:00. In overtime Puff creaks every
  // 6 s (faster as he swells), inflates into the pop at +1:00, then pulls himself together.
  const cue = useRef<{ second: number | null }>({ second: null });
  useEffect(() => {
    if (phase !== 'running') return;
    const left = Math.ceil(remaining);
    if (cue.current.second === left) return;
    const prev = cue.current.second;
    cue.current.second = left;
    if (prev === null) return; // no cue on the first tick
    const over = -left;
    if (left === 60 && total > 60) playSound('one-minute');
    else if (left === 30 && total > 30) playSound('thirty-sec');
    else if (left <= 10 && left >= 4) playSound('tick');
    else if (left <= 3 && left >= 1) playSound('tick-high');
    else if (left === 0) playSound('time-up');
    else if (over > 0 && over < 57 && over % 6 === 0) playSound('overtime-creak', { rate: 1 + 0.6 * (over / 60) });
    else if (over === 57) playSound('inflate');
    else if (over === 60) playSound('pop');
    else if (over === 63) playSound('reform');
  }, [phase, remaining, total]);

  const start = () => {
    nudged.current = { minute: false, up: false };
    cue.current.second = null;
    setElapsedBefore(0);
    setRunStartedAt(Date.now());
    setNow(Date.now());
    setPhase('running');
  };
  const pause = () => {
    setElapsedBefore((b) => b + (runStartedAt ? Date.now() - runStartedAt : 0));
    setRunStartedAt(null);
    setPhase('paused');
  };
  const resume = () => {
    setRunStartedAt(Date.now());
    setNow(Date.now());
    setPhase('running');
  };
  const finish = () => {
    setElapsedBefore((b) => b + (runStartedAt ? Date.now() - runStartedAt : 0));
    setRunStartedAt(null);
    setPhase('done');
  };

  // Puff's mood follows the clock (Morris's countdown draft): calm, then looking closely
  // at a minute left, nervous at 30s, flapping in the last 10s. In overtime he slowly
  // puffs up (and gets playfully huffy at +0:30); after a minute he pops, pulls himself back
  // together and waits.
  let mood: SmudgeMood = 'neutral';
  let inflate = 0;
  let line =
    total <= 30
      ? 'A quick one! Thirty seconds, just the big shapes.'
      : `Ready when you are. ${formatDuration(total)}, any paper and a pencil!`;
  if (phase === 'paused') {
    mood = 'sleepy';
    line = 'Taking a breather. I’ll wait.';
  } else if (phase === 'running') {
    const over = elapsed - total;
    if (overtime && over < 30) {
      mood = 'overtime';
      inflate = over / 60;
      line = 'Time’s up — but keep going if you’re in the zone!';
    } else if (overtime && over < 45) {
      // Playful fake outrage: puffed up, red-faced, steaming. Never a real scolding.
      mood = 'angry';
      line = 'Hmph! I’m puffing up over here… (take your time!)';
    } else if (overtime && over < 60) {
      mood = 'overtime';
      inflate = over / 60;
      line = 'Still going? I’m so excited I might pop!';
    } else if (overtime && over < 63.8) {
      mood = 'explode';
      line = 'Whoops, I got too excited!';
    } else if (overtime && over < 72) {
      mood = 'awkward';
      line = 'Okay, okay. Snap it when you’re ready.';
    } else if (overtime) {
      line = 'Snap it whenever you’re ready.';
    } else if (remaining > 60) {
      line = 'Ooh, I can hear the pencil…';
    } else if (remaining > 30) {
      mood = 'squint';
      line = total > 60 ? 'One minute left!' : 'Ooh, I can hear the pencil…';
    } else if (remaining > 10) {
      mood = total > 30 ? 'nervous' : 'squint';
      line = total > 30 ? '30 seconds — big shapes first!' : 'Ooh, I can hear the pencil…';
    } else {
      mood = 'flapping';
      line = 'Almost there! Don’t worry about the details.';
    }
  }
  if (phase === 'done') {
    mood = 'proud';
    line = `You sketched for ${formatClock(elapsed)}. Let’s see it!`;
  }

  const progress = Math.min(1, elapsed / total);

  return (
    <Screen contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="small" themeColor="textSecondary">
            Today’s prompt
          </ThemedText>
          <ThemedText type="smallBold" style={styles.prompt}>
            {prompt.text}
          </ThemedText>
        </View>
        <CloseButton />
      </View>

      <View style={styles.mascotArea}>
        <Smudge size={130} mood={mood} inflate={inflate} animated />
        <ThemedView type="backgroundElement" style={styles.bubble}>
          <ThemedText type="small" style={styles.center}>
            {line}
          </ThemedText>
        </ThemedView>
      </View>

      {/* Timer */}
      <View style={styles.timerBlock}>
        <Text
          style={[styles.clock, { color: overtime && phase !== 'done' ? Ink.red : theme.text }]}
          accessibilityLabel={
            overtime ? `${formatClock(elapsed - total)} extra` : `${formatClock(remaining)} left`
          }>
          {phase === 'setup'
            ? formatClock(total)
            : phase === 'done'
              ? formatClock(elapsed)
              : overtime
              ? `+${formatClock(elapsed - total)}`
              : formatClock(remaining)}
        </Text>
        <ThemedText type="small" themeColor="textSecondary">
          {phase === 'setup'
            ? `today’s time · ${total <= 30 ? 'quick sketch' : total <= 120 ? 'short sketch' : 'longer sketch'}`
            : phase === 'done'
              ? 'sketched — nice work'
              : overtime
              ? 'extra time — still counting'
              : phase === 'paused'
                ? 'paused'
                : 'left'}
        </ThemedText>

        {phase !== 'setup' && (
          <ThemedView type="backgroundElement" style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${progress * 100}%`, backgroundColor: overtime ? Ink.red : theme.text },
              ]}
            />
          </ThemedView>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {phase === 'setup' && (
          <>
            <PrimaryButton label="Start sketching" onPress={start} sound="session-start" />
            <SecondaryButton label="✏️  Draw on my phone" onPress={() => router.replace('/draw')} />
          </>
        )}

        {(phase === 'running' || phase === 'paused') && (
          <>
            <PrimaryButton label="I’m done" onPress={finish} />
            <SecondaryButton
              label={phase === 'running' ? 'Pause' : 'Resume'}
              onPress={phase === 'running' ? pause : resume}
            />
          </>
        )}

        {phase === 'done' && (
          <>
            <PrimaryButton label="📷  Scan my sketch" onPress={() => scanSketch('camera', elapsed)} sound="snap" />
            <SecondaryButton
              label="Choose from photos"
              onPress={() => scanSketch('library', elapsed)}
              sound="snap"
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              hitSlop={8}
              style={styles.later}>
              <ThemedText type="small" themeColor="textSecondary">
                Not now
              </ThemedText>
            </Pressable>
          </>
        )}
      </View>
    </Screen>
  );
}

type ButtonProps = { label: string; onPress: () => void; sound?: SoundId };

function PrimaryButton({ label, onPress, sound }: ButtonProps) {
  return <ChunkyButton label={label} onPress={onPress} sound={sound} />;
}

function SecondaryButton({ label, onPress, sound }: ButtonProps) {
  return <ChunkyButton label={label} onPress={onPress} variant="white" size="medium" sound={sound} />;
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
  },
  prompt: {
    fontFamily: nunito(400),
    fontSize: 20,
    lineHeight: 26,
  },
  mascotArea: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  bubble: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
    maxWidth: 290,
  },
  center: {
    textAlign: 'center',
  },
  timerBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  clock: {
    fontSize: 72,
    lineHeight: 80,
    fontFamily: nunito(800),
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
  },
  track: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: Spacing.three,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  actions: {
    gap: Spacing.three,
  },
  primary: {
    paddingVertical: Spacing.three + Spacing.one,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 18,
    fontFamily: nunito(700),
  },
  secondary: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
  later: {
    alignSelf: 'center',
  },
  pressedScale: {
    transform: [{ scale: 0.97 }],
  },
});
