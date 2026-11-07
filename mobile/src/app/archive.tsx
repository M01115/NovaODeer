import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  FadeOut,
  interpolate,
  Keyframe,
  ReduceMotion,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { SketchThumb } from '@/components/sketch-thumb';
import { Smudge } from '@/components/smudge';
import { formatShortDate, getHistory, type Day } from '@/data/history';
import { REACTIONS } from '@/data/reactions';

const BG = '#F2F1EE';
const INK = '#161616';
const MUTED = '#8A877F';
/** Label dots, from the team's "color archive" palette. */
const DOTS = ['#462E24', '#A4BCD4', '#490B0C', '#E2C98A', '#1D120E'];

/** Points of drag per card when scrubbing through the stack. */
const DRAG_PER_CARD = 90;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Archive drops in from above (it lives "above" Home).
const dropIn = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -48 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
})
  .duration(320)
  .reduceMotion(ReduceMotion.System);

// The tapped card pops up and enlarges.
const popIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.9 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
})
  .duration(240)
  .reduceMotion(ReduceMotion.System);

/**
 * The sketch archive: past sketches as a diagonal stack of cards. The middle card is
 * fully exposed (like a hover); drag to move through the stack, tap a card to bring it
 * to the middle, tap the middle one to pop it up.
 */
export default function ArchiveScreen() {
  const insets = useSafeAreaInsets();
  const sketches = useMemo(() => getHistory().filter((d) => d.status === 'done'), []);
  const last = sketches.length - 1;

  const [stage, setStage] = useState<{ width: number; height: number } | null>(null);
  const [focusIndex, setFocusIndex] = useState(last);
  const [zoomed, setZoomed] = useState<Day | null>(null);

  // Which card is in the middle, as a float so the stack can move between cards.
  const focus = useSharedValue(last);
  const dragStart = useSharedValue(last);

  // Keep React's idea of the middle card in sync, only when it actually changes.
  useAnimatedReaction(
    () => Math.round(focus.get()),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(setFocusIndex, current);
    }
  );

  const pan = usePanGesture({
    activeOffsetY: [-10, 10],
    onBegin: () => {
      'worklet';
      dragStart.set(focus.get());
    },
    onUpdate: (e) => {
      'worklet';
      // Pull down = older cards come forward from the top right.
      const raw = dragStart.get() - e.translationY / DRAG_PER_CARD;
      // Rubber-band past either end of the stack.
      const over = raw < 0 ? raw : raw > last ? raw - last : 0;
      focus.set(raw - over + over * 0.35);
    },
    onDeactivate: (e) => {
      'worklet';
      const velocity = -e.velocityY / DRAG_PER_CARD;
      const projected = focus.get() + velocity * 0.15;
      const target = Math.min(last, Math.max(0, Math.round(projected)));
      focus.set(
        withSpring(target, {
          duration: 400,
          dampingRatio: 0.8,
          velocity,
          reduceMotion: ReduceMotion.System,
        })
      );
    },
  });

  const goTo = (index: number) => {
    focus.set(withSpring(index, { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System }));
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  };

  return (
    <Animated.View entering={dropIn} style={[styles.page, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.headline}>Sketched anywhere.</Text>
        <Text style={[styles.headline, styles.headlineMuted]}>Kept in one place.</Text>
        <Text style={styles.count}>
          {focusIndex + 1} / {sketches.length} · drag to flip through
        </Text>
      </View>

      <GestureDetector gesture={pan}>
        <View style={styles.stage} onLayout={onStageLayout}>
          {stage &&
            sketches.map((day, i) => (
              <StackCard
                key={day.date}
                day={day}
                index={i}
                focus={focus}
                stage={stage}
                isFocused={i === focusIndex}
                onPress={() => (i === focusIndex ? setZoomed(day) : goTo(i))}
              />
            ))}
        </View>
      </GestureDetector>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to today"
        onPress={close}
        hitSlop={12}
        style={[styles.back, { marginBottom: insets.bottom + 12 }]}>
        <Text style={styles.backArrow}>︿</Text>
        <Text style={styles.backText}>Back to today</Text>
      </Pressable>

      {zoomed && <ZoomedSketch day={zoomed} onClose={() => setZoomed(null)} />}
    </Animated.View>
  );
}

