import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

// Collection: the user's own past sketches, so they can see progress.
export default function CollectionScreen() {
  return (
    <Screen>
      <ThemedText type="subtitle">My sketches</ThemedText>
      <EmptyState
        emoji="📒"
        title="Your collection starts today"
        message="Every sketch you submit lands here, so you can look back and see how far you've come."
      />
    </Screen>
  );
}
