import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { PhoneFrame } from '@/components/phone-frame';
import { PUFF_FONTS } from '@/components/puff-text';
import { PuffIntro } from '@/components/puff-intro';
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
    // Puff Hand, the mascot's display font (components/puff-text.tsx).
    ...PUFF_FONTS,
    // The mascot's handwriting (see constants/handwriting.ts).
    PatrickHand_400Regular,
  });
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <PhoneFrame>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            {/* Profile and Puff's wardrobe, opened from the top-right of Home. */}
            <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
            {/* Sketch session (timer), opened from "+ Snap my sketch". */}
            <Stack.Screen name="session" options={{ presentation: 'modal' }} />
            {/* Draw on the phone. Full screen, so a downward stroke can't swipe it away. */}
            <Stack.Screen name="draw" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            {/* Scanned sketch → Puff's AI feedback → post, opened from the session. */}
            <Stack.Screen name="feedback" options={{ presentation: 'modal' }} />
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
          {/* Puff rolls in when the app opens (Morris's "App opens" moment). */}
          <PuffIntro />
        </PhoneFrame>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
