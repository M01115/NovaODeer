import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PhoneFrame } from '@/components/phone-frame';
import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Nunito for all text (see nunito() in constants/theme.ts). Hold rendering until it's loaded.
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <PhoneFrame>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            {/* Profile and Smudge's wardrobe, opened from the top-right of Home. */}
            <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
            {/* Sketch session (timer), opened from "+ Snap my sketch". */}
            <Stack.Screen name="session" options={{ presentation: 'modal' }} />
            {/* Streak completion, right after posting today's sketch. */}
            <Stack.Screen
              name="complete"
              options={{ presentation: 'fullScreenModal', animation: 'fade' }}
            />
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
