import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { playSound } from '@/lib/sounds';

/** Closes a modal screen. (iPhone users can also swipe down.) */
export function CloseButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={12}
      onPress={() => {
        playSound('back');
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.button}>
        <ThemedText type="smallBold">✕</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-end',
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
