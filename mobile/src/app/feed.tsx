import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

// Feed: everyone's sketches for today's prompt, friends first.
// Reactions come from the fixed positive set in src/data/reactions.ts.

export default function FeedScreen() {
  return (
    <Screen>
      <ThemedText type="subtitle">Feed</ThemedText>
      <EmptyState
        emoji="🎨"
        title="No sketches yet"
        message="Sketches from friends show up first, then everyone else's take on today's prompt."
      />
    </Screen>
  );
}
