import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { ChunkyButton } from '@/components/chunky-button';
import { Smudge } from '@/components/smudge';
import { Colors, Ink, nunito } from '@/constants/theme';
import { getHistory, getStreak, toDateKey, type DayStatus } from '@/data/history';

const ORANGE = '#FF9600';
const ORANGE_LIP = '#E07B00';
const ICE = '#7CC8F2';
const UNLIT = '#E3E0D9';
const BAR = '#FFC800';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A flame: rounded body with a flicker on the left, like Duolingo's streak flame. */
const FLAME_PATH =
  'M50 4 C64 26 90 46 90 76 C90 100 72 116 50 116 C28 116 10 100 10 76 C10 56 24 46 34 30 C38 44 44 50 50 52 C46 36 46 20 50 4 Z';

// --- Motion (rare, earned moments: these may bounce) ---
const pop = (from: number, peak: number, ms: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ scale: from }] },
    60: { opacity: 1, transform: [{ scale: peak }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
  })
    .duration(ms)
    .reduceMotion(ReduceMotion.System);

const flameIn = pop(0.3, 1.18, 560);
const mascotIn = pop(0.85, 1.06, 420);
const lightUp = new Keyframe({
  0: { transform: [{ scale: 1 }] },
  45: { transform: [{ scale: 1.45 }] },
  100: { transform: [{ scale: 1 }], easing: EASE_OUT },
})
  .duration(420)
  .reduceMotion(ReduceMotion.System);
const numberIn = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 36 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
})
  .duration(320)
  .reduceMotion(ReduceMotion.System);
const numberOut = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }] },
  100: { opacity: 0, transform: [{ translateY: -36 }] },
})
  .duration(240)
  .reduceMotion(ReduceMotion.System);

type Phase = 'complete' | 'streak';

/**
 * Right after you submit today's sketch, Duolingo-style, in two beats:
 * 1. Sketch complete: the mascot pops in with confetti while a bar fills.
 * 2. Streak: a big flame with your streak number; this week's seven little flames drop in,
 *    today's lights up, and the number rolls over to the new streak.
 */
export default function CompleteScreen() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('complete');
  const [lit, setLit] = useState(false);
  const [showContinue, setShowContinue] = useState(false);

  const { before, week, todayIndex } = useMemo(() => {
    const history = getHistory();
    const byDate = new Map(history.map((d) => [d.date, d.status]));
    const today = new Date();
    const days = WEEKDAYS.map((label, i) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + i);
      const status: DayStatus = byDate.get(toDateKey(date)) ?? (i < today.getDay() ? 'missed' : 'locked');
      return { label, status };
    });
    return { before: getStreak(history), week: days, todayIndex: today.getDay() };
  }, []);

  // Beat 1: the bar fills, then on to the streak.
  const progress = useSharedValue(0);
  useEffect(() => {
    const toStreak = () => setTimeout(() => setPhase('streak'), 350);
    progress.set(
      withDelay(
        300,
        withTiming(1, { duration: 1100, easing: EASE_OUT, reduceMotion: ReduceMotion.System }, (done) => {
          if (done) scheduleOnRN(toStreak);
        })
      )
    );
  }, [progress]);

  // Beat 2: today's flame lights up and the number rolls over.
  useEffect(() => {
    if (phase !== 'streak') return;
    const light = setTimeout(() => {
      setLit(true);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1100);
    const cont = setTimeout(() => setShowContinue(true), 1600);
    return () => {
      clearTimeout(light);
      clearTimeout(cont);
    };
  }, [phase]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));
  const streak = lit ? before + 1 : before;

  return (
    <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <Confetti />

      <View style={styles.stage}>
        {phase === 'complete' ? (
          <Animated.View key="complete" entering={FadeIn.duration(200)} style={styles.center}>
            {/* Plain wrapper reserves the space; the animated child can't collapse the layout. */}
            <View style={styles.mascotBox}>
              <Animated.View entering={mascotIn} style={StyleSheet.absoluteFill}>
                <Smudge size={200} mood="proud" animated />
              </Animated.View>
            </View>
            <View style={styles.barTrack}>
              <Animated.View style={[styles.barFill, barStyle]} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="streak" entering={FadeIn.duration(200)} style={styles.center}>
            {/* Big flame with the streak number */}
            <View style={styles.bigFlame}>
            <Animated.View entering={flameIn} style={StyleSheet.absoluteFill}>
              <Svg width={180} height={216} viewBox="0 0 100 120" style={StyleSheet.absoluteFill}>
                <Path d={FLAME_PATH} fill={ORANGE} />
              </Svg>
              <View style={styles.numberSlot}>
                <Animated.Text key={streak} entering={numberIn} exiting={numberOut} style={styles.number}>
                  {streak}
                </Animated.Text>
              </View>
            </Animated.View>
            </View>

            {/* This week's flames */}
            <View style={styles.week}>
              {week.map((d, i) => {
                const isToday = i === todayIndex;
                const status = isToday && lit ? 'done' : d.status;
                const fill = status === 'done' ? ORANGE : status === 'frozen' ? ICE : UNLIT;
                return (
                  <Animated.View
                    key={i}
                    entering={FadeInDown.delay(250 + i * 70).duration(260).reduceMotion(ReduceMotion.System)}
                    style={styles.smallBox}>
                    <Animated.View
                      key={isToday && lit ? 'lit' : 'unlit'}
                      entering={isToday && lit ? lightUp : undefined}
                      style={[StyleSheet.absoluteFill, styles.smallFlame]}>
                      <Svg width={36} height={43} viewBox="0 0 100 120" style={StyleSheet.absoluteFill}>
                        <Path d={FLAME_PATH} fill={fill} />
                      </Svg>
                      <Text style={[styles.dayLetter, { color: status === 'locked' || status === 'missed' ? '#A9A59C' : '#FFFFFF' }]}>
                        {d.label}
                      </Text>
                    </Animated.View>
                  </Animated.View>
                );
              })}
            </View>

            <Animated.Text entering={FadeIn.delay(500).duration(300)} style={styles.caption}>
              day streak!
            </Animated.Text>
          </Animated.View>
        )}
      </View>

      {showContinue && (
        <Animated.View entering={FadeInDown.duration(260).reduceMotion(ReduceMotion.System)}>
          <ChunkyButton label="CONTINUE" variant="orange" onPress={() => router.dismissTo('/')} />
        </Animated.View>
      )}
    </View>
  );
}

