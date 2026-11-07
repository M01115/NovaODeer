import { useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeOut, Keyframe, ReduceMotion, useReducedMotion } from 'react-native-reanimated';

import { SketchThumb } from '@/components/sketch-thumb';
import { Smudge, type SmudgeMood } from '@/components/smudge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { nunito, Spacing } from '@/constants/theme';
import { getPromptForDate } from '@/data/prompts';
import { REACTIONS, type Reaction } from '@/data/reactions';
import { ReactionButton } from '@/components/reaction-button';
import { getFriendSketches, MY_SAMPLE_SKETCHES } from '@/data/friends';
import { type PostedSketch } from '@/data/today';
import { useTheme } from '@/hooks/use-theme';
import { playSound, startLoop, stopSound } from '@/lib/sounds';

/** A friend's sketch of today's prompt, flattened for the tiles and pop-up. */
type Friend = { name: string; initial: string; color: string; minutes: number; image: number; counts: number[] };

/** Friends' sketches of a prompt (everyone draws the same prompt each day). */
function friendsFor(promptId?: string): Friend[] {
  return getFriendSketches(promptId).map((s) => ({ ...s.friend, minutes: s.minutes, image: s.image, counts: s.counts }));
}

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
 * The feed, shown on Home once today's sketch is posted (before that, Home shows the
 * prompt). Your sketch with friends' reactions, Puff's feedback beside him, then your
 * friends' sketches in a 2×2 grid. Friends only: sketches are never shown to strangers.
 * Reactions are a fixed set of positive emojis; no text comments.
 */
export function FeedView({ posted }: { posted: PostedSketch }) {
  const insets = useSafeAreaInsets();
  const prompt = useMemo(() => getPromptForDate(), []);
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState<Friend | null>(null);
  const [screenW, setScreenW] = useState(0);
  const friends = useMemo(() => friendsFor(prompt.id), [prompt.id]);

  return (
    <View style={styles.root} onLayout={(e: LayoutChangeEvent) => setScreenW(e.nativeEvent.layout.width)}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
        <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          <ThemedText type="small" themeColor="textSecondary">
            Today’s prompt
          </ThemedText>
          <ThemedText type="smallBold" style={styles.promptTitle}>
            {prompt.text}
          </ThemedText>
        </View>

        {width > 0 && (
          <PostedFeed
            posted={posted}
            promptText={prompt.text}
            promptEmoji={prompt.emoji}
            friends={friends}
            myStandIn={prompt.id ? MY_SAMPLE_SKETCHES[prompt.id] : undefined}
            width={width}
            onOpenFriend={setOpen}
          />
        )}
      </ScrollView>

      {open && <FriendSketch friend={open} screenW={screenW} onClose={() => setOpen(null)} />}
    </View>
  );
}

