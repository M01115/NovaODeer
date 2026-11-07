import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  Keyframe,
  ReduceMotion,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { SketchThumb } from '@/components/sketch-thumb';
import { Smudge } from '@/components/smudge';
import { BottomTabInset } from '@/constants/theme';
import { formatShortDate, fromDateKey, getHistory, getWeekStats, toDateKey, type Day } from '@/data/history';
import { REACTIONS } from '@/data/reactions';

const BG = '#F2F1EE';
const INK = '#161616';
const MUTED = '#8A877F';
const PENCIL = '#CFCBC2';

/** Vertical distance between cards on the path (they overlap, like a pile of prints). */
const SPACING = 100;
/** How much bigger the card nearest the middle of the screen gets. */
const HOVER_SCALE = 1.45;
/** Cards per full left-right wiggle of the S. */
const WIGGLE = 7;
/** Space above the first card, for the title. */
const TOP = 150;
/** Space below the last card, so it can reach the middle of the screen. */
const BOTTOM = 460;
/** Height of the prompt/date strip at the top of each card. */
const HEADER_H = 24;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// The tapped card pops up and enlarges.
const popIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.9 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
})
  .duration(240)
  .reduceMotion(ReduceMotion.System);

type Placed = { day: Day; index: number; week: number; x: number; y: number };

/**

 * Lives directly above Home: Home's pull-down drags it into view (see (tabs)/index.tsx).
 *
 * The sketch archive, laid out like Duolingo's path: sketches sit along a winding S path
 * you scroll through (oldest at the top, newest at the bottom), swinging almost edge to
 * edge every ${WIGGLE} cards. Each week's stats sit in the empty pocket beside its turn, with
 * Smudge. The card nearest the middle of the screen grows (like hover) and nudges its
 * neighbours apart; tap it to pop it up.
 */
