import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CloseButton } from '@/components/close-button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { SketchThumb } from '@/components/sketch-thumb';
import { Smudge } from '@/components/smudge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatShortDate, getDay } from '@/data/history';

/** A past day's sketch and Smudge's feedback, opened from its node on the path. */
export default function SketchScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const day = date ? getDay(date) : undefined;

  if (!day || day.status !== 'done') {
    return (
      <Screen>
        <CloseButton />
        <EmptyState emoji="🔍" title="No sketch here" message="This day doesn’t have a sketch." />
      </Screen>
    );
  }

  return (
    <Screen>
      <CloseButton />

      <View style={styles.heading}>
        <ThemedText type="small" themeColor="textSecondary">
          {formatShortDate(day.date)}
        </ThemedText>
        <ThemedText type="subtitle" style={styles.prompt}>
          {day.prompt.text}
        </ThemedText>
      </View>

      <View style={styles.sketch}>
        <SketchThumb size={300} imageUri={day.imageUri} emoji={day.prompt.emoji} shape="card" />
      </View>

      {day.feedback && (
        <View style={styles.feedback}>
          <Smudge size={64} />
          <ThemedView type="backgroundElement" style={styles.bubble}>
            <ThemedText type="small">{day.feedback}</ThemedText>
          </ThemedView>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: Spacing.one,
  },
  prompt: {
    lineHeight: 40,
  },
  sketch: {
    alignItems: 'center',
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  bubble: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
});
