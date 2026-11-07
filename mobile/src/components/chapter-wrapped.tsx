import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Smudge } from '@/components/smudge';
import { HAND_FONT } from '@/constants/handwriting';
import { nunito, Palette } from '@/constants/theme';
import { CHAPTER_SIZE } from '@/data/chapters';
import type { ReflectionNote } from '@/data/feedback';
import { formatShortDate } from '@/data/history';
import { useMascotName } from '@/data/outfit';
import { type ChapterSketch, useChapterReflection } from '@/data/reflections';

const INK = '#161616';
const MUTED = '#8C8173';
/** Sticker colours cycle per chapter (the archive's pocket palette). */
const STICKERS = ['#FFE680', '#BDE7FA', '#FFD1E6'];
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export type ChapterStats = {
  from: string;
  to: string;
  sketches: number;
  minutes: number;
  freezes: number;
};

/** A free pocket beside the S path: where it starts, which side, and how wide it can be. */
export type PocketSpot = { y: number; side: -1 | 1; width: number };

type Props = {
  /** 0-based chapter number. */
  index: number;
  /** Index of the chapter's first card on the path (for the scroll-linked effects). */
  start: number;
  sketches: ChapterSketch[];
  complete: boolean;
  stats: ChapterStats;
  /** Beside the first turn: the headline. Beside the second turn: the mascot and its comments. */
  titleSpot: PocketSpot;
  hostSpot: PocketSpot | null;
  width: number;
  /** Card index nearest the middle of the screen (UI thread). */
  focus: SharedValue<number>;
  /** The line currently highlighting sketches, if it's one of this chapter's. */
  activeNote: string | null;
  /** Highlight the sketches behind a line (or clear with null). */
  onHighlight: (noteKey: string | null, sketchIds: string[]) => void;
};

/**
 * A chapter of 7 sketches in the archive, hosted by the mascot: its "Wrapped" superlative
 * as a big editorial line beside the first turn of the S path, and the mascot itself beside
 * the second turn, saying 1–2 quick things in handwritten speech bubbles. Incomplete
 * chapters get a progress line from the mascot (no made-up recap).
 */