export function ArchiveView({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const history = useMemo(() => getHistory(), []);
  const sketches = useMemo(() => history.filter((d) => d.status === 'done'), [history]);
  const last = sketches.length - 1;

  const [width, setWidth] = useState(0);
  const [focusIndex, setFocusIndex] = useState(last);
  const [viewHeight, setViewHeight] = useState(0);
  // The one hovered card (nearest the middle of the screen), on the UI thread.
  const focus = useSharedValue(last);
  const [zoomed, setZoomed] = useState<Day | null>(null);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const viewH = useSharedValue(0);
  const landed = useRef(false);

  const cardW = Math.min(width * 0.46, 185);
  // Swing almost edge to edge.
  const amp = Math.max(0, width / 2 - cardW / 2 - 14);
  // Vertical middle of a card, from its top edge.
  const cardMid = (cardW + 24) / 2;

  // Lay the sketches on the path. Weeks count from the first day in the history.
  const firstDay = history[0]?.date;
  const placed: Placed[] = useMemo(() => {
    if (!width || !firstDay) return [];
    const start = fromDateKey(firstDay).getTime();
    const weekOf = (d: Day) => Math.floor((fromDateKey(d.date).getTime() - start) / (7 * 86_400_000));
    return sketches.map((day, index) => ({
      day,
      index,
      week: weekOf(day),
      // A sine wave down the screen: the S.
      x: width / 2 + amp * Math.sin((2 * Math.PI * index) / WIGGLE),
      y: TOP + index * SPACING,
    }));
  }, [width, firstDay, sketches, amp]);

  const contentH = TOP + Math.max(0, last) * SPACING + BOTTOM;

  // One stats pocket per week, on the side the path isn't using.
  const pockets = useMemo(() => {
    const weeks = new Map<number, Placed[]>();
    placed.forEach((p) => weeks.set(p.week, [...(weeks.get(p.week) ?? []), p]));
    // Stats never run past yesterday (today has no sketch yet).
    const todayKey = history.find((d) => d.status === 'today')?.date ?? firstDay;
    const t = fromDateKey(todayKey);
    const yesterday = toDateKey(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1));
    return [...weeks.entries()].map(([week, cards]) => {
      // Sit beside the week's sharpest turn, on the side the path isn't using.
      const turn = cards.reduce((a, b) => (Math.abs(b.x - width / 2) > Math.abs(a.x - width / 2) ? b : a));
      const side = turn.x >= width / 2 ? -1 : 1;
      const weekEndDate = new Date(fromDateKey(firstDay).getTime() + (week * 7 + 6) * 86_400_000);
      const weekEnd = toDateKey(weekEndDate) > yesterday ? yesterday : toDateKey(weekEndDate);
      return { week, side, y: turn.y - 10, stats: getWeekStats(weekEnd, history) };
    });
  }, [placed, firstDay, history, width]);

  // Keep React's idea of the middle card in sync, only when it changes.
  useAnimatedReaction(
    () => {
      const centre = scrollY.get() + viewH.get() / 2;
      return Math.min(last, Math.max(0, Math.round((centre - TOP - cardMid) / SPACING)));
    },
    (current, previous) => {
      if (current === previous) return;
      focus.set(current);
      scheduleOnRN(setFocusIndex, current);
    }
  );

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  const centreOn = (index: number, animated = true) => {
    const y = TOP + index * SPACING + cardMid - viewH.get() / 2;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated });
  };


  // Open at the bottom (the newest sketch, closest to today), once the layout is known.
  useEffect(() => {
    if (landed.current || !width) return;
    landed.current = true;
    const id = setTimeout(() => centreOn(last, false), 0);
    return () => clearTimeout(id);
  });

  const onLayout = (e: LayoutChangeEvent) => {
    viewH.set(e.nativeEvent.layout.height);
    setViewHeight(e.nativeEvent.layout.height);
    setWidth(e.nativeEvent.layout.width);
  };

  // The S path line through the card centres.
  const pathD = placed
    .map((p, i) => {
      const cy = p.y + cardMid;
      if (i === 0) return `M ${p.x} ${cy}`;
      const prev = placed[i - 1];
      const py = prev.y + cardMid;
      const midY = (py + cy) / 2;
      return `C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${cy}`;
    })
    .join(' ');

  return (
    <View style={styles.page} onLayout={onLayout}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        // On iPhone, scrolling comes to rest with one card exactly in the middle.
        snapToOffsets={placed.map((pl) => Math.max(0, pl.y + cardMid - viewHeight / 2))}
        decelerationRate="fast">
        <View style={{ height: contentH }}>
          <View style={[styles.title, { paddingTop: insets.top + 24 }]}>
            <Text style={styles.headline}>Your sketch archive</Text>
            <Text style={styles.subline}>{sketches.length} sketches · scroll back in time</Text>
          </View>

          {width > 0 && (
            <Svg width={width} height={contentH} style={StyleSheet.absoluteFill}>
              <Path
                d={pathD}
                stroke={PENCIL}
                strokeWidth={4}
                strokeDasharray="2 12"
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          )}

          {placed.map((p) => (
            <PathCard
              key={p.day.date}
              placed={p}
              cardW={cardW}
              screenW={width}
              index={p.index}
              focus={focus}
              isFocused={p.index === focusIndex}
              onPress={() => (p.index === focusIndex ? setZoomed(p.day) : centreOn(p.index))}
            />
          ))}

          {/* Weekly stats sit on top, like stickers in the S curve's pockets. */}
          {pockets.map((p) => (
            <WeekPocket key={p.week} pocket={p} width={width} />
          ))}
        </View>
      </Animated.ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to today"
        onPress={onClose}
        hitSlop={8}
        style={({ pressed }) => [
          styles.todayPill,
          { bottom: insets.bottom + BottomTabInset + 16 },
          pressed && styles.pressed,
        ]}>
        <Text style={styles.todayText}>︿  Back to today</Text>
      </Pressable>

      {zoomed && <ZoomedSketch day={zoomed} onClose={() => setZoomed(null)} />}
    </View>
  );
}

