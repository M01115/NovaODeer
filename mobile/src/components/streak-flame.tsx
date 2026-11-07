import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Keyframe, ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

/**
 * The big streak flame on the celebration screen, alive like Duolingo's: the body breathes
 * and sways from its base, a darker tongue behind it flickers out of phase (so the outline
 * seems to change shape), and embers drift up. `flare` changes when the streak ticks up:
 * the flame flares big once. Children (the number) sit on the flame.
 */
const FLAME_PATH =
  'M50 4 C64 26 90 46 90 76 C90 100 72 116 50 116 C28 116 10 100 10 76 C10 56 24 46 34 30 C38 44 44 50 50 52 C46 36 46 20 50 4 Z';
/** A narrower tongue that peeks out behind the body. */
const TONGUE_PATH = 'M58 0 C70 24 92 44 90 76 C88 100 72 114 52 114 C40 114 34 96 40 76 C44 60 56 44 58 0 Z';

const ORANGE = '#FF9600';
const DEEP = '#F06A00';
const EMBERS = [
  { x: 0.18, size: 9, delay: 0, color: '#FFC800' },
  { x: 0.78, size: 11, delay: 700, color: '#FF9600' },
  { x: 0.34, size: 7, delay: 1300, color: '#FFB347' },
  { x: 0.64, size: 8, delay: 1900, color: '#FFC800' },
];

const flareUp = new Keyframe({
  0: { transform: [{ scale: 1 }] },
  35: { transform: [{ scale: 1.22 }] },
  70: { transform: [{ scale: 0.96 }] },
  100: { transform: [{ scale: 1 }] },
})
  .duration(520)
  .reduceMotion(ReduceMotion.System);

const loop = (ms: number, frames: Record<string, object>, delay = 0) =>
  ({
    animationName: frames,
    animationDuration: ms,
    animationDelay: delay,
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  }) as const;

const SWAY = loop(1400, {
  '0%': { transform: [{ rotate: '-2.5deg' }] },
  '50%': { transform: [{ rotate: '2.5deg' }] },
  '100%': { transform: [{ rotate: '-2.5deg' }] },
});
const BREATHE = loop(900, {
  '0%': { transform: [{ scaleX: 1 }, { scaleY: 1 }] },
  '50%': { transform: [{ scaleX: 0.97 }, { scaleY: 1.05 }] },
  '100%': { transform: [{ scaleX: 1 }, { scaleY: 1 }] },
});
const FLICKER = loop(1100, {
  '0%': { transform: [{ rotate: '6deg' }, { scaleY: 0.92 }] },
  '30%': { transform: [{ rotate: '-4deg' }, { scaleY: 1.06 }] },
  '60%': { transform: [{ rotate: '3deg' }, { scaleY: 0.98 }] },
  '100%': { transform: [{ rotate: '6deg' }, { scaleY: 0.92 }] },
});
const FLICKER_LEFT = loop(1300, {
  '0%': { transform: [{ scaleX: -1 }, { rotate: '-3deg' }, { scaleY: 1.02 }] },
  '40%': { transform: [{ scaleX: -1 }, { rotate: '5deg' }, { scaleY: 0.9 }] },
  '100%': { transform: [{ scaleX: -1 }, { rotate: '-3deg' }, { scaleY: 1.02 }] },
});
const ember = (delay: number) =>
  ({
    animationName: {
      '0%': { opacity: 0, transform: [{ translateY: 0 }, { rotate: '45deg' }, { scale: 0.6 }] },
      '20%': { opacity: 1 },
      '100%': { opacity: 0, transform: [{ translateY: -70 }, { rotate: '120deg' }, { scale: 1 }] },
    },
    animationDuration: 2400,
    animationDelay: delay,
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-out',
  }) as const;

export function StreakFlame({
  width = 180,
  flare,
  children,
}: {
  width?: number;
  /** Change this (e.g. the streak number) to flare the flame once. */
  flare?: string | number;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const height = width * 1.2;
  const live = !reduced;
  const box = { width, height };

  return (
    <View style={box}>
      {live &&
        EMBERS.map((e, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.ember,
              { left: width * e.x, top: height * 0.22, width: e.size, height: e.size, backgroundColor: e.color },
              ember(e.delay),
            ]}
          />
        ))}
      <Animated.View key={String(flare)} entering={flare !== undefined ? flareUp : undefined} style={[box, styles.base]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.base, live && SWAY]}>
          {/* Darker tongues behind the body, flickering out of phase. */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.base, live && FLICKER]}>
            <Svg width="100%" height="100%" viewBox="0 0 100 120">
              <Path d={TONGUE_PATH} fill={DEEP} />
            </Svg>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.base, live && FLICKER_LEFT]}>
            <Svg width="100%" height="100%" viewBox="0 0 100 120">
              <Path d={TONGUE_PATH} fill={DEEP} transform="translate(6 10) scale(0.9)" />
            </Svg>
          </Animated.View>
          {/* The body */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.base, live && BREATHE]}>
            <Svg width="100%" height="100%" viewBox="0 0 100 120">
              <Path d={FLAME_PATH} fill={ORANGE} />
            </Svg>
          </Animated.View>
        </Animated.View>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    transformOrigin: '50% 95%',
  },
  ember: {
    position: 'absolute',
    borderRadius: 2,
  },
});
