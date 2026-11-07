import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

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
}: {
  size?: number;
  mood?: SmudgeMood;
  /** Gentle breathing and blinking. Off when the user prefers reduced motion. */
  animated?: boolean;
}) {
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
        {/* Pencil-shaving curl */}
        <View
          style={[
            styles.abs,
            {
              top: s * 0.02,
              left: s * 0.44,
              width: s * 0.1,
              height: s * 0.16,
              borderRadius: s * 0.06,
              backgroundColor: SmudgeColors.bodyShade,
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
              backgroundColor: SmudgeColors.body,
              transform: [{ rotate: '22deg' }],
            },
          ]}
        />

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
                backgroundColor: SmudgeColors.bodyShade,
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
              backgroundColor: SmudgeColors.body,
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
                backgroundColor: SmudgeColors.bodyShade,
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
                backgroundColor: SmudgeColors.belly,
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

const styles = StyleSheet.create({
  abs: {
    position: 'absolute',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
