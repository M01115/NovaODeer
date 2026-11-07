import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeOut, Keyframe, ReduceMotion } from 'react-native-reanimated';

import { Screen } from '@/components/screen';
import { SketchThumb } from '@/components/sketch-thumb';
import { Smudge } from '@/components/smudge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getPromptForDate } from '@/data/prompts';
import { REACTIONS, type Reaction } from '@/data/reactions';
import { SAMPLE_SKETCHES } from '@/data/sketches';
import { type PostedSketch, usePostedToday } from '@/data/today';
import { useTheme } from '@/hooks/use-theme';

/**
 * Placeholder friends until accounts and friends come from the backend. Their drawings
 * are sample sketches standing in for real uploads of today's prompt.
 */
const FRIENDS = [
  { name: 'Sam', initial: 'S', color: '#A4BCD4', minutes: 4, image: SAMPLE_SKETCHES[10].image, counts: [5, 2, 1, 0, 3, 1] },
  { name: 'Jun', initial: 'J', color: '#E2C98A', minutes: 6, image: SAMPLE_SKETCHES[15].image, counts: [8, 4, 2, 1, 0, 2] },
  { name: 'Ana', initial: 'A', color: '#D9A6A0', minutes: 2, image: SAMPLE_SKETCHES[9].image, counts: [3, 1, 4, 0, 1, 0] },
  { name: 'Leo', initial: 'L', color: '#B7C7A3', minutes: 5, image: SAMPLE_SKETCHES[14].image, counts: [6, 3, 0, 2, 2, 1] },
];
type Friend = (typeof FRIENDS)[number];

/** Friends' reactions on your own sketch, until the backend. */
const MY_REACTION_COUNTS = [4, 3, 2, 1, 2, 1];

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const popIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.92 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
})
  .duration(220)
  .reduceMotion(ReduceMotion.System);

function formatTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

/**
 * Friends feed for today's prompt.
 * - Locked until you post your own sketch today (no peeking first).
 * - Once posted: your sketch on top, Smudge's feedback beside him, then your friends'
 *   sketches in a 2×2 grid. Friends only: sketches are never shown to strangers.
 * - Reactions are a fixed set of positive emojis; no text comments.
 */
export default function FeedScreen() {
  const posted = usePostedToday();
  const prompt = useMemo(() => getPromptForDate(), []);
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState<Friend | null>(null);

  return (
    <View style={styles.root}>
      <Screen>
        <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          <ThemedText type="subtitle">Friends</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Today’s prompt: {prompt.text}
          </ThemedText>
        </View>

        {posted ? (
          width > 0 && (
            <PostedFeed
              posted={posted}
              promptText={prompt.text}
              promptEmoji={prompt.emoji}
              width={width}
              onOpenFriend={setOpen}
            />
          )
        ) : (
          <LockedFeed />
        )}
      </Screen>

      {open && <FriendSketch friend={open} onClose={() => setOpen(null)} />}
    </View>
  );
}

