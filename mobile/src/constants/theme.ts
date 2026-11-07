/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Playful palette (after the team's "Explicai" reference): warm cream, white cards,
// bright yellow as the main colour, orange / sky blue / pink accents, black ink.
export const Colors = {
  light: {
    text: '#161616',
    background: '#F6EFE4',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EFE5D6',
    textSecondary: '#8C8173',
  },
  // Unused while the app is light-only (see hooks/use-color-scheme.ts).
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

/** Brand colours, shared by buttons, cards, the archive and the streak screens. */
export const Palette = {
  yellow: '#FFD21F',
  yellowDeep: '#F5B800',
  orange: '#FF5A1F',
  blue: '#18B4F0',
  pink: '#FFA9D4',
  cream: '#F6EFE4',
  creamDeep: '#EFE5D6',
};

/** Ink accents (outlines, text, lines). */
export const Ink = {
  ink: '#161616',
  inkLip: '#000000',
  pencil: '#C9BFB0',
  paper: '#FFFFFF',
  paperLip: '#DDD3C4',
  /** The spot colour for urgency / today (overtime, today's dot). */
  red: Palette.orange,
};

/**
 * Nunito, for all text. Custom fonts need one font file per weight, so use
 * `fontFamily: nunito(700)` instead of `fontWeight: 700`. Loaded in app/_layout.tsx.
 */
const NUNITO = {
  400: 'Nunito_400Regular',
  500: 'Nunito_500Medium',
  600: 'Nunito_600SemiBold',
  700: 'Nunito_700Bold',
  800: 'Nunito_800ExtraBold',
  900: 'Nunito_900Black',
} as const;

export function nunito(weight: keyof typeof NUNITO) {
  return NUNITO[weight];
}

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
