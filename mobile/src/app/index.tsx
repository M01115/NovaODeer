import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getPromptForDate } from '@/data/prompts';
import { useTheme } from '@/hooks/use-theme';

// Placeholder until streaks come from the backend.
const STREAK_DAYS = 0;

function comingSoon(feature: string) {
  Alert.alert('Coming soon', `${feature} isn't built yet.`);
}

export default function TodayScreen() {
  const prompt = getPromptForDate();
  const theme = useTheme();

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">A Sketch a Day</ThemedText>
        <ThemedView type="backgroundElement" style={styles.streak}>
          <ThemedText type="smallBold">🔥 {STREAK_DAYS}</ThemedText>
        </ThemedView>
      </View>

      <ThemedView type="backgroundElement" style={styles.promptCard}>
        <ThemedText type="small" themeColor="textSecondary">
          Today’s prompt
        </ThemedText>
        <ThemedText type="subtitle" style={styles.promptText}>
          {prompt}
        </ThemedText>
      </ThemedView>

      <View style={styles.actions}>
        {/* Main path: photo of a paper sketch. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => comingSoon('Taking a photo')}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.text },
            pressed && styles.pressed,
          ]}>
          <ThemedText style={[styles.primaryLabel, { color: theme.background }]}>
            📷 Snap my sketch
          </ThemedText>
        </Pressable>

        <View style={styles.secondaryRow}>
          <SecondaryButton label="🖼️ Upload" onPress={() => comingSoon('Uploading')} />
          <SecondaryButton label="✏️ Draw here" onPress={() => comingSoon('Drawing in the app')} />
        </View>
      </View>
    </Screen>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.secondaryInner}>
        <ThemedText type="smallBold">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streak: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
  promptCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.two,
    minHeight: 200,
    justifyContent: 'center',
  },
  promptText: {
    lineHeight: 40,
  },
  actions: {
    gap: Spacing.three,
  },
  primaryButton: {
    paddingVertical: Spacing.three + Spacing.one,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
  primaryLabel: {
    fontSize: 18,
    fontWeight: 700,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  secondaryButton: {
    flex: 1,
  },
  secondaryInner: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