function PostedFeed({
  posted,
  promptText,
  promptEmoji,
  width,
  onOpenFriend,
}: {
  posted: PostedSketch;
  promptText: string;
  promptEmoji: string;
  width: number;
  onOpenFriend: (f: Friend) => void;
}) {
  // Two per row, with a little slack so sub-pixel rounding never wraps the second tile.
  const tile = Math.floor((width - Spacing.three) / 2) - 2;
  const feedback =
    posted.feedback ??
    `Ooh, ${promptText.toLowerCase()}! Love how loose and confident your lines are. That’s day 8 — keep it rolling!`;

  return (
    <>
      {/* Your sketch */}
      <ThemedView type="backgroundElement" style={styles.mine}>
        <View style={styles.mineHeader}>
          <ThemedText type="smallBold">You</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatTime(posted.seconds)}
          </ThemedText>
        </View>
        <SketchThumb size={width - 24} image={posted.image} emoji={promptEmoji} shape="card" />
        {/* Friends' reactions to your sketch (positive emojis only). Placeholder counts. */}
        <View style={[styles.reactions, styles.myReactions]} accessibilityLabel="Reactions from friends">
          {REACTIONS.map((r, i) => (
            <View key={r} style={styles.reaction}>
              <Text style={styles.reactionEmoji}>{r}</Text>
              <ThemedText type="small" themeColor="textSecondary" style={styles.reactionCountText}>
                {MY_REACTION_COUNTS[i]}
              </ThemedText>
            </View>
          ))}
        </View>
      </ThemedView>

      {/* Smudge's feedback, with Smudge peeking over the sketch's bottom-right corner */}
      <View style={styles.feedbackRow}>
        <ThemedView type="backgroundElement" style={styles.feedbackBox}>
          <ThemedText type="small">{feedback}</ThemedText>
        </ThemedView>
        <View style={styles.mascot}>
          <Smudge size={104} mood="proud" animated />
        </View>
      </View>

      {/* Friends' sketches */}
      <View style={styles.grid}>
        {FRIENDS.map((f) => (
          <Pressable
            key={f.name}
            accessibilityRole="button"
            accessibilityLabel={`${f.name}'s sketch`}
            onPress={() => onOpenFriend(f)}
            style={({ pressed }) => pressed && styles.pressedScale}>
            <ThemedView type="backgroundElement" style={[styles.tile, { width: tile }]}>
              <SketchThumb size={tile - 16} image={f.image} emoji={promptEmoji} shape="card" />
              <View style={styles.tileFooter}>
                <View style={[styles.avatar, { backgroundColor: f.color }]}>
                  <Text style={styles.avatarText}>{f.initial}</Text>
                </View>
                <ThemedText type="smallBold" style={styles.tileName}>
                  {f.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  ❤️ {f.counts.reduce((a, b) => a + b, 0)}
                </ThemedText>
              </View>
            </ThemedView>
          </Pressable>
        ))}
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        Only your friends can see your sketch, and only after they’ve posted theirs.
      </ThemedText>
    </>
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

/** A friend's sketch, popped up, with positive-emoji reactions you can toggle. */
function FriendSketch({ friend, onClose }: { friend: Friend; onClose: () => void }) {
  const theme = useTheme();
  // Your own reactions (placeholder until the backend).
  const [mine, setMine] = useState<Set<Reaction>>(new Set());
  const toggle = (r: Reaction) =>
    setMine((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });

  return (
    <Animated.View exiting={FadeOut.duration(150)} style={styles.layer}>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
      <Animated.View entering={popIn} style={[styles.popCard, { backgroundColor: theme.background }]}>
        <View style={styles.popHeader}>
          <View style={[styles.avatar, { backgroundColor: friend.color }]}>
            <Text style={styles.avatarText}>{friend.initial}</Text>
          </View>
          <ThemedText type="smallBold" style={styles.tileName}>
            {friend.name} · {friend.minutes} min
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
            <ThemedText type="smallBold">✕</ThemedText>
          </Pressable>
        </View>
        <SketchThumb size={290} image={friend.image} emoji="✏️" shape="card" />
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
                style={[styles.reaction, on && { backgroundColor: theme.backgroundSelected }]}>
                <Text style={styles.reactionEmoji}>{r}</Text>
                <Text style={[styles.reactionCount, { color: theme.textSecondary }]}>
                  {friend.counts[i] + (on ? 1 : 0)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  mine: {
    padding: 12,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },
  mineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    // Smudge rises up over the sketch card's bottom-right corner.
    marginTop: -Spacing.six,
    gap: Spacing.two,
  },
  feedbackBox: {
    flex: 1,
    marginTop: Spacing.six,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  mascot: {
    // Bleeds toward the screen edge, like the wireframe.
    marginRight: -Spacing.four,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.three,
  },
  tile: {
    padding: 8,
    borderRadius: Spacing.three,
    gap: 6,
  },
  tileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  tileName: {
    flex: 1,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: 800,
    color: '#161616',
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
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(22, 22, 22, 0.35)',
  },
  popCard: {
    width: 330,
    maxWidth: '92%',
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    gap: 14,
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
  },
  popHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  reactions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
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
  myReactions: {
    // Leaves the bottom-right corner free for Smudge, who sits over it.
    marginRight: 84,
  },
  reactionCountText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
  },
});