export function ChapterWrapped({
  index,
  start,
  sketches,
  complete,
  stats,
  titleSpot,
  hostSpot,
  width,
  focus,
  activeNote,
  onHighlight,
}: Props) {
  const name = useMascotName();
  const { state, retry } = useChapterReflection(complete ? sketches : null, name);
  const reflection = state?.status === 'ready' ? state.reflection : null;
  const sticker = STICKERS[index % STICKERS.length];
  const leftFor = (spot: PocketSpot) => (spot.side < 0 ? 16 : width - 16 - spot.width);

  // Chapters near the middle of the screen are fully inked; others fade back a little.
  const centre = start + CHAPTER_SIZE / 2 - 0.5;
  const fade = useAnimatedStyle(() => {
    const near = Math.abs(focus.get() - centre) <= CHAPTER_SIZE / 2 + 0.5;
    const timing = { duration: 260, easing: EASE_OUT, reduceMotion: ReduceMotion.System };
    return {
      opacity: withTiming(near ? 1 : 0.3, timing),
      transform: [{ translateY: withTiming(near ? 0 : 6, timing) }],
    };
  });

  // The host does a little hop when you scroll into its chapter.
  const hop = useSharedValue(0);
  useAnimatedReaction(
    () => Math.abs(focus.get() - centre) <= CHAPTER_SIZE / 2 + 0.5,
    (near, wasNear) => {
      if (near && wasNear === false) {
        hop.set(
          withSequence(
            withTiming(-10, { duration: 140, reduceMotion: ReduceMotion.System }),
            withSpring(0, { duration: 320, dampingRatio: 0.45, reduceMotion: ReduceMotion.System }),
          ),
        );
      }
    },
  );
  const hopStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hop.get() }] }));

  const tappable = (key: string, n: ReflectionNote, render: (active: boolean) => ReactNode) => {
    const noteKey = `${index}:${key}`;
    const active = activeNote === noteKey;
    const linked = n.sketchIds.length > 0;
    return (
      <Pressable
        key={key}
        disabled={!linked}
        accessibilityRole={linked ? 'button' : 'text'}
        accessibilityLabel={`${name}: ${n.text}`}
        accessibilityHint={linked ? 'Highlights the sketches this is about' : undefined}
        onPress={() => onHighlight(active ? null : noteKey, active ? [] : n.sketchIds)}
        hitSlop={4}>
        {render(active)}
      </Pressable>
    );
  };

  /** What the mascot says in its bubbles. */
  let bubbles: ReactNode = null;
  if (!complete) {
    const left = CHAPTER_SIZE - sketches.length;
    bubbles = (
      <Bubble>
        {left === 1
          ? 'One more and I’ll wrap this chapter!'
          : `${left} more till your chapter recap!`}
      </Bubble>
    );
  } else if (state?.status === 'loading') {
    bubbles = <Bubble muted>brb, flipping through these…</Bubble>;
  } else if (state?.status === 'error') {
    bubbles = (
      <Pressable accessibilityRole="button" onPress={retry} hitSlop={6}>
        <Bubble muted>oops, my brain glitched. tap to retry?</Bubble>
      </Pressable>
    );
  } else if (reflection) {
    bubbles = reflection.comments.map((c, i) =>
      tappable(`c${i}`, c, (active) => (
        <Animated.View entering={ZoomIn.delay(150 + i * 180).duration(260)}>
          <Bubble active={active} linked={c.sketchIds.length > 0}>
            {c.text}
          </Bubble>
        </Animated.View>
      )),
    );
  }

  const statsChip = (
    <View style={[styles.statsChip, { backgroundColor: sticker }]}>
      <Text style={styles.statsBig}>
        {stats.sketches}
        <Text style={styles.statsOf}>/{CHAPTER_SIZE}</Text>
      </Text>
      <Text style={styles.statsSmall}>
        ⏱ {Math.round(stats.minutes)} min{stats.freezes > 0 ? `  ❄️ ${stats.freezes}` : ''}
      </Text>
    </View>
  );

  const host = (
    <Animated.View style={[styles.host, hopStyle]}>
      <Smudge size={72} animated />
    </Animated.View>
  );

  return (
    <>
      {/* Title side: a sticker label, then the mascot's superlative as the chapter headline. */}
      <Animated.View
        style={[
          styles.pocket,
          { top: titleSpot.y, left: leftFor(titleSpot), width: titleSpot.width },
          fade,
        ]}>
        {/* A calm chapter label: colour dot, chapter number, dates, and a thin rule. */}
        <View style={styles.label}>
          <View style={[styles.labelDot, { backgroundColor: sticker }]} />
          <Text style={styles.labelText}>
            Chapter {index + 1} · {formatShortDate(stats.from)}
            {stats.to !== stats.from ? ` – ${formatShortDate(stats.to)}` : ''}
          </Text>
        </View>
        <View style={styles.rule} />

        {complete && reflection ? (
          <Animated.View entering={FadeIn.duration(450)}>
            {tappable('headline', reflection.headline, (active) => (
              <Text style={styles.headline}>
                <Text style={[styles.marker, active && styles.markerActive]}>
                  {reflection.headline.text}
                </Text>
                {reflection.headline.sketchIds.length > 0 && (
                  <Text style={styles.linkHint}>{active ? ' ✕' : ' ↗'}</Text>
                )}
              </Text>
            ))}
          </Animated.View>
        ) : (
          <Text style={[styles.headline, styles.pending]}>
            {complete ? '…' : `${sketches.length} of ${CHAPTER_SIZE}`}
          </Text>
        )}

        {complete && reflection && <Text style={styles.signature}>— {name}</Text>}


        {/* A short chapter has no second pocket: the host sits here instead. */}
        {!hostSpot && (
          <View style={styles.hostBlock}>
            {host}
            <View style={styles.bubbles}>{bubbles}</View>
            {statsChip}
          </View>
        )}
      </Animated.View>

      {/* Host side: the mascot, its speech bubbles, and the chapter's stats. */}
      {hostSpot && (
        <Animated.View
          style={[
            styles.pocket,
            { top: hostSpot.y, left: leftFor(hostSpot), width: hostSpot.width },
            fade,
          ]}>
          <View style={[styles.hostBlock, hostSpot.side > 0 && styles.hostBlockRight]}>
            {host}
            <View style={styles.bubbles}>{bubbles}</View>
            {statsChip}
          </View>
        </Animated.View>
      )}
    </>
  );
}

