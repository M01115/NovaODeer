import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, nunito } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHasHydrated } from '@/hooks/use-has-hydrated';

// iPhone 16-ish screen in points.
const SCREEN_WIDTH = 393;
const SCREEN_HEIGHT = 852;
const BEZEL = 12;
const DEVICE_HEIGHT = SCREEN_HEIGHT + BEZEL * 2;
const STATUS_BAR_HEIGHT = 54;
const HOME_INDICATOR_HEIGHT = 34;
const INSETS = { top: STATUS_BAR_HEIGHT, bottom: HOME_INDICATOR_HEIGHT, left: 0, right: 0 };

/**
 * Browser preview only: shows the app inside an iPhone-sized frame with a status bar,
 * Dynamic Island and home indicator. On a narrow screen (a phone's browser) it steps aside.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const hasHydrated = useHasHydrated();
  const { width, height } = useWindowDimensions();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // The server doesn't know the window size, so frame only after hydration.
  if (!hasHydrated || width < 500) {
    return children;
  }

  const scale = Math.min(1, (height - 32) / DEVICE_HEIGHT);

  return (
    <View style={[styles.page, { backgroundColor: scheme === 'dark' ? '#141416' : '#E7E7EC' }]}>
      <View style={[styles.device, { transform: [{ scale }] }]}>
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
          {/* App fills the whole screen; status bar and home indicator float on top, like iOS. */}
          <SafeAreaInsetsContext.Provider value={INSETS}>
            <View style={styles.app}>{children}</View>
          </SafeAreaInsetsContext.Provider>

          <View style={styles.statusBar} pointerEvents="none">
            <ThemedText style={styles.time}>9:41</ThemedText>
            <View style={styles.island} />
            <View style={[styles.battery, { borderColor: colors.text }]}>
              <View style={[styles.batteryLevel, { backgroundColor: colors.text }]} />
            </View>
          </View>

          <View style={styles.homeArea} pointerEvents="none">
            <View style={[styles.homeIndicator, { backgroundColor: colors.text }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  device: {
    width: SCREEN_WIDTH + BEZEL * 2,
    height: DEVICE_HEIGHT,
    padding: BEZEL,
    borderRadius: 64,
    backgroundColor: '#0B0B0C',
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.35)',
  },
  screen: {
    flex: 1,
    borderRadius: 52,
    overflow: 'hidden',
  },
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: STATUS_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
    paddingTop: 6,
  },
  time: {
    fontSize: 16,
    fontFamily: nunito(600),
    width: 54,
  },
  island: {
    position: 'absolute',
    top: 11,
    left: (SCREEN_WIDTH - 124) / 2,
    width: 124,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000',
  },
  battery: {
    width: 26,
    height: 12,
    borderWidth: 1.5,
    borderRadius: 4,
    padding: 1.5,
    opacity: 0.9,
  },
  batteryLevel: {
    flex: 1,
    borderRadius: 1.5,
  },
  app: {
    flex: 1,
  },
  homeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HOME_INDICATOR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIndicator: {
    width: 134,
    height: 5,
    borderRadius: 3,
    opacity: 0.85,
  },
});
