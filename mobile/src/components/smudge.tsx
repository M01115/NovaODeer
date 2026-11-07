import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { type BodyColor, type Outfit, useOutfit } from '@/data/outfit';

/**
 * Smudge, the mascot (placeholder design): a squishy ball of graphite, like a pencil
 * smudge come to life, with big white eyes and a curl of pencil shaving on top.
 * Drawn with plain Views, so it scales to any size and needs no image assets.
 */
export const SmudgeColors = {
  body: '#2A2A2A',
  bodyShade: '#161616',
  belly: '#3A3A3A',
  sheen: 'rgba(255, 255, 255, 0.16)',
  eyeWhite: '#FFFFFF',
  pupil: '#161616',
  blush: 'rgba(255, 130, 150, 0.45)',
  mouth: '#FFFFFF',
  shadow: 'rgba(0, 0, 0, 0.12)',
  sweat: '#9CD3F0',
};

/**
 * - happy: default
 * - focus: watching you draw (eyes down, flat mouth)
 * - hurry: time is nearly up (little "o" mouth, sweat drop)
 * - proud: done or overtime (happy closed eyes, big smile)
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
  const chosen = useOutfit();
  const outfit = outfitProp ?? chosen;
  const palette = BODY_COLORS[outfit.color];
  const reducedMotion = useReducedMotion();
  const live = animated && !reducedMotion;

  const s = size;
  const bodyW = s;
  const bodyH = s * 0.9;

  const eyeW = s * 0.17;
  const eyeH = s * 0.19;
  const pupil = mood === 'hurry' ? s * 0.08 : s * 0.1;
  const pupilOffset = mood === 'focus' ? eyeH * 0.12 : -eyeH * 0.12;
  const mouthW = mood === 'proud' ? s * 0.16 : s * 0.11;
  const stroke = Math.max(2, s * 0.02);

  return (
    <View style={{ width: s, height: s * 1.12, alignItems: 'center' }} accessibilityLabel="Smudge">
      {/* Ground shadow stays put while the body breathes. */}
      <View
        style={[
          styles.abs,
          {
            bottom: 0,
            width: s * 0.7,
            height: s * 0.07,
            borderRadius: s,
            backgroundColor: SmudgeColors.shadow,
          },
        ]}
      />

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transformOrigin: 'bottom' },
          live && {
            animationName: BREATHE,
            animationDuration: '2800ms',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          },
        ]}>
        {/* Pencil-shaving curl (tucked under a hat when he wears one) */}
        {outfit.hat === 'none' && (
          <>
        <View
          style={[
            styles.abs,
            {
              top: s * 0.02,
              left: s * 0.44,
              width: s * 0.1,
              height: s * 0.16,
              borderRadius: s * 0.06,
              backgroundColor: palette.bodyShade,
              transform: [{ rotate: '-18deg' }],
            },
          ]}
        />
        <View
          style={[
            styles.abs,
            {
              top: s * 0.05,
              left: s * 0.5,
              width: s * 0.08,
              height: s * 0.12,
              borderRadius: s * 0.05,
              backgroundColor: palette.body,
              transform: [{ rotate: '22deg' }],
            },
          ]}
        />
          </>
        )}

        {/* Feet */}
        {[0.3, 0.56].map((x) => (
          <View
            key={x}
            style={[
              styles.abs,
              {
                bottom: s * 0.03,
                left: s * x,
                width: s * 0.14,
                height: s * 0.08,
                borderRadius: s * 0.05,
                backgroundColor: palette.bodyShade,
              },
            ]}
          />
        ))}

        {/* Body */}
        <View
          style={[
            styles.abs,
            {
              top: s * 0.12,
              left: 0,
              width: bodyW,
              height: bodyH,
              borderRadius: bodyW / 2,
              backgroundColor: palette.body,
              overflow: 'hidden',
            },
          ]}>
          {/* Darker graphite on the lower right */}
          <View
            style={[
              styles.abs,
              {
                right: -s * 0.12,
                bottom: -s * 0.16,
                width: s * 0.8,
                height: s * 0.6,
                borderRadius: s,
                backgroundColor: palette.bodyShade,
                opacity: 0.6,
              },
            ]}
          />
          {/* Belly */}
          <View
            style={[
              styles.abs,
              {
                left: s * 0.26,
                bottom: s * 0.07,
                width: s * 0.48,
                height: s * 0.3,
                borderRadius: s,
                backgroundColor: palette.belly,
              },
            ]}
          />
          {/* Pencil sheen, like light catching graphite */}
          <View
            style={[
              styles.abs,
              {
                left: s * 0.14,
                top: s * 0.09,
                width: s * 0.22,
                height: s * 0.08,
                borderRadius: s,
                backgroundColor: SmudgeColors.sheen,
                transform: [{ rotate: '-28deg' }],
              },
            ]}
          />

          {/* Eyes */}
          {[0.25, 0.58].map((x) =>
            mood === 'proud' ? (
              // Happy closed eyes: little arches.
              <View
                key={x}
                style={[
                  styles.abs,
                  {
                    left: s * x,
                    top: s * 0.32,
                    width: eyeW,
                    height: eyeW / 2,
                    borderTopLeftRadius: eyeW,
                    borderTopRightRadius: eyeW,
                    borderWidth: stroke * 1.4,
                    borderBottomWidth: 0,
                    borderColor: SmudgeColors.eyeWhite,
                  },
                ]}
              />
            ) : (
              <Animated.View
                key={x}
                style={[
                  styles.abs,
                  styles.center,
                  {
                    left: s * x,
                    top: s * 0.26,
                    width: eyeW,
                    height: eyeH,
                    borderRadius: eyeW,
                    backgroundColor: SmudgeColors.eyeWhite,
                  },
                  live && {
                    animationName: BLINK,
                    animationDuration: '4200ms',
                    animationIterationCount: 'infinite',
                    animationTimingFunction: 'linear',
                  },
                ]}>
                <View
                  style={{
                    width: pupil,
                    height: pupil * 1.1,
                    borderRadius: pupil,
                    marginTop: pupilOffset,
                    backgroundColor: SmudgeColors.pupil,
                  }}>
                  <View
                    style={{
                      position: 'absolute',
                      left: pupil * 0.18,
                      top: pupil * 0.14,
                      width: pupil * 0.36,
                      height: pupil * 0.36,
                      borderRadius: pupil,
                      backgroundColor: '#fff',
                    }}
                  />
                </View>
              </Animated.View>
            )
          )}

          {/* Blush */}
          {[0.12, 0.72].map((x) => (
            <View
              key={x}
              style={[
                styles.abs,
                {
                  left: s * x,
                  top: s * 0.47,
                  width: s * 0.16,
                  height: s * 0.07,
                  borderRadius: s,
                  backgroundColor: SmudgeColors.blush,
                },
              ]}
            />
          ))}

          {/* Mouth */}
          {mood === 'focus' && (
            <View
              style={[
                styles.abs,
                {
                  left: (bodyW - mouthW * 0.8) / 2,
                  top: s * 0.52,
                  width: mouthW * 0.8,
                  height: stroke,
                  borderRadius: stroke,
                  backgroundColor: SmudgeColors.mouth,
                },
              ]}
            />
          )}
          {mood === 'hurry' && (
            <View
              style={[
                styles.abs,
                {
                  left: (bodyW - s * 0.07) / 2,
                  top: s * 0.49,
                  width: s * 0.07,
                  height: s * 0.08,
                  borderRadius: s,
                  borderWidth: stroke,
                  borderColor: SmudgeColors.mouth,
                },
              ]}
            />
          )}
          {(mood === 'happy' || mood === 'proud') && (
            <View
              style={[
                styles.abs,
                {
                  left: (bodyW - mouthW) / 2,
                  top: s * 0.48,
                  width: mouthW,
                  height: mouthW / 2,
                  borderBottomLeftRadius: mouthW / 2,
                  borderBottomRightRadius: mouthW / 2,
                  borderWidth: stroke,
                  borderTopWidth: 0,
                  borderColor: SmudgeColors.mouth,
                },
              ]}
            />
          )}
        </View>

        <OutfitLayer s={s} outfit={outfit} />

        {/* Sweat drop when time is nearly up */}
        {mood === 'hurry' && (
          <View
            style={[
              styles.abs,
              {
                right: s * 0.02,
                top: s * 0.2,
                width: s * 0.09,
                height: s * 0.12,
                borderRadius: s,
                borderTopRightRadius: 0,
                backgroundColor: SmudgeColors.sweat,
                transform: [{ rotate: '-45deg' }],
              },
            ]}
          />
        )}
      </Animated.View>
    </View>
  );
}