function PostedFeed({
  posted,
  promptText,
  promptEmoji,
  friends,
  myStandIn,
  width,
  onOpenFriend,
}: {
  posted: PostedSketch;
  promptText: string;
  promptEmoji: string;
  friends: Friend[];
  /** Your sketch when the post has no image yet (scan is still a stub). */
  myStandIn?: number;
  width: number;
  onOpenFriend: (f: Friend) => void;
}) {
  // Two per row, with a little slack so sub-pixel rounding never wraps the second tile.
  const tile = Math.floor((width - Spacing.three) / 2) - 2;
  const feedback =
    posted.feedback ??
    `Ooh, ${promptText.toLowerCase()}! Love how loose and confident your lines are. That’s day 8 — keep it rolling!`;
  const moment = useFeedbackMoment(posted, feedback);

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
        <SketchThumb size={width - 24} image={posted.image ?? myStandIn} emoji={promptEmoji} shape="card" />
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

      {/* Puff's feedback, with Puff peeking over the sketch's bottom-right corner */}
      <View style={styles.feedbackRow}>
        <ThemedView type="backgroundElement" style={styles.feedbackBox}>
          {/* Full text keeps the box's size; the typed part shows on top of it. */}
          <ThemedText type="small" style={styles.hiddenText}>
            {feedback}
          </ThemedText>
          <ThemedText type="small" style={styles.typedText}>
            {moment.typed === null ? moment.waitLine : feedback.slice(0, moment.typed)}
          </ThemedText>
        </ThemedView>
        <View style={styles.mascot}>
          <Smudge size={104} mood={moment.mood} animated />
        </View>
      </View>

      {/* Friends' sketches */}
      <View style={styles.grid}>
        {friends.map((f) => (
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


/** A friend's sketch, popped up, with positive-emoji reactions you can toggle. */
function FriendSketch({ friend, screenW, onClose }: { friend: Friend; screenW: number; onClose: () => void }) {
  // Fixed width in points (not a %), so the card doesn't change size when its pop-in ends.
  const cardW = Math.min(330, Math.round(screenW * 0.92));
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
      <Animated.View entering={popIn} style={[styles.popCard, { width: cardW, backgroundColor: theme.background }]}>
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
        <SketchThumb size={cardW - 36} image={friend.image} emoji="✏️" shape="card" />
        <View style={styles.reactions}>
          {REACTIONS.map((r, i) => {
            const on = mine.has(r);
            return (
              <ReactionButton
                key={r}
                emoji={r}
                count={friend.counts[i] + (on ? 1 : 0)}
                on={on}
                onToggle={() => toggle(r)}
                selectedColor={theme.backgroundSelected}
                countColor={theme.textSecondary}
              />
            );
          })}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/** Feedback moments already played (once per posted sketch). */
const played = new WeakSet<PostedSketch>();

/**
 * Morris's "feedback" moment: Puff looks closely at your sketch (sonar scan), thinks
 * (bubbles loop while the AI writes), jumps when the answer arrives ("aha!"), then cheers
 * while his note types out word by word and lands with a little chime. Plays once per
 * posted sketch; afterwards the note just shows. Times from puff.config.json.
 */
function useFeedbackMoment(posted: PostedSketch, text: string) {
  const reduced = useReducedMotion();
  const first = !played.has(posted) && !reduced;
  const [mood, setMood] = useState<SmudgeMood>(first ? 'squint' : 'happy');
  const [typed, setTyped] = useState<number | null>(first ? null : text.length);
  const [waitLine, setWaitLine] = useState('Ooh, let me take a close look…');

  useEffect(() => {
    if (!first) return;
    played.add(posted);
    playSound('scan');
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    at(2200, () => {
      setMood('thinking');
      setWaitLine('Hmm, thinking…');
      startLoop('thinking-loop', 0.6);
    });
    at(4000, () => {
      stopSound('thinking-loop');
      setMood('surprised');
      playSound('aha');
    });
    at(4700, () => {
      setMood('happy');
      setTyped(0);
    });
    return () => {
      timers.forEach(clearTimeout);
      stopSound('thinking-loop');
    };
  }, [first, posted]);

  // Type the note out, 28 ms a character, a soft blip on each word.
  useEffect(() => {
    if (typed === null || typed >= text.length) return;
    const id = setTimeout(() => {
      const next = typed + 1;
      if (text[next - 1] === ' ') playSound('type-blip', { rate: 0.9 + Math.random() * 0.3, volume: 0.5 });
      if (next === text.length) playSound('notice');
      setTyped(next);
    }, 28);
    return () => clearTimeout(id);
  }, [typed, text]);

  return { mood, typed, waitLine };
}

const styles = StyleSheet.create({
  hiddenText: {
    opacity: 0,
  },
  typedText: {
    // Same spot as the hidden full text: inside feedbackBox's padding.
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
  },
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.four,
  },
  promptTitle: {
    fontFamily: nunito(400),
    fontSize: 20,
    lineHeight: 26,
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
    // Puff rises up over the sketch card's bottom-right corner.
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
    fontFamily: nunito(800),
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
    fontFamily: nunito(700),
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
    fontFamily: nunito(400),
    fontSize: 20,
  },
  reactionCount: {
    fontSize: 11,
    fontFamily: nunito(700),
  },
  myReactions: {
    // Leaves the bottom-right corner free for Smudge, who sits over it.
    marginRight: 84,
  },
  reactionCountText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: nunito(700),
  },
});
