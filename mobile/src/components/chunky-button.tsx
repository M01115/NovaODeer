import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ink, nunito, Palette } from '@/constants/theme';
import { playSound, type SoundId } from '@/lib/sounds';

const VARIANTS = {
  pink: { bg: Palette.pink, fg: Ink.ink },
  yellow: { bg: Palette.yellow, fg: Ink.ink },
  white: { bg: '#FFFFFF', fg: Ink.ink },
  orange: { bg: Palette.orange, fg: '#FFFFFF' },
  blue: { bg: Palette.blue, fg: '#FFFFFF' },
} as const;

const LIP = 5;
const BORDER = 2.5;

/**
 * The app's main button (from the team's Figma "Sketch Now" button): bold fill, black
 * outline and a black offset shadow underneath. Pressing pushes the button down onto
 * its shadow, so it feels physical.
 */
export function ChunkyButton({
  label,
  onPress,
  variant = 'pink',
  size = 'large',
  icon,
  sound = 'tap',
}: {
  label: string;
  onPress: () => void;
  variant?: keyof typeof VARIANTS;
  size?: 'large' | 'medium';
  /** Optional leading glyph, e.g. "+" */
  icon?: string;
  /** Sound on press (Morris's sound kit). Defaults to the bubble tap; null for silence. */
  sound?: SoundId | null;
}) {
  const v = VARIANTS[variant];
  const height = size === 'large' ? 58 : 48;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => {
        if (sound) playSound(sound);
        onPress();
      }}
      style={{ height: height + LIP }}>
      {({ pressed }) => (
        <>
          {/* The black shadow the button sits on */}
          <View style={[styles.shadow, { top: LIP, left: LIP, height }]} />
          <View
            style={[
              styles.face,
              { height, backgroundColor: v.bg, transform: [{ translateX: pressed ? LIP : 0 }, { translateY: pressed ? LIP : 0 }] },
            ]}>
            {icon && <Text style={[styles.icon, { color: v.fg }]}>{icon}</Text>}
            <Text style={[styles.label, { color: v.fg, fontSize: size === 'large' ? 19 : 16 }]}>{label}</Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
    right: -LIP,
    borderRadius: 18,
    backgroundColor: Ink.ink,
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderRadius: 18,
    borderWidth: BORDER,
    borderColor: Ink.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: {
    fontFamily: nunito(800),
    fontSize: 24,
    lineHeight: 26,
  },
  label: {
    fontFamily: nunito(800),
    letterSpacing: 0.3,
  },
});
