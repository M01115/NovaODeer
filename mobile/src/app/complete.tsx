import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { scheduleOnRN } from 'react-native-worklets';

import { ChunkyButton } from '@/components/chunky-button';
import { Smudge } from '@/components/smudge';
import { StreakFlame } from '@/components/streak-flame';
import { StreakShrimp } from '@/components/streak-shrimp';
import { Colors, Ink, nunito } from '@/constants/theme';
import { getHistory, getStreak, toDateKey, type DayStatus } from '@/data/history';
import { getSubmission, takeFeedbackPending } from '@/data/submission';
import { playSound } from '@/lib/sounds';

const ORANGE = '#FF9600';
const ORANGE_LIP = '#E07B00';
const UNLIT = '#E3E0D9';
const BAR = '#FFC800';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

  // Your sketch bubbles up to the surface as the screen opens.
  useEffect(() => {
    playSound('post');
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

  // Beat 2: today's gray shrimp cooks (spins, catches fire, turns red); when it turns
  // red the number rolls over (StreakShrimp buzzes the phone then).
  const [cooking, setCooking] = useState(false);
  useEffect(() => {
    if (phase !== 'streak') return;
    const cook = setTimeout(() => {
      setCooking(true);
      // The completion sound, synced to the cooking: a bigger one on milestone days.
      playSound([3, 7, 30, 100].includes(before + 1) ? 'milestone' : 'streak');
    }, 900);
    return () => clearTimeout(cook);
  }, [phase, before]);
  useEffect(() => {
    if (!lit) return;
    const cont = setTimeout(() => setShowContinue(true), 700);
    return () => clearTimeout(cont);
  }, [lit]);

  // Whether CONTINUE leads to Puff's feedback (a scanned or drawn sketch) or the feed.
  const [feedbackNext] = useState(() => !!getSubmission());
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
                {/* He puffs up as the bar fills. */}
                <Smudge size={200} mood="puffup" animated />
              </Animated.View>
            </View>
            {/* The bar fills toward today's live shrimp (Duolingo's chest). */}
            <View style={styles.barRow}>
              <View style={styles.barTrack}>
                <Animated.View style={[styles.barFill, barStyle]} />
              </View>
              <StreakShrimp status="today" size={44} />
            </View>
            <Animated.View entering={FadeInDown.delay(200).duration(260).reduceMotion(ReduceMotion.System)} style={styles.texts}>
              <Text style={styles.title}>
                Sketch Complete! <Text style={styles.titleAccent}>+1 day</Text>
              </Text>
              <Text style={styles.subtitle}>Your shrimp is about to get cooked…</Text>
            </Animated.View>
          </Animated.View>
        ) : (
          <Animated.View key="streak" entering={FadeIn.duration(200)} style={styles.center}>
            {/* Big flame with the streak number */}
            <View style={styles.bigFlame}>
            <Animated.View entering={flameIn} style={StyleSheet.absoluteFill}>
              <StreakFlame width={180} flare={lit ? 'lit' : 'unlit'}>
              <View style={styles.numberSlot}>
                <Animated.Text key={streak} entering={numberIn} exiting={numberOut} style={styles.number}>
                  {streak}
                </Animated.Text>
              </View>
              </StreakFlame>
            </Animated.View>
            </View>

            {/* This week's shrimp: red = done, frozen = freeze, gray = not yet. Today's cooks. */}
            <View style={styles.week}>
              {week.map((d, i) => {
                const isToday = i === todayIndex;
                return (
                  <Animated.View
                    key={i}
                    entering={FadeInDown.delay(250 + i * 70).duration(260).reduceMotion(ReduceMotion.System)}
                    style={[styles.dayCol, isToday && styles.onTop]}>
                    <StreakShrimp
                      status={d.status}
                      size={40}
                      cook={isToday && cooking}
                      onCooked={() => setLit(true)}
                    />
                    <Text style={[styles.dayLetter, isToday && styles.dayLetterToday]}>{d.label}</Text>
                  </Animated.View>
                );
              })}
            </View>

            <Animated.View entering={FadeIn.delay(500).duration(300)} style={styles.texts}>
              <Text style={styles.title}>{streak} Day Streak!</Text>
              <Text style={styles.subtitle}>Sketch every day to build your streak</Text>
            </Animated.View>
          </Animated.View>
        )}
      </View>

      {/* The button's space is reserved from the start, so nothing above shifts when it appears. */}
      <View style={styles.continueSlot}>
        {showContinue && (
          <Animated.View entering={FadeInDown.duration(260).reduceMotion(ReduceMotion.System)}>
            <ChunkyButton
              label="CONTINUE"
              sound={feedbackNext ? 'tap' : 'unlock-feed'}
              onPress={() => {
                // Puff's feedback comes next (once per sketch), then the friends' feed.
                if (takeFeedbackPending()) router.replace('/feedback');
                else router.dismissTo('/');
              }}
            />
          </Animated.View>
        )}
      </View>
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
  continueSlot: {
    // ChunkyButton (large): 58 face + 5 shadow.
    height: 63,
  },
  barRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  texts: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  title: {
    color: Ink.ink,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: nunito(900),
    textAlign: 'center',
  },
  titleAccent: {
    color: ORANGE,
  },
  subtitle: {
    color: '#77736B',
    fontSize: 16,
    lineHeight: 23,
    fontFamily: nunito(600),
    textAlign: 'center',
  },
  barTrack: {
    flex: 1,
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
    gap: 4,
  },
  dayCol: {
    alignItems: 'center',
    gap: 2,
  },
  onTop: {
    zIndex: 2,
  },
  dayLetter: {
    fontSize: 13,
    fontFamily: nunito(800),
    color: '#A9A59C',
  },
  dayLetterToday: {
    color: ORANGE,
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
