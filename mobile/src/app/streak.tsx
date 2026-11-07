import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Smudge } from '@/components/smudge';
import { Colors, Ink } from '@/constants/theme';
import { getHistory, getStreak, toDateKey, type DayStatus } from '@/data/history';

// Paper and ink, with the one red spot colour for today.
const C = {
  background: Colors.light.background,
  ink: Ink.ink,
  buttonLip: '#000000',
  buttonText: '#FFFFFF',
  card: Ink.ink,
  cardMuted: '#33322F',
  labelMuted: '#8A877F',
  done: '#FFFFFF',
  ice: '#BFE3F5',
  check: Ink.ink,
  today: Ink.red,
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
  const seePast = () => router.replace('/archive');

  return (
    <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={{ flex: 102 }} />

      <View style={styles.mascot}>
        <Smudge size={154} />
        <Text style={styles.flame}>🔥</Text>
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
            <DayDot status={status} />
          </View>
        ))}
      </View>

      <View style={{ flex: 87 }} />

      <Pressable accessibilityRole="button" onPress={startSketch} style={styles.buttonWrap}>
        {({ pressed }) => (
          <>
            <View style={styles.buttonLip} />
            <View style={[styles.button, { top: pressed ? 4 : 0 }]}>
              <Text style={styles.buttonText}>✏️  START TODAY’S SKETCH</Text>
            </View>
          </>
        )}
      </Pressable>

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

function DayDot({ status }: { status: DayStatus }) {
  if (status === 'done' || status === 'frozen') {
    return (
      <View style={[styles.dot, { backgroundColor: status === 'done' ? C.done : C.ice }]}>
        <Text style={styles.check}>{status === 'frozen' ? '❄' : '✓'}</Text>
      </View>
    );
  }
  if (status === 'today') {
    return <View style={[styles.dot, styles.dotToday]} />;
  }
  return <View style={[styles.dot, { backgroundColor: C.cardMuted }]} />;
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
  flame: {
    position: 'absolute',
    right: -18,
    top: 4,
    fontSize: 46,
    transform: [{ rotate: '12deg' }],
  },
  number: {
    color: C.ink,
    fontSize: 116,
    lineHeight: 120,
    fontWeight: 900,
    textAlign: 'center',
  },
  caption: {
    color: C.ink,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: 800,
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
    fontWeight: 700,
  },
  dayLabelToday: {
    color: C.today,
  },
  dot: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotToday: {
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: C.today,
  },
  check: {
    color: C.check,
    fontSize: 14,
    fontWeight: 900,
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
    fontWeight: 800,
    letterSpacing: 1,
  },
  continue: {
    color: C.ink,
    fontSize: 16,
    lineHeight: 30,
    fontWeight: 800,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
