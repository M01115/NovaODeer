import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { CloseButton } from '@/components/close-button';
import { Screen } from '@/components/screen';
import { Smudge, type SmudgeMood } from '@/components/smudge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ink, Spacing } from '@/constants/theme';
import { getPromptForDate } from '@/data/prompts';
import { markPostedToday } from '@/data/today';
import { useTheme } from '@/hooks/use-theme';

const DURATIONS = [2, 5, 10]; // minutes
type Phase = 'setup' | 'running' | 'paused' | 'done';

/**
 * Stand-in for scanning/uploading (being built separately): counts as posting today's
 * sketch, which unlocks the friends feed. Replace with the real scan flow.
 */
function postSketch(via: string) {
  markPostedToday();
  Alert.alert('Posted!', `${via} isn't built yet, but today counts as posted. Your friends' sketches are unlocked in Feed.`);
  router.back();
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

  const [minutes, setMinutes] = useState(5);
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
  const total = minutes * 60;
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
  let line = 'Ready when you are. Grab any paper and a pencil!';
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
        {phase === 'setup' ? (
          <View style={styles.chips}>
            {DURATIONS.map((m) => (
              <Pressable
                key={m}
                accessibilityRole="radio"
                accessibilityState={{ selected: minutes === m }}
                onPress={() => setMinutes(m)}
                style={[
                  styles.chip,
                  minutes === m
                    ? { backgroundColor: theme.text }
                    : { backgroundColor: theme.backgroundElement },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    { color: minutes === m ? theme.background : theme.text },
                  ]}>
                  {m} min
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

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
            ? 'Pick your time'
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
            <PrimaryButton label="📷  Scan my sketch" onPress={() => postSketch('Scanning')} />
            <SecondaryButton label="Choose from photos" onPress={() => postSketch('Photo library')} />
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
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: theme.text },
        pressed && styles.pressedScale,
      ]}>
      <Text style={[styles.primaryText, { color: theme.background }]}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressedScale}>
      <ThemedView type="backgroundElement" style={styles.secondary}>
        <ThemedText type="smallBold">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
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
  chips: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 18,
  },
  chipText: {
    fontSize: 14,
    fontWeight: 700,
  },
  clock: {
    fontSize: 72,
    lineHeight: 80,
    fontWeight: 800,
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
    fontWeight: 700,
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
