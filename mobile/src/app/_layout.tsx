import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PhoneFrame } from '@/components/phone-frame';
import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <PhoneFrame>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            {/* The sketch archive, opened by pulling down on Home. Drops in from above. */}
            <Stack.Screen
              name="archive"
              options={{ presentation: 'transparentModal', animation: 'fade' }}
            />
            {/* Sketch session (timer), opened from "+ Snap my sketch". */}
            <Stack.Screen name="session" options={{ presentation: 'modal' }} />
            {/* Past sketches as a winding path, opened from the top bar on Home. */}
            <Stack.Screen name="journey" options={{ presentation: 'modal' }} />
            {/* A past day's sketch, opened from its node on the path. */}
            <Stack.Screen name="sketch/[date]" options={{ presentation: 'modal' }} />
            {/* Streak celebration, shown once when the app opens. */}
            <Stack.Screen
              name="streak"
              options={{ presentation: 'fullScreenModal', animation: 'fade' }}
            />
          </Stack>
        </PhoneFrame>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
