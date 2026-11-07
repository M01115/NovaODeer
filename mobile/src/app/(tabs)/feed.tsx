import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SketchThumb } from '@/components/sketch-thumb';
import { Smudge } from '@/components/smudge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getPromptForDate } from '@/data/prompts';
import { REACTIONS, type Reaction } from '@/data/reactions';
import { usePostedToday } from '@/data/today';
import { useTheme } from '@/hooks/use-theme';

/** Placeholder friends until accounts and friends come from the backend. */
const FRIENDS = [
  { name: 'Sam', initial: 'S', color: '#A4BCD4', minutes: 4, counts: [5, 2, 1, 0, 3, 1] },
  { name: 'Jun', initial: 'J', color: '#E2C98A', minutes: 6, counts: [8, 4, 2, 1, 0, 2] },
  { name: 'Ana', initial: 'A', color: '#D9A6A0', minutes: 2, counts: [3, 1, 4, 0, 1, 0] },
  { name: 'Leo', initial: 'L', color: '#B7C7A3', minutes: 5, counts: [6, 3, 0, 2, 2, 1] },
];

/**
 * Friends feed for today's prompt.
 * - Locked until you post your own sketch today (no peeking first).
 * - Friends only: sketches are never shown to strangers.
 * - Reactions are a fixed set of positive emojis; no text comments.
 */
export default function FeedScreen() {
  const posted = usePostedToday();
  const prompt = useMemo(() => getPromptForDate(), []);

  return (
    <Screen>
      <View>
        <ThemedText type="subtitle">Friends</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Today’s prompt: {prompt.text}
        </ThemedText>
      </View>

      {posted ? (
        <>
          {FRIENDS.map((f) => (
            <FriendPost key={f.name} friend={f} emoji={prompt.emoji} />
          ))}
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Only your friends can see your sketch, and only after they’ve posted theirs.
          </ThemedText>
        </>
      ) : (
        <LockedFeed />
      )}
    </Screen>
  );
}

function LockedFeed() {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.locked}>
      <Smudge size={96} mood="focus" animated />
      <ThemedText type="smallBold" style={styles.center}>
        Post today’s sketch to see your friends’
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {FRIENDS.length} friends have sketched today. No peeking until you’ve drawn yours!
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/session')}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.text },
          pressed && styles.pressedScale,
        ]}>
        <Text style={[styles.ctaText, { color: theme.background }]}>+  Snap my sketch</Text>
      </Pressable>
    </ThemedView>
  );
}

function FriendPost({
  friend,
  emoji,
}: {
  friend: (typeof FRIENDS)[number];
  emoji: string;
}) {
  const theme = useTheme();
  // Your own reactions, toggled on and off (placeholder until the backend).
  const [mine, setMine] = useState<Set<Reaction>>(new Set());

  const toggle = (r: Reaction) =>
    setMine((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });

  return (
    <ThemedView type="backgroundElement" style={styles.post}>
      <View style={styles.postHeader}>
        <View style={[styles.avatar, { backgroundColor: friend.color }]}>
          <Text style={styles.avatarText}>{friend.initial}</Text>
        </View>
        <ThemedText type="smallBold">{friend.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          · {friend.minutes} min
        </ThemedText>
      </View>

      <View style={styles.sketch}>
        <SketchThumb size={280} emoji={emoji} shape="card" />
      </View>

      <View style={styles.reactions}>
        {REACTIONS.map((r, i) => {
          const on = mine.has(r);
          return (
            <Pressable
              key={r}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`React ${r}`}
              onPress={() => toggle(r)}
              style={[styles.reaction, on && { backgroundColor: theme.background }]}>
              <Text style={styles.reactionEmoji}>{r}</Text>
              <Text style={[styles.reactionCount, { color: theme.textSecondary }]}>
                {friend.counts[i] + (on ? 1 : 0)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  locked: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  cta: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
    marginTop: Spacing.two,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: 700,
  },
  pressedScale: {
    transform: [{ scale: 0.97 }],
  },
  post: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    gap: Spacing.three,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: 800,
    color: '#161616',
  },
  sketch: {
    alignItems: 'center',
  },
  reactions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reaction: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 40,
  },
  reactionEmoji: {
    fontSize: 20,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: 700,
  },
});