function PathCard({
  placed,
  cardW,
  screenW,
  index,
  focus,
  isFocused,
  onPress,
}: {
  placed: Placed;
  cardW: number;
  screenW: number;
  index: number;
  focus: SharedValue<number>;
  isFocused: boolean;
  onPress: () => void;
}) {
  const { day, x, y } = placed;
  const imageSize = cardW - 12;
  const cardH = 6 + HEADER_H + imageSize + 6;

  // How far the hovered card's growth pushes its neighbours away. Older cards (above) sit
  // under it anyway; newer cards (below) are on top, so they move down until only a thin
  // strip still overlaps the hovered card.
  const pushUp = ((HOVER_SCALE - 1) * cardH) / 2 + 8;
  const pushDown = Math.max(pushUp, (cardH * (1 + HOVER_SCALE)) / 2 - SPACING - 28);

  // Exactly one card is hovered: the one nearest the middle of the screen. It grows, stays
  // inside the screen, and the cards above and below step aside. Changes ease over 200ms.
  const style = useAnimatedStyle(() => {
    const f = focus.get();
    const hovered = index === f;
    const scale = hovered ? HOVER_SCALE : 1;
    const pushY = index < f ? -pushUp : index > f ? pushDown : 0;
    // Keep the grown card on screen: slide it in from the edge if it would spill over.
    const grownW = cardW * scale;
    const grownLeft = x - grownW / 2;
    const clampedLeft = Math.min(Math.max(grownLeft, 12), screenW - 12 - grownW);
    const timing = { duration: 200, easing: EASE_OUT, reduceMotion: ReduceMotion.System };
    // No z-index boost: newer cards (closer to today) always stay on top, even over the hovered one.
    return {
      transform: [
        { translateX: withTiming(clampedLeft - grownLeft, timing) },
        { translateY: withTiming(pushY, timing) },
        { scale: withTiming(scale, timing) },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.card, { left: x - cardW / 2, top: y, width: cardW, height: cardH }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${day.prompt.text}, ${formatShortDate(day.date)}${isFocused ? ', open' : ''}`}
        onPress={onPress}
        style={styles.cardInner}>
        <View style={styles.cardHeader}>
          <Text numberOfLines={1} style={styles.cardLabel}>
            {day.prompt.text}
          </Text>
          <Text style={styles.cardDate}>{formatShortDate(day.date)}</Text>
        </View>
        <SketchThumb size={imageSize} image={day.image} emoji={day.prompt.emoji} shape="card" />
      </Pressable>
    </Animated.View>
  );
}

/** A week's stats, pinned in the pocket beside that week's stretch of path, with Smudge. */
function WeekPocket({
  pocket,
  width,
}: {
  pocket: { side: number; y: number; stats: ReturnType<typeof getWeekStats> };
  width: number;
}) {
  const w = Math.min(width * 0.27, 108);
  const left = pocket.side < 0 ? 18 : width - 18 - w;
  const { stats } = pocket;

  return (
    <View pointerEvents="none" style={[styles.pocket, { top: pocket.y, left, width: w }]}>
      <View style={[styles.pocketMascot, pocket.side > 0 && styles.pocketMascotRight]}>
        <Smudge size={40} animated />
      </View>
      <View style={styles.statsCard}>
        <Text style={styles.statsRange}>
          {formatShortDate(stats.from)} – {formatShortDate(stats.to)}
        </Text>
        <View style={styles.statsBigRow}>
          <Text style={styles.statsBig}>{stats.sketched}</Text>
          <Text style={styles.statsOf}>/7</Text>
        </View>
        <Text style={styles.statsCaption}>days sketched</Text>
        <View style={styles.statsRow}>
          <Text style={styles.statsSmall}>⏱ {Math.round(stats.minutes * 10) / 10} min</Text>
          {stats.freezes > 0 && <Text style={styles.statsSmall}>❄️ {stats.freezes}</Text>}
        </View>
      </View>
    </View>
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

        <SketchThumb size={300} image={day.image} emoji={day.prompt.emoji} shape="card" />

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
    // Scrolling with a mouse (web preview) shouldn't select text.
    userSelect: 'none',
  },
  title: {
    paddingHorizontal: 24,
  },
  headline: {
    color: INK,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
    letterSpacing: -0.5,
  },
  subline: {
    color: MUTED,
    fontSize: 13,
    fontWeight: 600,
    marginTop: 4,
  },
  card: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.10)',
  },
  cardInner: {
    flex: 1,
    padding: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: HEADER_H,
    paddingHorizontal: 4,
  },
  cardLabel: {
    flex: 1,
    color: INK,
    fontSize: 11,
    fontWeight: 600,
  },
  cardDate: {
    color: MUTED,
    fontSize: 10.5,
    fontWeight: 500,
  },
  pocket: {
    position: 'absolute',
  },
  pocketMascot: {
    alignSelf: 'flex-start',
    marginLeft: 8,
    // Sits on the stats card.
    marginBottom: -11,
    zIndex: 1,
  },
  pocketMascotRight: {
    alignSelf: 'flex-end',
    marginLeft: 0,
    marginRight: 10,
  },
  statsCard: {
    backgroundColor: '#E8E6E0',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingTop: 13,
    paddingBottom: 9,
  },
  statsRange: {
    color: MUTED,
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  statsBigRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  statsBig: {
    color: INK,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: 800,
  },
  statsOf: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 21,
    fontWeight: 700,
  },
  statsCaption: {
    color: INK,
    fontSize: 10.5,
    fontWeight: 600,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 5,
  },
  statsSmall: {
    color: INK,
    fontSize: 10.5,
    fontWeight: 600,
  },
  todayPill: {
    position: 'absolute',
    alignSelf: 'center',
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.18)',
  },
  todayText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
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