/** Pencil colours for Smudge's body. */
const BODY_COLORS: Record<BodyColor, { body: string; bodyShade: string; belly: string }> = {
  graphite: { body: SmudgeColors.body, bodyShade: SmudgeColors.bodyShade, belly: SmudgeColors.belly },
  blue: { body: '#2E4A6B', bodyShade: '#1F3550', belly: '#3D5E86' },
  red: { body: '#7A2E2E', bodyShade: '#561D1D', belly: '#924141' },
  sage: { body: '#3E5E4A', bodyShade: '#2B4334', belly: '#4E735B' },
};

const FRAME = '#EDE4CF';

/**
 * Hats, glasses and neckwear, drawn over Smudge in the same coordinate space (s = size).
 * His body spans x 0..s and y 0.12s..1.02s; his eyes sit at y 0.38s, x 0.25s and 0.58s.
 */
function OutfitLayer({ s, outfit }: { s: number; outfit: Outfit }) {
  return (
    <>
      {/* Neck */}
      {outfit.neck === 'scarf' && (
        <>
          <View
            style={[
              styles.abs,
              { top: s * 0.72, left: s * 0.1, width: s * 0.8, height: s * 0.12, borderRadius: s * 0.06, backgroundColor: '#B03A2E' },
            ]}
          />
          <View
            style={[
              styles.abs,
              {
                top: s * 0.78,
                left: s * 0.6,
                width: s * 0.12,
                height: s * 0.24,
                borderRadius: s * 0.04,
                backgroundColor: '#952F25',
                transform: [{ rotate: '12deg' }],
              },
            ]}
          />
        </>
      )}
      {outfit.neck === 'bowtie' && (
        <>
          <View
            style={[
              styles.abs,
              styles.bowLeft,
              { top: s * 0.7, left: s * 0.34, borderTopWidth: s * 0.07, borderBottomWidth: s * 0.07, borderLeftWidth: s * 0.15 },
            ]}
          />
          <View
            style={[
              styles.abs,
              styles.bowRight,
              { top: s * 0.7, left: s * 0.51, borderTopWidth: s * 0.07, borderBottomWidth: s * 0.07, borderRightWidth: s * 0.15 },
            ]}
          />
          <View
            style={[
              styles.abs,
              { top: s * 0.735, left: s * 0.46, width: s * 0.08, height: s * 0.07, borderRadius: s * 0.02, backgroundColor: '#245B92' },
            ]}
          />
        </>
      )}

      {/* Glasses */}
      {outfit.eyes === 'round' && (
        <>
          {[0.21, 0.54].map((x) => (
            <View
              key={x}
              style={[
                styles.abs,
                { top: s * 0.345, left: s * x, width: s * 0.25, height: s * 0.25, borderRadius: s, borderWidth: s * 0.025, borderColor: FRAME },
              ]}
            />
          ))}
          <View style={[styles.abs, { top: s * 0.45, left: s * 0.455, width: s * 0.09, height: s * 0.022, backgroundColor: FRAME }]} />
        </>
      )}
      {outfit.eyes === 'shades' && (
        <>
          {[0.2, 0.54].map((x) => (
            <View
              key={x}
              style={[
                styles.abs,
                {
                  top: s * 0.36,
                  left: s * x,
                  width: s * 0.26,
                  height: s * 0.18,
                  borderRadius: s * 0.06,
                  borderWidth: s * 0.018,
                  borderColor: FRAME,
                  backgroundColor: '#0B0B0B',
                },
              ]}
            />
          ))}
          <View style={[styles.abs, { top: s * 0.42, left: s * 0.455, width: s * 0.09, height: s * 0.022, backgroundColor: FRAME }]} />
          <View
            style={[
              styles.abs,
              { top: s * 0.385, left: s * 0.25, width: s * 0.06, height: s * 0.03, borderRadius: s, backgroundColor: 'rgba(255,255,255,0.5)' },
            ]}
          />
        </>
      )}

      {/* Hats */}
      {outfit.hat === 'beret' && (
        <>
          <View
            style={[
              styles.abs,
              {
                top: s * 0.06,
                left: s * 0.18,
                width: s * 0.62,
                height: s * 0.2,
                borderRadius: s,
                backgroundColor: '#C0392B',
                transform: [{ rotate: '-12deg' }],
              },
            ]}
          />
          <View
            style={[
              styles.abs,
              { top: 0, left: s * 0.44, width: s * 0.06, height: s * 0.1, borderRadius: s * 0.03, backgroundColor: '#A93226' },
            ]}
          />
        </>
      )}
      {outfit.hat === 'beanie' && (
        <>
          <View
            style={[
              styles.abs,
              {
                top: -s * 0.02,
                left: s * 0.17,
                width: s * 0.66,
                height: s * 0.34,
                borderTopLeftRadius: s * 0.33,
                borderTopRightRadius: s * 0.33,
                backgroundColor: '#E2A93B',
              },
            ]}
          />
          <View
            style={[
              styles.abs,
              { top: s * 0.24, left: s * 0.14, width: s * 0.72, height: s * 0.11, borderRadius: s * 0.04, backgroundColor: '#C98F24' },
            ]}
          />
          <View
            style={[
              styles.abs,
              { top: -s * 0.1, left: s * 0.43, width: s * 0.14, height: s * 0.14, borderRadius: s, backgroundColor: '#F3D27A' },
            ]}
          />
        </>
      )}
      {outfit.hat === 'party' && (
        <>
          <View
            style={[
              styles.abs,
              styles.triangle,
              {
                top: -s * 0.24,
                left: s * 0.33,
                borderLeftWidth: s * 0.17,
                borderRightWidth: s * 0.17,
                borderBottomWidth: s * 0.38,
                borderBottomColor: '#6C8EBF',
              },
            ]}
          />
          <View
            style={[
              styles.abs,
              { top: -s * 0.02, left: s * 0.4, width: s * 0.2, height: s * 0.04, borderRadius: s, backgroundColor: '#F2C14E' },
            ]}
          />
          <View
            style={[
              styles.abs,
              { top: -s * 0.3, left: s * 0.45, width: s * 0.1, height: s * 0.1, borderRadius: s, backgroundColor: '#E5483B' },
            ]}
          />
        </>
      )}
      {outfit.hat === 'crown' && (
        <>
          {[0.26, 0.42, 0.58].map((x) => (
            <View
              key={x}
              style={[
                styles.abs,
                styles.triangle,
                {
                  top: -s * 0.06,
                  left: s * x,
                  borderLeftWidth: s * 0.08,
                  borderRightWidth: s * 0.08,
                  borderBottomWidth: s * 0.14,
                  borderBottomColor: '#E8B931',
                },
              ]}
            />
          ))}
          <View
            style={[
              styles.abs,
              { top: s * 0.07, left: s * 0.25, width: s * 0.5, height: s * 0.12, borderRadius: s * 0.02, backgroundColor: '#E8B931' },
            ]}
          />
          <View
            style={[
              styles.abs,
              { top: s * 0.1, left: s * 0.46, width: s * 0.08, height: s * 0.06, borderRadius: s, backgroundColor: '#E5483B' },
            ]}
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  triangle: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  bowLeft: {
    width: 0,
    height: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#2F6FB0',
  },
  bowRight: {
    width: 0,
    height: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#2F6FB0',
  },
  abs: {
    position: 'absolute',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