/** A handwritten speech bubble from the mascot, tail pointing up at it. */
function Bubble({
  children,
  muted,
  active,
  linked,
}: {
  children: ReactNode;
  muted?: boolean;
  active?: boolean;
  linked?: boolean;
}) {
  return (
    <View style={[styles.bubble, active && styles.bubbleActive]}>
      <View style={[styles.tail, active && styles.tailActive]} />
      <Text style={[styles.bubbleText, muted && styles.bubbleMuted]}>
        {children}
        {linked && <Text style={styles.linkHint}>{active ? ' ✕' : ' ↗'}</Text>}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // No backing panel: the sticker, headline and bubbles sit straight on the page.
  pocket: {
    position: 'absolute',
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  labelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: INK,
  },
  labelText: {
    color: MUTED,
    fontSize: 11,
    letterSpacing: 0.2,
    fontFamily: nunito(800),
  },
  rule: {
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: INK,
    opacity: 0.25,
    marginTop: 6,
    marginBottom: 8,
  },
  headline: {
    color: INK,
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.2,
    fontFamily: nunito(800),
  },
  // No highlighter: plain text. Tapped (showing its sketches) = a soft underline.
  marker: {},
  markerActive: {
    textDecorationLine: 'underline',
    textDecorationColor: MUTED,
  },
  pending: {
    color: MUTED,
  },
  // The mascot "signs" its headline, in its handwriting.
  signature: {
    color: INK,
    fontSize: 17,
    marginTop: 2,
    fontFamily: HAND_FONT,
  },
  linkHint: {
    color: MUTED,
    fontSize: 11,
    fontFamily: nunito(800),
  },
  hostBlock: {
    alignItems: 'flex-start',
    gap: 6,
  },
  hostBlockRight: {
    alignItems: 'flex-end',
  },
  // Puff hosts the chapter: big enough to read as the one talking.
  host: {
    marginHorizontal: 2,
    // The bubble tails point up at the mascot.
    marginBottom: -6,
  },
  bubbles: {
    gap: 8,
    alignSelf: 'stretch',
  },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 7,
  },
  bubbleActive: {
    backgroundColor: Palette.creamDeep,
  },
  tail: {
    position: 'absolute',
    top: -6,
    left: 18,
    width: 10,
    height: 10,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1.5,
    borderTopWidth: 1.5,
    borderColor: INK,
    transform: [{ rotate: '45deg' }],
  },
  tailActive: {
    backgroundColor: Palette.creamDeep,
  },
  bubbleText: {
    color: INK,
    fontSize: 17,
    lineHeight: 20,
    fontFamily: HAND_FONT,
  },
  bubbleMuted: {
    color: MUTED,
  },
  statsChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  statsBig: {
    color: INK,
    fontSize: 17,
    fontFamily: nunito(900),
  },
  statsOf: {
    color: INK,
    fontSize: 11,
    fontFamily: nunito(700),
  },
  statsSmall: {
    color: INK,
    fontSize: 11,
    fontFamily: nunito(700),
  },
});
