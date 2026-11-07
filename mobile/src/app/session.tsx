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
 * Sketch session, opened from "+ Snap my sketch": pick a time, sketch while Smudge
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

  const start = () => {
    nudged.current = { minute: false, up: false };
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

  let mood: SmudgeMood = 'happy';
  let line =
    total <= 30
      ? 'A quick one! Thirty seconds, just the big shapes.'
      : `Ready when you are. ${formatDuration(total)}, any paper and a pencil!`;
  if (phase === 'running' || phase === 'paused') {
    if (overtime) {
      mood = 'proud';
      line = 'Time’s up — but keep going if you’re in the zone!';
    } else if (remaining <= total * 0.25) {
      mood = 'hurry';
      line = 'Almost there! Don’t worry about the details.';
    } else {
      mood = 'focus';
      line = phase === 'paused' ? 'Taking a breather. I’ll wait.' : 'Ooh, I can hear the pencil…';
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
        <Smudge size={130} mood={mood} animated={phase !== 'done'} />
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
        {phase === 'setup' && <PrimaryButton label="Start sketching" onPress={start} />}

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
            <PrimaryButton label="📷  Scan my sketch" onPress={() => scanSketch('camera', elapsed)} />
            <SecondaryButton
              label="Choose from photos"
              onPress={() => scanSketch('library', elapsed)}
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

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <ChunkyButton label={label} onPress={onPress} />;
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <ChunkyButton label={label} onPress={onPress} variant="white" size="medium" />;
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
