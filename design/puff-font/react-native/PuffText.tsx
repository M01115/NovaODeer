// Puff Hand for Expo / React Native.
//
// 1. Copy the kit's fonts/ folder to assets/fonts/ in the app.
// 2. Call usePuffFonts() once near the root and wait for it to return true.
// 3. Use <PuffText> for graphite text and <PuffInlay> for the yellow logo style.
//
// Colour fonts are not reliable on phones, so <PuffInlay> stacks three one-colour
// layer fonts (rim, top, belly) in the same spot. They share metrics and the same
// letter-roll feature, so the layers line up exactly.

import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { useFonts } from "expo-font";

export function usePuffFonts(): boolean {
  const [loaded] = useFonts({
    PuffHand: require("../assets/fonts/PuffHand-Regular.ttf"),
    PuffHandRim: require("../assets/fonts/layers/PuffHandRim-Regular.ttf"),
    PuffHandTop: require("../assets/fonts/layers/PuffHandTop-Regular.ttf"),
    PuffHandBelly: require("../assets/fonts/layers/PuffHandBelly-Regular.ttf"),
  });
  return loaded;
}

export const PUFF_PALETTES = {
  puff: { rim: "#F2A21B", top: "#FFC53D", belly: "#FFE7A1" },
  blush: { rim: "#E0507A", top: "#FF9DB0", belly: "#FFD9E0" },
} as const;

type Palette = { rim: string; top: string; belly: string };

const base = (size: number): TextStyle => ({
  fontSize: size,
  lineHeight: Math.round(size * 1.12),
  includeFontPadding: false, // Android: keep layers aligned
});

/** Graphite Puff Hand text for headings, the prompt word and buttons. */
export function PuffText({
  children,
  size = 32,
  color = "#2B2D33",
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
    <Text numberOfLines={numberOfLines} style={[base(size), { fontFamily: "PuffHand", color }, style]}>
      {children}
    </Text>
  );
}

/** Yellow inlay style for the logo and celebrations. Put it on graphite only. */
export function PuffInlay({
  children,
  size = 48,
  palette = PUFF_PALETTES.puff,
  style,
}: {
  children: string;
  size?: number;
  palette?: Palette;
  style?: StyleProp<ViewStyle>;
}) {
  const t = base(size);
  return (
    <View style={style} accessible accessibilityRole="text" accessibilityLabel={children}>
      <Text style={[t, { fontFamily: "PuffHandRim", color: palette.rim }]}>{children}</Text>
      <Text style={[t, styles.layer, { fontFamily: "PuffHandTop", color: palette.top }]} importantForAccessibility="no">
        {children}
      </Text>
      <Text style={[t, styles.layer, { fontFamily: "PuffHandBelly", color: palette.belly }]} importantForAccessibility="no">
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", top: 0, left: 0, right: 0 },
});
