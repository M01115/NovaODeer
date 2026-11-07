import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { nunito, Spacing } from '@/constants/theme';

type Props = {
  emoji: string;
  title: string;
  message: string;
};

export function EmptyState({ emoji, title, message }: Props) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText style={styles.emoji}>{emoji}</ThemedText>
      <ThemedText type="smallBold" style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {message}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.five,
    borderRadius: Spacing.four,
  },
  emoji: {
    fontFamily: nunito(400),
    fontSize: 40,
    lineHeight: 48,
  },
  center: {
    textAlign: 'center',
  },
});
