import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { nunito } from '@/constants/theme';
import { playSound } from '@/lib/sounds';

/** Little copies that float up when you react: sideways drift (pt), tilt, delay. */
const FLOATERS = [
  { dx: -22, rot: -18, delay: 0, size: 0.9 },
  { dx: 14, rot: 14, delay: 60, size: 1.1 },
  { dx: -6, rot: -6, delay: 130, size: 0.8 },
  { dx: 26, rot: 22, delay: 190, size: 0.75 },
  { dx: -30, rot: -26, delay: 240, size: 0.7 },
];
const FLOAT_MS = 900;

/**
 * One positive-emoji reaction on a friend's sketch. Reacting pops the emoji (squash, then a
 * big springy pop with a little tilt), sends a few copies floating up over the sketch, rolls
 * the count up and gives a light tap. Un-reacting shrinks it back gently.
 */
export function ReactionButton({
  emoji,
  count,
  on,
  onToggle,
  selectedColor,
  countColor,
}: {
  emoji: string;
  count: number;
  on: boolean;
  onToggle: () => void;
  selectedColor: string;
  countColor: string;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const tilt = useSharedValue(0);
  const [bursts, setBursts] = useState<number[]>([]);

  // Clear each burst once its emojis have floated away.
  useEffect(() => {
    if (!bursts.length) return;
    const id = setTimeout(() => setBursts((b) => b.slice(1)), FLOAT_MS + 300);
    return () => clearTimeout(id);
  }, [bursts]);

  const press = () => {
    const turningOn = !on;
    onToggle();
    playSound(turningOn ? 'reaction' : 'tab');
    if (Platform.OS !== 'web') {
      if (turningOn) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else Haptics.selectionAsync();
    }
    if (reduced) return;
    const rm = ReduceMotion.Never; // reduced motion handled above
    if (turningOn) {
      scale.set(
        withSequence(
          withTiming(0.75, { duration: 70, easing: Easing.out(Easing.quad), reduceMotion: rm }),
          withTiming(1.55, { duration: 140, easing: Easing.out(Easing.quad), reduceMotion: rm }),
          withSpring(1, { damping: 7, stiffness: 260, reduceMotion: rm })
        )
      );
      tilt.set(
        withSequence(
          withTiming(-14, { duration: 90, reduceMotion: rm }),
          withTiming(10, { duration: 110, reduceMotion: rm }),
          withSpring(0, { damping: 8, stiffness: 220, reduceMotion: rm })
        )
      );
      setBursts((b) => [...b, Date.now()]);
    } else {
      scale.set(
        withSequence(
          withTiming(0.8, { duration: 90, reduceMotion: rm }),
          withSpring(1, { damping: 14, stiffness: 260, reduceMotion: rm })
        )
      );
    }
  };

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }, { rotate: `${tilt.get()}deg` }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`React ${emoji}`}
      onPress={press}
      style={[styles.button, on && { backgroundColor: selectedColor }]}>
      <View pointerEvents="none" style={styles.burstLayer}>
        {bursts.map((id) =>
          FLOATERS.map((f, i) => (
            <Animated.Text
              key={`${id}-${i}`}
              style={[
                styles.floater,
                { fontSize: 20 * f.size },
                {
                  animationName: {
                    '0%': { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 0.4 }] },
                    '15%': { opacity: 1 },
                    '100%': {
                      opacity: 0,
                      transform: [{ translateX: f.dx }, { translateY: -90 - i * 8 }, { rotate: `${f.rot}deg` }, { scale: 1.1 }],
                    },
                  },
                  animationDuration: FLOAT_MS,
                  animationDelay: f.delay,
                  animationTimingFunction: 'ease-out',
                  animationFillMode: 'both',
                } as object,
              ]}>
              {emoji}
            </Animated.Text>
          ))
        )}
      </View>
      <Animated.Text style={[styles.emoji, emojiStyle]}>{emoji}</Animated.Text>
      <View style={styles.countSlot}>
        <Animated.Text
          key={count}
          entering={FadeInDown.duration(180).reduceMotion(ReduceMotion.System)}
          exiting={FadeOutUp.duration(140).reduceMotion(ReduceMotion.System)}
          style={[styles.count, { color: countColor }]}>
          {count}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 40,
  },
  burstLayer: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  floater: {
    position: 'absolute',
    fontFamily: nunito(400),
  },
  emoji: {
    fontFamily: nunito(400),
    fontSize: 20,
  },
  countSlot: {
    height: 15,
    alignSelf: 'stretch',
    alignItems: 'center',
    overflow: 'hidden',
  },
  count: {
    position: 'absolute',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: nunito(700),
  },
});
