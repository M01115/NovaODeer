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

import { ANNOTATION_COLORS } from '@/components/annotated-sketch';
import { type ChapterStats, ChapterWrapped, type PocketSpot } from '@/components/chapter-wrapped';
import { SketchThumb } from '@/components/sketch-thumb';
import { Smudge } from '@/components/smudge';
import { groupIntoChapters } from '@/data/chapters';
import { ANNOTATION_LABELS } from '@/data/feedback';
import { formatShortDate, getHistory, type Day } from '@/data/history';
import { getPromptForDate } from '@/data/prompts';
import { REACTIONS } from '@/data/reactions';
import { usePostedToday } from '@/data/today';
import { nunito, Palette } from '@/constants/theme';

const BG = Palette.cream;
const INK = '#161616';
const MUTED = '#8A877F';
const PENCIL = '#CFCBC2';

/** Vertical distance between cards on the path (they overlap, like a pile of prints). */
const SPACING = 100;
/** How much bigger the card nearest the middle of the screen gets. */
const HOVER_SCALE = 1.38;
/** Cards per full left-right wiggle of the S. */
const WIGGLE = 7;
/** Minimum space above the first card (room for the title). */
const MIN_TOP = 150;
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

type Placed = { day: Day; index: number; x: number; y: number };

/**

 * Lives directly above Home: Home's pull-down drags it into view (see app/index.tsx).
 *
 * The sketch archive, laid out like Duolingo's path: sketches sit along a winding S path
 * you scroll through (oldest at the top, newest at the bottom), swinging almost edge to
 * edge every ${WIGGLE} cards. Every 7 completed sketches form a chapter, exactly one swing of
 * the S: its "Sketch Wrapped" (AI title + reflections) sits in the empty pocket beside the
 * first turn, its stats with Smudge beside the second. The card nearest the middle of the
 * screen grows (like hover) and nudges its neighbours apart; tap it to pop it up.
 */
