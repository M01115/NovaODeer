import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, nunito, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[{ color: theme[themeColor ?? 'text'], fontFamily: nunito(400) }, styles[type], style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: nunito(500),
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: nunito(700),
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: nunito(500),
  },
  title: {
    fontSize: 48,
    fontFamily: nunito(600),
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontFamily: nunito(600),
  },
  link: {
    fontFamily: nunito(400),
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: nunito(400),
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