function StackCard({
  day,
  index,
  focus,
  stage,
  isFocused,
  onPress,
}: {
  day: Day;
  index: number;
  focus: SharedValue<number>;
  stage: { width: number; height: number };
  isFocused: boolean;
  onPress: () => void;
}) {
  const cardW = Math.min(stage.width * 0.6, 240);
  const imageSize = cardW - 16;
  const cardH = imageSize + 16 + 40;

  // Middle card's top-left corner.
  const baseX = (stage.width - cardW) / 2 + 12;
  const baseY = (stage.height - cardH) / 2 - 10;

  // Behind (older): step up and to the right. In front (newer): jump well clear to the
  // bottom left so the middle card stays fully visible, then step on from there.
  const stepX = Math.min(30, stage.width * 0.075);
  const stepY = 34;
  const clearX = cardW * 0.66;
  const clearY = cardH * 1.05;

  const style = useAnimatedStyle(() => {
    const d = index - focus.get();
    return {
      opacity: interpolate(d, [-7, -5.5, 3, 4.5], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        {
          translateX: interpolate(
            d,
            [-8, 0, 1, 6],
            [8 * stepX, 0, -clearX, -clearX - 5 * stepX],
            Extrapolation.EXTEND
          ),
        },
        {
          translateY: interpolate(
            d,
            [-8, 0, 1, 6],
            [-8 * stepY, 0, clearY, clearY + 5 * stepY],
            Extrapolation.EXTEND
          ),
        },
        // The middle card is a touch bigger: the "hovered" one.
        { scale: interpolate(d, [-8, -1, 0, 1], [0.82, 0.94, 1, 0.94], Extrapolation.CLAMP) },
      ],
    };
  });

  const dot = DOTS[index % DOTS.length];

  return (
    <Animated.View
      style={[styles.card, { left: baseX, top: baseY, width: cardW, height: cardH }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${day.prompt.text}, ${formatShortDate(day.date)}${isFocused ? ', open' : ''}`}
        onPress={onPress}
        style={styles.cardInner}>
        <SketchThumb
          size={imageSize}
          imageUri={day.imageUri}
          emoji={day.prompt.emoji}
          shape="card"
        />
        <View style={styles.cardFooter}>
          <Text numberOfLines={1} style={styles.cardLabel}>
            {day.prompt.text.toUpperCase()}
          </Text>
          <Text style={styles.cardDate}>{formatShortDate(day.date)}</Text>
          <View style={[styles.dot, { backgroundColor: dot }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** The middle card, popped up and enlarged, with Smudge's note and friends' reactions. */
function ZoomedSketch({ day, onClose }: { day: Day; onClose: () => void }) {
  // Placeholder counts until reactions come from the backend.
  const counts = [12, 7, 5, 3, 2, 1];

  return (
    <Animated.View exiting={FadeOut.duration(150)} style={styles.zoomLayer}>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
      <Animated.View entering={popIn} style={styles.zoomCard}>
        <View style={styles.zoomHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.zoomDate}>{formatShortDate(day.date)}</Text>
            <Text style={styles.zoomTitle}>{day.prompt.text}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
            <Text style={styles.zoomClose}>✕</Text>
          </Pressable>
        </View>

        <SketchThumb size={300} imageUri={day.imageUri} emoji={day.prompt.emoji} shape="card" />

        {day.feedback && (
          <View style={styles.zoomFeedback}>
            <Smudge size={44} />
            <Text style={styles.zoomFeedbackText}>{day.feedback}</Text>
          </View>
        )}

        <View style={styles.reactions}>
          {REACTIONS.map((r, i) => (
            <View key={r} style={styles.reaction}>
              <Text style={styles.reactionEmoji}>{r}</Text>
              <Text style={styles.reactionCount}>{counts[i]}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: BG,
    // Dragging the stack with a mouse (web preview) shouldn't select text.
    userSelect: 'none',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 2,
  },
  headline: {
    color: INK,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
    letterSpacing: -0.5,
  },
  headlineMuted: {
    color: MUTED,
  },
  count: {
    color: MUTED,
    fontSize: 12,
    marginTop: 10,
    fontWeight: 600,
    letterSpacing: 0.3,
  },
  stage: {
    flex: 1,
    // Let the stack bleed past the header and edges, like a pile of prints.
    overflow: 'visible',
  },
  card: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.10)',
  },
  cardInner: {
    flex: 1,
    padding: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 4,
  },
  cardLabel: {
    flex: 1,
    color: INK,
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 0.6,
  },
  cardDate: {
    color: MUTED,
    fontSize: 10.5,
    fontWeight: 600,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  back: {
    alignSelf: 'center',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    // Sits above any cards that cascade down this far.
    backgroundColor: BG,
  },
  backArrow: {
    color: INK,
    fontSize: 18,
    lineHeight: 16,
    fontWeight: 700,
  },
  backText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: 600,
  },
  zoomLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(22, 22, 22, 0.35)',
  },
  zoomCard: {
    width: 340,
    maxWidth: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    gap: 14,
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
  },
  zoomHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
  },
  zoomDate: {
    color: MUTED,
    fontSize: 12,
    fontWeight: 600,
  },
  zoomTitle: {
    color: INK,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  zoomClose: {
    color: INK,
    fontSize: 16,
    fontWeight: 700,
    padding: 4,
  },
  zoomFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
  },
  zoomFeedbackText: {
    flex: 1,
    color: INK,
    fontSize: 13,
    lineHeight: 18,
  },
  reactions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  reaction: {
    alignItems: 'center',
    gap: 2,
  },
  reactionEmoji: {
    fontSize: 20,
  },
  reactionCount: {
    color: MUTED,
    fontSize: 11,
    fontWeight: 700,
  },
});
