import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChunkyButton } from '@/components/chunky-button';
import { Smudge } from '@/components/smudge';
import { StreakShrimp } from '@/components/streak-shrimp';
import { Colors, Ink, nunito, Palette } from '@/constants/theme';
import { requestArchiveOpen } from '@/data/archive-events';
import { getHistory, getStreak, toDateKey, type DayStatus } from '@/data/history';

// Paper and ink, with the one red spot colour for today.
const C = {
  background: Colors.light.background,
  ink: Ink.ink,
  buttonLip: '#000000',
  buttonText: '#FFFFFF',
  card: Palette.blue,
  labelMuted: 'rgba(255, 255, 255, 0.85)',
  today: Palette.yellow,
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Shown once when the app opens: the current streak and this week at a glance.
 * Layout follows Duolingo's streak screen proportions for now. The flex spacers below are
 * the gaps between elements on an 852pt-tall iPhone screen, so the screen scales evenly.
 */
export default function StreakScreen() {
  const insets = useSafeAreaInsets();
  const history = useMemo(() => getHistory(), []);
  const streak = getStreak(history);

  // This week, Sunday to Saturday.
  const week = useMemo(() => {
    const today = new Date();
    const byDate = new Map(history.map((d) => [d.date, d.status]));
    return WEEKDAYS.map((label, i) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + i);
      const status: DayStatus =
        byDate.get(toDateKey(date)) ?? (i < today.getDay() ? 'missed' : 'locked');
      return { label, status };
    });
  }, [history]);

  // Home is today's prompt, so starting the sketch just closes this screen.
  const startSketch = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // The archive lives above Home: close this screen, then Home slides it open.
  const seePast = () => {
    requestArchiveOpen(); // queued; Home opens it as soon as it's back in focus
    startSketch();
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={{ flex: 102 }} />

      <View style={styles.mascot}>
        {/* Proud of the streak; gently sad (never guilt) when it's back to zero. */}
        <Smudge size={154} mood={streak === 0 ? 'sad' : 'proud'} animated />
      </View>

      <View style={{ flex: 7 }} />

      <Text style={styles.number}>{streak}</Text>
      <Text style={styles.caption}>{streak === 0 ? 'start your streak!' : 'day streak!'}</Text>

      <View style={{ flex: 33 }} />

      <View style={styles.card}>
        {week.map(({ label, status }) => (
          <View key={label} style={styles.dayCol}>
            <Text style={[styles.dayLabel, status === 'today' && styles.dayLabelToday]}>
              {label}
            </Text>
            <StreakShrimp status={status} size={40} />
          </View>
        ))}
      </View>

      <View style={{ flex: 87 }} />

      <ChunkyButton label="Start today’s sketch" icon="✏️" onPress={startSketch} />

      <View style={{ flex: 20 }} />

      <Pressable accessibilityRole="button" onPress={seePast} hitSlop={12}>
        {({ pressed }) => (
          <Text style={[styles.continue, pressed && styles.pressed]}>SEE PAST SKETCHES</Text>
        )}
      </Pressable>

      <View style={{ flex: 22 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: C.background,
    paddingHorizontal: 16,
    alignItems: 'stretch',
  },
  mascot: {
    alignSelf: 'center',
  },
  number: {
    color: C.ink,
    fontSize: 116,
    lineHeight: 120,
    fontFamily: nunito(900),
    textAlign: 'center',
  },
  caption: {
    color: C.ink,
    fontSize: 27,
    lineHeight: 34,
    fontFamily: nunito(800),
    textAlign: 'center',
  },
  card: {
    height: 93,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 18,
    paddingHorizontal: 12,
  },
  dayCol: {
    alignItems: 'center',
    gap: 10,
  },
  dayLabel: {
    color: C.labelMuted,
    fontSize: 15,
    lineHeight: 18,
    fontFamily: nunito(700),
  },
  dayLabelToday: {
    color: C.today,
  },
  buttonWrap: {
    height: 47,
  },
  buttonLip: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    height: 43,
    borderRadius: 14,
    backgroundColor: C.buttonLip,
  },
  button: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 43,
    borderRadius: 14,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: C.buttonText,
    fontSize: 15,
    fontFamily: nunito(800),
    letterSpacing: 1,
  },
  continue: {
    color: C.ink,
    fontSize: 16,
    lineHeight: 30,
    fontFamily: nunito(800),
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
