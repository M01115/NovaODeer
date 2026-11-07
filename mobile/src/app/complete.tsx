import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Smudge } from '@/components/smudge';
import { Colors, Ink } from '@/constants/theme';
import { getHistory, getStreak, getWeekStats } from '@/data/history';
import { usePostedToday } from '@/data/today';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const FILL_MS = 1400;

// The flame bursts in once the bar is full (a rare, earned moment, so it may bounce).
const flameBurst = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.4 }, { rotate: '-12deg' }] },
  55: { opacity: 1, transform: [{ scale: 1.25 }, { rotate: '6deg' }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }], easing: EASE_OUT },
})
  .duration(520)
  .reduceMotion(ReduceMotion.System);

function formatTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

/**
 * Shown right after you submit today's sketch: today's progress bar fills up, and when
 * it's full the streak flame bursts in and the streak ticks up (Duolingo / Finch style).
 */
export default function CompleteScreen() {
  const insets = useSafeAreaInsets();
  const posted = usePostedToday();
  const { before, weekDone } = useMemo(() => {
    const history = getHistory();
    const todayKey = history.find((d) => d.status === 'today')?.date ?? history[history.length - 1].date;
    // Today counts now that it's posted.
    return { before: getStreak(history), weekDone: getWeekStats(todayKey, history).sketched + 1 };
  }, []);
  const [full, setFull] = useState(false);

  const progress = useSharedValue(0);

  useEffect(() => {
    const onFull = () => {
      setFull(true);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };
    progress.set(
      withDelay(
        350,
        withTiming(1, { duration: FILL_MS, easing: EASE_OUT, reduceMotion: ReduceMotion.System }, (done) => {
          if (done) scheduleOnRN(onFull);
        })
      )
    );
  }, [progress]);

  // Bar fill: scaleX from the left edge, so it never triggers layout.
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.get() }],
  }));

  const streak = full ? before + 1 : before;

  return (
    <View style={[styles.page, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.hero}>
        <Smudge size={150} mood={full ? 'proud' : 'focus'} animated />

        <View style={styles.flameRow}>
          {full ? (
            <Animated.Text entering={flameBurst} style={styles.flame}>
              🔥
            </Animated.Text>
          ) : (
            <Text style={[styles.flame, styles.flameDim]}>🔥</Text>
          )}
          <Animated.Text key={streak} entering={FadeIn.duration(250)} style={styles.number}>
            {streak}
          </Animated.Text>
        </View>
        <Text style={styles.caption}>{full ? 'day streak!' : 'Saving today’s sketch…'}</Text>

        {/* Today's progress */}
        <View style={styles.barTrack} accessibilityRole="progressbar">
          <Animated.View style={[styles.barFill, fillStyle]} />
        </View>
        <Text style={styles.barLabel}>{full ? 'Today’s sketch: done ✓' : 'Today’s sketch'}</Text>

        {full && (
          <Animated.View entering={FadeIn.duration(300).delay(150)} style={styles.stats}>
            <Stat label="Time" value={formatTime(posted?.seconds ?? 0)} />
            <Stat label="Medium" value="Paper" />
            <Stat label="This week" value={`${Math.min(7, weekDone)}/7`} />
          </Animated.View>
        )}
      </View>

      {full && (
        <Animated.View entering={FadeIn.duration(300).delay(250)} style={styles.actions}>
          <Text style={styles.cheer}>Smudge is doing a happy wiggle. See what your friends drew!</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.dismissTo('/')}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>SEE FRIENDS’ SKETCHES</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  flameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  flame: {
    fontSize: 64,
    lineHeight: 76,
  },
  flameDim: {
    opacity: 0.25,
  },
  number: {
    color: Ink.ink,
    fontSize: 88,
    lineHeight: 96,
    fontWeight: 900,
  },
  caption: {
    color: Ink.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 800,
  },
  barTrack: {
    width: '100%',
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.light.backgroundElement,
    overflow: 'hidden',
    marginTop: 16,
  },
  barFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 9,
    backgroundColor: Ink.ink,
    transformOrigin: 'left',
  },
  barLabel: {
    color: Colors.light.textSecondary,
    fontSize: 13,
    fontWeight: 700,
  },
  stats: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundElement,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: Ink.ink,
    fontSize: 18,
    fontWeight: 800,
  },
  statLabel: {
    color: Colors.light.textSecondary,
    fontSize: 12,
    fontWeight: 600,
  },
  actions: {
    gap: 14,
  },
  cheer: {
    color: Colors.light.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Ink.ink,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 1,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
});
