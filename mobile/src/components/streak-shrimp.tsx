import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import type { DayStatus } from '@/data/history';

/**
 * A streak day, drawn as a shrimp (from the team's shrimp PSD, assets/shrimp):
 * - done: the red, cooked shrimp
 * - frozen: a shrimp frozen inside a chunk of ice (a streak freeze saved the day)
 * - not done yet (today, missed, upcoming): the gray, live shrimp. Today's one wiggles.
 *
 * With `cook`, today's gray shrimp cooks itself: it lifts out of the row, squirms over a
 * rising flame, does one coin-flip spin that turns it red at the edge-on moment, then drops
 * back with a puff of steam and sparks. `onCooked` fires the moment it turns red (roll the
 * streak number then).
 */
const IMG = {
  red: require('@/assets/shrimp/shrimp-red.png'),
  gray: require('@/assets/shrimp/shrimp-gray.png'),
  frozen: require('@/assets/shrimp/shrimp-frozen.png'),
};
// Width / height of each image.
const ASPECT = { red: 300 / 161, gray: 360 / 95, frozen: 220 / 300 };
/** The live shrimp swims tilted up, so it fills its square. */
const LIVE_TILT = -20;

const FLAME_PATH =
  'M50 4 C64 26 90 46 90 76 C90 100 72 116 50 116 C28 116 10 100 10 76 C10 56 24 46 34 30 C38 44 44 50 50 52 C46 36 46 20 50 4 Z';
const FLAME_OUTER = '#FF7A00';
const FLAME_MID = '#FFB000';
const FLAME_CORE = '#FFE45C';

// Cook timeline (ms).
/** Edge-on in the spin: the moment gray becomes red. */
const TURN_RED_AT = 820;
/** When it drops back into the row. */
const DROP_AT = 1150;

export function StreakShrimp({
  status,
  size = 40,
  cook = false,
  onCooked,
}: {
  status: DayStatus;
  /** Width of the square cell. */
  size?: number;
  /** Play the cooking animation (gray → flame → red). */
  cook?: boolean;
  onCooked?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [cooked, setCooked] = useState(false);
  const kind = status === 'done' || cooked ? 'red' : status === 'frozen' ? 'frozen' : 'gray';

  // Cooking, in beats: lift out of the row, squirm over a rising flame, one coin-flip spin
  // that turns it red at the edge-on moment, then a puff of steam and sparks as it drops back.
  const lift = useSharedValue(0); // 0 in the row → 1 lifted and grown
  const squirm = useSharedValue(0); // degrees
  const flip = useSharedValue(0); // rotateY degrees
  const flame = useSharedValue(0);
  const flicker = useSharedValue(1);
  const puff = useSharedValue(0); // 0 → 1: sparks fly out and fade
  const onCookedRef = useRef(onCooked);
  useEffect(() => {
    onCookedRef.current = onCooked;
  }, [onCooked]);

  useEffect(() => {
    if (!cook || cooked) return;
    const turnRed = () => {
      setCooked(true);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCookedRef.current?.();
    };
    if (reducedMotion) {
      turnRed();
      return;
    }
    const rm = ReduceMotion.Never; // reduced motion is handled above
    const t = (ms: number, easing = Easing.inOut(Easing.quad)) => ({ duration: ms, easing, reduceMotion: rm });
    // 1. Lift (0–280ms), hold while it cooks, spring back down after the pop.
    lift.set(
      withSequence(
        withTiming(1, t(280, Easing.out(Easing.back(1.6)))),
        withDelay(DROP_AT - 280, withSpring(0, { damping: 11, stiffness: 170, reduceMotion: rm }))
      )
    );
    // 2. Squirm in the heat (150–750ms).
    squirm.set(
      withDelay(
        150,
        withSequence(
          withRepeat(withSequence(withTiming(9, t(60)), withTiming(-9, t(60))), 5),
          withTiming(0, t(60))
        )
      )
    );
    flame.set(
      withDelay(
        120,
        withSequence(withTiming(1, t(360, Easing.out(Easing.back(2)))), withDelay(TURN_RED_AT - 480, withTiming(0, t(260))))
      )
    );
    flicker.set(withRepeat(withSequence(withTiming(1.15, t(80)), withTiming(0.9, t(80))), 10, true));
    // 3. One spin: edge-on at TURN_RED_AT (swap happens there), then lands facing us.
    flip.set(
      withDelay(
        TURN_RED_AT - 200,
        withSequence(
          withTiming(90, t(200, Easing.in(Easing.quad))),
          withTiming(-90, { duration: 0, reduceMotion: rm }),
          withTiming(0, t(300, Easing.out(Easing.back(1.8))))
        )
      )
    );
    // 4. Steam and sparks burst as it turns red.
    puff.set(withDelay(TURN_RED_AT, withTiming(1, t(650, Easing.out(Easing.cubic)))));
    const timer = setTimeout(turnRed, TURN_RED_AT);
    return () => clearTimeout(timer);
  }, [cook, cooked, reducedMotion, lift, squirm, flip, flame, flicker, puff]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 400 },
      { translateY: lift.get() * -size * 0.55 },
      { scale: 1 + lift.get() * 0.6 },
      { rotate: `${squirm.get()}deg` },
      { rotateY: `${flip.get()}deg` },
    ],
  }));
  const flameStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, flame.get() * 1.5),
    transform: [{ scaleX: flame.get() * (2 - flicker.get()) }, { scaleY: flame.get() * flicker.get() }],
  }));

  // The ice chunk is tall, so it fits by height; the shrimp fit by width.
  const w = kind === 'frozen' ? size * ASPECT.frozen : kind === 'gray' ? size * 1.08 : size;
  const h = w / ASPECT[kind];
  const live = kind === 'gray';
  const wiggle = live && status === 'today' && !cook && !reducedMotion;

  return (
    <View style={[styles.cell, { width: size, height: size }, cook && styles.onTop]}>
      {cook && (
        <Animated.View pointerEvents="none" style={[styles.flame, { width: size * 0.95, height: size * 1.15 }, flameStyle]}>
          <Flame />
        </Animated.View>
      )}
      <Animated.View style={bodyStyle}>
        <Animated.View
          style={[
            { width: w, height: h, transform: [{ rotate: `${live ? LIVE_TILT : 0}deg` }] },
            status === 'locked' && live && styles.upcoming,
            status === 'missed' && live && styles.missed,
            wiggle && WIGGLE,
          ]}>
          <Image source={IMG[kind]} style={StyleSheet.absoluteFill} contentFit="contain" />
        </Animated.View>
      </Animated.View>
      {cook && SPARKS.map((sp, i) => <Spark key={i} spark={sp} puff={puff} lift={lift} size={size} />)}
    </View>
  );
}

