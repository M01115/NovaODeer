import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PuffText } from '@/components/puff-text';
import { PUFF_IMAGES, Smudge, type SmudgeMood } from '@/components/smudge';
import { Colors } from '@/constants/theme';
import { playSound } from '@/lib/sounds';

/**
 * The "App opens" moment from Morris's puff.config.json, shown once per launch over
 * everything (tap to skip). Timeline, from the first frame Puff is drawn:
 *
 *      0 ms  rolls in from off-screen left, spinning like a wheel (spin matches distance)
 *   1100 ms  lands: bouncing (squash on impact)
 *   2000 ms  happy hop; the app's name fades up underneath
 *   3300 ms  name fades; Puff pops a little bigger, then shrinks away while the background
 *            fades with him
 *   3900 ms  gone
 *
 * Smoothness rules (from a frame-by-frame audit): nothing changes layout mid-animation (the
 * name's space is always reserved), the roll uses a calm pose with no built-in drift, and the
 * whole thing waits until Puff's artwork is loaded and the screen is measured.
 */
const SIZE = 180;
const ROLL_SCALE = 1.25;
const ROLL_MS = 1100;
const LAND_AT = 1100;
const HAPPY_AT = 2000;
const LEAVE_AT = 3300;
const LEAVE_MS = 600;
const ROLL_EASE = Easing.bezier(0.2, 0.75, 0.3, 1);

export function PuffIntro() {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [assetsReady, setAssetsReady] = useState(false);
  const [mood, setMood] = useState<SmudgeMood>('neutral');
  const [done, setDone] = useState(false);

  const x = useSharedValue(0);
  const rot = useSharedValue(0);
  const scale = useSharedValue(ROLL_SCALE);
  const shown = useSharedValue(0); // Puff hidden until the first real frame
  const nameIn = useSharedValue(0);
  const veil = useSharedValue(1); // the cream background

  // With reduced motion there's no intro: just hand over from the native splash.
  useEffect(() => {
    if (reduced) SplashScreen.hideAsync().catch(() => {});
  }, [reduced]);

  // Load the artwork first so no layer pops in mid-roll (cap the wait at 1.5 s).
  useEffect(() => {
    let alive = true;
    const give = setTimeout(() => alive && setAssetsReady(true), 1500);
    Asset.loadAsync(PUFF_IMAGES())
      .catch(() => {})
      .finally(() => alive && setAssetsReady(true));
    return () => {
      alive = false;
      clearTimeout(give);
    };
  }, []);

  useEffect(() => {
    if (reduced || !assetsReady || !width) return;
    // The native splash stays up until Puff is ready (see _layout.tsx).
    SplashScreen.hideAsync().catch(() => {});
    playSound('app-open');

    const rm = ReduceMotion.Never; // reduced motion skips the intro entirely
    // Start just off-screen left; roll like a wheel: angle = distance / radius.
    const startX = -(width / 2 + SIZE * ROLL_SCALE * 0.6);
    const radius = SIZE * ROLL_SCALE * 0.38; // roughly the body's radius
    x.set(startX);
    rot.set((startX / radius) * (180 / Math.PI));
    shown.set(1);
    x.set(withTiming(0, { duration: ROLL_MS, easing: ROLL_EASE, reduceMotion: rm }));
    rot.set(withTiming(0, { duration: ROLL_MS, easing: ROLL_EASE, reduceMotion: rm }));
    // Settle from the big roll size to normal as he lands.
    scale.set(withDelay(LAND_AT, withTiming(1.1, { duration: 500, easing: Easing.out(Easing.quad), reduceMotion: rm })));
    nameIn.set(
      withSequence(
        withDelay(HAPPY_AT, withTiming(1, { duration: 300, easing: Easing.out(Easing.quad), reduceMotion: rm })),
        withDelay(LEAVE_AT - HAPPY_AT - 300, withTiming(0, { duration: 200, reduceMotion: rm }))
      )
    );

    const timers = [
      setTimeout(() => setMood('bouncing'), LAND_AT),
      setTimeout(() => setMood('happy'), HAPPY_AT),
      setTimeout(() => {
        scale.set(
          withSequence(
            withTiming(1.25, { duration: 160, easing: Easing.out(Easing.quad), reduceMotion: rm }),
            withTiming(0, { duration: LEAVE_MS - 160, easing: Easing.in(Easing.back(1.4)), reduceMotion: rm })
          )
        );
        veil.set(
          withDelay(
            160,
            withTiming(0, { duration: LEAVE_MS - 60, easing: Easing.in(Easing.quad), reduceMotion: rm }, (finished) => {
              if (finished) scheduleOnRN(setDone, true);
            })
          )
        );
      }, LEAVE_AT),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduced, assetsReady, width, x, rot, scale, shown, nameIn, veil]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.get() }));
  const puffStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateX: x.get() }, { rotate: `${rot.get()}deg` }, { scale: scale.get() }],
  }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameIn.get(),
    transform: [{ translateY: (1 - nameIn.get()) * 10 }],
  }));

  if (done || reduced) return null;

  return (
    <Animated.View
      style={[styles.overlay, veilStyle]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <Pressable accessibilityLabel="Skip intro" style={styles.center} onPress={() => setDone(true)}>
        {/* Fixed-size box: Puff's moves are transforms only, so nothing reflows. */}
        <View style={styles.puffBox}>
          <Animated.View style={puffStyle}>
            <Smudge size={SIZE} mood={mood} animated />
          </Animated.View>
        </View>
        {/* The name's space is always there; it only fades, so Puff never jumps. */}
        <Animated.View style={[styles.name, nameStyle]}>
          <PuffText size={44}>A Sketch a Day</PuffText>
          <PuffText size={18} color="#83868D">
            one sketch a day, with Puff
          </PuffText>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.light.background,
    zIndex: 100,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  puffBox: {
    width: SIZE,
    height: SIZE * 1.12,
  },
  name: {
    alignItems: 'center',
    gap: 4,
  },
});