export function ArchiveView({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const history = useMemo(() => getHistory(), []);
  const posted = usePostedToday();
  // Past sketches, plus today's once it's posted (newest at the bottom).
  const sketches = useMemo(() => {
    const done = history.filter((d) => d.status === 'done');
    const today = history.find((d) => d.status === 'today');
    if (!posted || !today) return done;
    const todayDay: Day = {
      ...today,
      prompt: getPromptForDate(),
      status: 'done',
      image: posted.image,
      feedback: posted.feedback,
      analysis: posted.analysis?.feedback,
      minutes: posted.seconds / 60,
    };
    return [...done, todayDay];
  }, [history, posted]);
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

  // Slightly smaller cards than before, so each chapter's Wrapped has room to breathe.
  const cardW = Math.min(width * 0.4, 160);
  // Swing almost edge to edge.
  const amp = Math.max(0, width / 2 - cardW / 2 - 14);
  // Vertical middle of a card, from its top edge.
  const cardMid = (cardW + 24) / 2;
  // Enough room above the first card and below the last that every card, including both
  // ends, can scroll into the middle of the screen and become the hovered one.
  const top = Math.max(MIN_TOP, viewHeight / 2 - cardMid);
  const bottom = Math.max(MIN_TOP, viewHeight / 2 - cardMid + 40);

  // Lay the sketches on the path.
  const placed: Placed[] = useMemo(() => {
    if (!width) return [];
    return sketches.map((day, index) => ({
      day,
      index,
      // A sine wave down the screen: the S.
      x: width / 2 + amp * Math.sin((2 * Math.PI * index) / WIGGLE),
      y: top + index * SPACING,
    }));
  }, [width, sketches, amp, top]);

  // Last card top + its height (cardMid * 2) + room to reach the middle.
  const contentH = top + Math.max(0, last) * SPACING + cardMid * 2 + bottom;

  // Chapters of 7 sketches. Each is one full swing of the S (WIGGLE = 7), so the first
  // half swings to one side and the second half to the other: two free pockets per chapter.
  const chapters = useMemo(() => {
    // Where card i sits on the S (same formula as `placed`), even if it isn't drawn yet.
    const xAt = (i: number) => width / 2 + amp * Math.sin((2 * Math.PI * i) / WIGGLE);
    const yAt = (i: number) => top + i * SPACING;
    return groupIntoChapters(placed).map((chapter) => {
      const cards = chapter.items;
      const s = chapter.start;
      // Each pocket fills the gap between the card that ends just above it and the next card
      // that swings back over its side: beside cards s+2…s+3 (title) and s+5…s+6 (notes).
      // The pocket is as wide as the free space beside those cards (minus a little air).
      const spotBeside = (run: number[], y: number): PocketSpot => {
        const side = xAt(run[0]) >= width / 2 ? -1 : 1;
        const free =
          side < 0
            ? Math.min(...run.map((i) => xAt(i) - cardW / 2)) - 16 - 10
            : width - 16 - Math.max(...run.map((i) => xAt(i) + cardW / 2)) - 10;
        return { y, side, width: Math.min(Math.max(free, 112), 210) };
      };
      const titleSpot = spotBeside([s + 2, s + 3], yAt(s + 2) + 10);
      const hostSpot = cards.length >= 5 ? spotBeside([s + 5, s + 6], yAt(s + 5) - 50) : null;
      const from = cards[0].day.date;
      const to = cards[cards.length - 1].day.date;
      const stats: ChapterStats = {
        from,
        to,
        sketches: cards.length,
        minutes: cards.reduce((sum, p) => sum + (p.day.minutes ?? 0), 0),
        freezes: history.filter((d) => d.status === 'frozen' && d.date >= from && d.date <= to)
          .length,
      };
      return { chapter, titleSpot, hostSpot, stats };
    });
  }, [placed, history, width, amp, top, cardW]);

  // A tapped reflection highlights the sketches it's about (and dims the rest).
  const [highlight, setHighlight] = useState<{ note: string; ids: Set<string> } | null>(null);
  const onHighlight = (note: string | null, ids: string[]) => {
    if (!note) {
      setHighlight(null);
      return;
    }
    setHighlight({ note, ids: new Set(ids) });
    // Bring the first of those sketches to the middle.
    const first = placed.find((p) => ids.includes(p.day.date));
    if (first) centreOn(first.index);
  };

  // Keep React's idea of the middle card in sync, only when it changes.
  useAnimatedReaction(
    () => {
      const centre = scrollY.get() + viewH.get() / 2;
      return Math.min(last, Math.max(0, Math.round((centre - top - cardMid) / SPACING)));
    },
    (current, previous) => {
      if (current === previous) return;
      focus.set(current);
      scheduleOnRN(setFocusIndex, current);
    },
    [top, cardMid, last]
  );

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  const centreOn = (index: number, animated = true) => {
    const y = top + index * SPACING + cardMid - viewH.get() / 2;
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
            <Text style={styles.subline}>
              {sketches.length} sketches · {Math.ceil(sketches.length / WIGGLE)} chapters · scroll
              back in time
            </Text>
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
              highlight={
                !highlight
                  ? undefined
                  : highlight.ids.has(p.day.date)
                    ? 'on'
                    : highlight.note.startsWith(`${Math.floor(p.index / WIGGLE)}:`)
                      ? 'dim'
                      : undefined
              }
              onPress={() => (p.index === focusIndex ? setZoomed(p.day) : centreOn(p.index))}
            />
          ))}

          {/* Each chapter's Sketch Wrapped sits on top, like stickers in the S curve's pockets. */}
          {chapters.map(({ chapter, titleSpot, hostSpot, stats }) => (
            <ChapterWrapped
              key={chapter.index}
              index={chapter.index}
              start={chapter.start}
              complete={chapter.complete}
              sketches={chapter.items.map((p) => ({
                id: p.day.date,
                title: p.day.prompt.text,
                image: p.day.image ?? '',
              }))}
              stats={stats}
              titleSpot={titleSpot}
              hostSpot={hostSpot}
              width={width}
              focus={focus}
              activeNote={highlight?.note ?? null}
              onHighlight={onHighlight}
            />
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
          { bottom: insets.bottom + 16 },
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
  highlight,
  onPress,
}: {
  placed: Placed;
  cardW: number;
  screenW: number;
  index: number;
  focus: SharedValue<number>;
  isFocused: boolean;
  /** 'on': a tapped reflection is about this sketch. 'dim': it's about others in the chapter. */
  highlight?: 'on' | 'dim';
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
      style={[
        styles.card,
        { left: x - cardW / 2, top: y, width: cardW, height: cardH },
        highlight === 'on' && styles.cardHighlighted,
        highlight === 'dim' && styles.cardDimmed,
        style,
      ]}>
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

        {day.analysis?.status === 'ok' ? (
          // Smudge's structured notes: 2 compliments + 1 tip.
          <View style={styles.zoomNotes}>
            {day.analysis.annotations.map((a, i) => (
              <View key={a.id} style={styles.zoomNote}>
                <Text style={[styles.zoomNoteLabel, { color: ANNOTATION_COLORS[a.kind] }]}>
                  {ANNOTATION_LABELS[i]}
                </Text>
                <Text style={styles.zoomFeedbackText}>{a.comment}</Text>
              </View>
            ))}
          </View>
        ) : (
          day.feedback && (
            <View style={styles.zoomFeedback}>
              <Smudge size={44} />
              <Text style={styles.zoomFeedbackText}>{day.feedback}</Text>
            </View>
          )
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
    fontFamily: nunito(700),
    letterSpacing: -0.5,
  },
  subline: {
    color: MUTED,
    fontSize: 13,
    fontFamily: nunito(600),
    marginTop: 4,
  },
  card: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.10)',
  },
  cardHighlighted: {
    // Highlighter-yellow ring: "this is one of them".
    borderWidth: 3,
    borderColor: '#E8C547',
  },
  cardDimmed: {
    opacity: 0.35,
  },
  zoomNotes: {
    alignSelf: 'stretch',
    gap: 8,
  },
  zoomNote: {
    gap: 1,
  },
  zoomNoteLabel: {
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
    fontFamily: nunito(600),
  },
  cardDate: {
    color: MUTED,
    fontSize: 10.5,
    fontFamily: nunito(500),
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
    fontFamily: nunito(700),
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
    fontFamily: nunito(800),
  },
  statsOf: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 21,
    fontFamily: nunito(700),
  },
  statsCaption: {
    color: INK,
    fontSize: 10.5,
    fontFamily: nunito(600),
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 5,
  },
  statsSmall: {
    color: INK,
    fontSize: 10.5,
    fontFamily: nunito(600),
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
    fontFamily: nunito(700),
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
    fontFamily: nunito(600),
  },
  zoomTitle: {
    color: INK,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: nunito(700),
  },
  zoomClose: {
    color: INK,
    fontSize: 16,
    fontFamily: nunito(700),
    padding: 4,
  },
  zoomFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
  },
  zoomFeedbackText: {
    fontFamily: nunito(400),
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
    fontFamily: nunito(400),
    fontSize: 20,
  },
  reactionCount: {
    color: MUTED,
    fontSize: 11,
    fontFamily: nunito(700),
  },
});
