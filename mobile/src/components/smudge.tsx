import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { type Outfit, useOutfit } from '@/data/outfit';

/**
 * The mascot: the team's pufferfish, drawn in the mascot PSD and exported as aligned
 * layers (assets/mascot, one shared canvas). Stacking the layers rebuilds the drawing,
 * so accessories can be switched on and off and the eyes can blink on their own.
 * The component keeps its old name (Smudge) so every screen keeps working.
 */
const LAYERS = {
  tail: require('@/assets/mascot/tail.png'),
  body: require('@/assets/mascot/body.png'),
  eyes: require('@/assets/mascot/eyes.png'),
  glasses: require('@/assets/mascot/glasses.png'),
  spikes: require('@/assets/mascot/spikes.png'),
  brush: require('@/assets/mascot/brush.png'),
  fin: require('@/assets/mascot/fin.png'),
  hat: require('@/assets/mascot/hat.png'),
};

/** Height / width of the artwork canvas. */
const ART_ASPECT = 0.9185;
/** Centre of the eyes on the canvas (fractions), so blinking squashes around them. */
const EYES_ORIGIN = '70% 37%';

export const SmudgeColors = {
  shadow: 'rgba(0, 0, 0, 0.12)',
  sweat: '#9CD3F0',
};

/**
 * - happy: default
 * - focus: watching you draw (eyes narrowed)
 * - hurry: time is nearly up (sweat drop)
 * - proud: done or overtime (sparkles)
 */
export type SmudgeMood = 'happy' | 'focus' | 'hurry' | 'proud';

// Idle loops. Run on the UI thread as Reanimated CSS animations.
const BREATHE = {
  '0%': { transform: [{ scaleY: 1 }, { scaleX: 1 }] },
  '50%': { transform: [{ scaleY: 0.965 }, { scaleX: 1.02 }] },
  '100%': { transform: [{ scaleY: 1 }, { scaleX: 1 }] },
};
const BLINK = {
  '0%': { transform: [{ scaleY: 1 }] },
  '93%': { transform: [{ scaleY: 1 }] },
  '96%': { transform: [{ scaleY: 0.1 }] },
  '100%': { transform: [{ scaleY: 1 }] },
};

export function Smudge({
  size = 140,
  mood = 'happy',
  animated = false,
  outfit: outfitProp,
}: {
  size?: number;
  mood?: SmudgeMood;
  /** Gentle breathing and blinking. Off when the user prefers reduced motion. */
  animated?: boolean;
  /** What he's wearing. Defaults to the look chosen on the Profile page. */
  outfit?: Outfit;
}) {
  const reducedMotion = useReducedMotion();
  const chosen = useOutfit();
  const outfit = outfitProp ?? chosen;
  const live = animated && !reducedMotion;

  const s = size;
  const artH = s * ART_ASPECT;

  return (
    <View style={{ width: s, height: s * 1.12 }} accessibilityLabel="Mascot">
      {/* Ground shadow stays put while he breathes. */}
      <View
        style={[
          styles.abs,
          {
            bottom: 0,
            left: s * 0.18,
            width: s * 0.64,
            height: s * 0.06,
            borderRadius: s,
            backgroundColor: SmudgeColors.shadow,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.abs,
          { top: s * 1.12 - artH - s * 0.05, left: 0, width: s, height: artH, transformOrigin: 'bottom' },
          live && {
            animationName: BREATHE,
            animationDuration: '2800ms',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          },
        ]}>
        <Layer source={LAYERS.tail} />
        <Layer source={LAYERS.body} />

        {/* Eyes: blink on their own; narrowed while he watches you draw. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transformOrigin: EYES_ORIGIN },
            live && {
              animationName: BLINK,
              animationDuration: '4200ms',
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear',
            },
          ]}>
          <View
            style={[
              StyleSheet.absoluteFill,
              { transformOrigin: EYES_ORIGIN },
              mood === 'focus' && { transform: [{ scaleY: 0.82 }] },
            ]}>
            <Layer source={LAYERS.eyes} />
          </View>
        </Animated.View>

        {outfit.eyes === 'glasses' && <Layer source={LAYERS.glasses} />}
        <Layer source={LAYERS.spikes} />
        {outfit.hold === 'brush' && <Layer source={LAYERS.brush} />}
        <Layer source={LAYERS.fin} />
        {outfit.hat === 'beret' && <Layer source={LAYERS.hat} />}

        {/* Sweat drop when time is nearly up */}
        {mood === 'hurry' && (
          <View
            style={[
              styles.abs,
              {
                right: s * 0.02,
                top: s * 0.04,
                width: s * 0.08,
                height: s * 0.11,
                borderRadius: s,
                borderTopRightRadius: 0,
                backgroundColor: SmudgeColors.sweat,
                transform: [{ rotate: '-45deg' }],
              },
            ]}
          />
        )}

        {/* Sparkles when he's proud of you */}
        {mood === 'proud' && (
          <>
            <Text style={[styles.abs, { top: -s * 0.06, right: s * 0.04, fontSize: s * 0.14 }]}>✨</Text>
            <Text style={[styles.abs, { top: s * 0.42, left: -s * 0.04, fontSize: s * 0.1 }]}>✨</Text>
          </>
        )}
      </Animated.View>
    </View>
  );
}

function Layer({ source }: { source: number }) {
  return <Image source={source} style={StyleSheet.absoluteFill} contentFit="fill" />;
}

const styles = StyleSheet.create({
  abs: {
    position: 'absolute',
  },
});