function Flame() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 120">
      <Path d={FLAME_PATH} fill={FLAME_OUTER} />
      <Path d={FLAME_PATH} fill={FLAME_MID} transform="translate(18 30) scale(0.64)" />
      <Path d={FLAME_PATH} fill={FLAME_CORE} transform="translate(32 58) scale(0.36)" />
    </Svg>
  );
}

/** Steam puffs and sparks that burst out when the shrimp turns red. Angle in degrees, 0 = up. */
const SPARKS = [
  { angle: -70, dist: 1.0, color: '#FFFFFF', round: true },
  { angle: -20, dist: 1.15, color: FLAME_CORE, round: false },
  { angle: 25, dist: 1.05, color: '#FFFFFF', round: true },
  { angle: 70, dist: 1.0, color: FLAME_MID, round: false },
  { angle: 125, dist: 0.85, color: FLAME_CORE, round: false },
  { angle: -125, dist: 0.85, color: '#FFFFFF', round: true },
];

function Spark({
  spark,
  puff,
  lift,
  size,
}: {
  spark: (typeof SPARKS)[number];
  puff: SharedValue<number>;
  lift: SharedValue<number>;
  size: number;
}) {
  const rad = (spark.angle * Math.PI) / 180;
  const d = size * spark.dist;
  const style = useAnimatedStyle(() => {
    const p = puff.get();
    return {
      opacity: p > 0 && p < 1 ? 1 - p : 0,
      transform: [
        { translateX: Math.sin(rad) * d * p },
        { translateY: lift.get() * -size * 0.55 - Math.cos(rad) * d * p },
        { scale: 0.6 + p * 0.8 },
        { rotate: '45deg' },
      ],
    };
  });
  const dot = size * 0.18;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.spark,
        {
          width: dot,
          height: dot,
          borderRadius: spark.round ? dot / 2 : 2,
          backgroundColor: spark.color,
          borderColor: spark.round ? '#D9D4CA' : FLAME_OUTER,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  onTop: {
    zIndex: 2,
  },
  flame: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: '-5%',
    transformOrigin: 'bottom',
  },
  upcoming: {
    opacity: 0.45,
  },
  missed: {
    opacity: 0.7,
  },
  spark: {
    position: 'absolute',
    borderWidth: 1.5,
  },
});

/** Today's live shrimp swims in place. Kept out of StyleSheet.create (RN Web rejects keyframes there). */
const WIGGLE = {
  animationName: {
    '0%': { transform: [{ rotate: `${LIVE_TILT - 6}deg` }, { translateY: 0 }] },
    '50%': { transform: [{ rotate: `${LIVE_TILT + 6}deg` }, { translateY: -2 }] },
    '100%': { transform: [{ rotate: `${LIVE_TILT - 6}deg` }, { translateY: 0 }] },
  },
  animationDuration: '1100ms',
  animationIterationCount: 'infinite',
  animationTimingFunction: 'ease-in-out',
} as const;