/** A few soft diamonds twinkling around, like Duolingo's celebration confetti. */
function Confetti() {
  const bits = [
    { top: '18%', left: '16%', size: 14, color: '#FFD4C2', delay: 0 },
    { top: '14%', left: '74%', size: 18, color: '#FFE08A', delay: 300 },
    { top: '34%', left: '8%', size: 10, color: '#BDE3F7', delay: 600 },
    { top: '38%', left: '84%', size: 12, color: '#FFD4C2', delay: 150 },
    { top: '26%', left: '60%', size: 8, color: '#BDE3F7', delay: 450 },
  ] as const;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bits.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: b.top,
            left: b.left,
            width: b.size,
            height: b.size,
            borderRadius: 3,
            backgroundColor: b.color,
            animationName: {
              '0%': { opacity: 0.4, transform: [{ translateY: 0 }, { rotate: '45deg' }, { scale: 0.8 }] },
              '50%': { opacity: 1, transform: [{ translateY: -10 }, { rotate: '60deg' }, { scale: 1.1 }] },
              '100%': { opacity: 0.4, transform: [{ translateY: 0 }, { rotate: '45deg' }, { scale: 0.8 }] },
            },
            animationDuration: '2400ms',
            animationDelay: `${b.delay}ms`,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 24,
  },
  stage: {
    flex: 1,
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 28,
  },
  barTrack: {
    width: '100%',
    height: 18,
    borderRadius: 9,
    backgroundColor: UNLIT,
    overflow: 'hidden',
  },
  barFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 9,
    backgroundColor: BAR,
    transformOrigin: 'left',
  },
  mascotBox: {
    width: 200,
    height: 224,
  },
  bigFlame: {
    width: 180,
    height: 216,
    alignItems: 'center',
  },
  numberSlot: {
    position: 'absolute',
    top: 78,
    left: 0,
    right: 0,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  number: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 84,
    lineHeight: 96,
    fontFamily: nunito(900),
  },
  week: {
    flexDirection: 'row',
    gap: 10,
  },
  smallBox: {
    width: 36,
    height: 43,
  },
  smallFlame: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 7,
  },
  dayLetter: {
    fontSize: 13,
    fontFamily: nunito(800),
  },
  caption: {
    color: Ink.ink,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: nunito(800),
  },
  buttonWrap: {
    height: 54,
  },
  buttonLip: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    height: 50,
    borderRadius: 16,
    backgroundColor: ORANGE_LIP,
  },
  button: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 50,
    borderRadius: 16,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: nunito(800),
    letterSpacing: 1,
  },
  pressed: {
    transform: [{ translateY: 3 }],
  },
});
