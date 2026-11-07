import { type StyleProp, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';

/**
 * Puff Hand, the mascot's display font (from Morris's kit on the morris/puff-font branch).
 * Chunky, hand-cut letters that roll a little off the baseline. Use it for a few words at a
 * time: headings, the prompt word, celebrations. Body copy stays in Nunito.
 *
 * The fonts are loaded in the root layout (PUFF_FONTS). Characters: a–z, A–Z, 0–9 and
 * . , ! ? ' : - &. Anything else falls back to the system font.
 */
export const PUFF_FONTS = {
  PuffHand: require('@/assets/fonts/PuffHand-Regular.ttf'),
  PuffHandRim: require('@/assets/fonts/layers/PuffHandRim-Regular.ttf'),
  PuffHandTop: require('@/assets/fonts/layers/PuffHandTop-Regular.ttf'),
  PuffHandBelly: require('@/assets/fonts/layers/PuffHandBelly-Regular.ttf'),
};

/** Inlay colours: orange rim, yellow top, cream belly (Puff), or the pink Blush set. */
export const PUFF_PALETTES = {
  puff: { rim: '#F2A21B', top: '#FFC53D', belly: '#FFE7A1' },
  blush: { rim: '#E0507A', top: '#FF9DB0', belly: '#FFD9E0' },
} as const;

type InlayPalette = { rim: string; top: string; belly: string };

const base = (size: number): TextStyle => ({
  fontSize: size,
  lineHeight: Math.round(size * 1.12),
  includeFontPadding: false, // Android: keeps the inlay layers lined up
});

/** One-colour Puff Hand text for headings, the prompt word and buttons. */
export function PuffText({
  children,
  size = 32,
  color = '#2B2D33',
  style,
  numberOfLines,
}: {
  children: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[base(size), { fontFamily: 'PuffHand', color }, style]}>
      {children}
    </Text>
  );
}

/**
 * The yellow inlay style for the logo and celebrations: three one-colour layer fonts
 * (rim, top, belly) stacked in the same spot, since colour fonts aren't reliable on phones.
 * Put it on a dark background only, never yellow text on white.
 */
export function PuffInlay({
  children,
  size = 48,
  palette = PUFF_PALETTES.puff,
  style,
}: {
  children: string;
  size?: number;
  palette?: InlayPalette;
  style?: StyleProp<ViewStyle>;
}) {
  const t = base(size);
  return (
    <View style={style} accessible accessibilityRole="text" accessibilityLabel={children}>
      <Text style={[t, { fontFamily: 'PuffHandRim', color: palette.rim }]}>{children}</Text>
      <Text
        style={[t, styles.layer, { fontFamily: 'PuffHandTop', color: palette.top }]}
        importantForAccessibility="no">
        {children}
      </Text>
      <Text
        style={[t, styles.layer, { fontFamily: 'PuffHandBelly', color: palette.belly }]}
        importantForAccessibility="no">
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0 },
});
