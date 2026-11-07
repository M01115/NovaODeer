import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { SketchThumb } from '@/components/sketch-thumb';
import { Smudge } from '@/components/smudge';
import { ThemedText } from '@/components/themed-text';
import { Colors, Ink } from '@/constants/theme';
import { formatShortDate, type Day } from '@/data/history';
import { useTheme } from '@/hooks/use-theme';

/** Vertical distance between nodes. */
const SPACING = 116;
/** Space above the first node. */
const TOP = 72;
/** Space below the last node. */
const BOTTOM = 200;
/** Side-to-side wiggle, as a fraction of the amplitude. Repeats every 8 nodes. */
const WIGGLE = [0, 0.6, 1, 0.6, 0, -0.6, -1, -0.6];

const SIZES = { done: 72, frozen: 64, missed: 56, today: 92, locked: 60 } as const;
const DEPTH = 5; // height of the 3D "lip" under each node

// Paper and ink: black ink rings and line, pencil-grey lips and future path.
const COLORS = {
  accent: Ink.ink,
  accentDark: Ink.inkLip,
  ring: Ink.ink,
  ringDark: Ink.pencil,
  ice: '#EAF4FA',
  iceDark: '#C6DAE6',
  card: Ink.paper,
};

/** Extra room above and below today's node for its bigger size and the TODAY bubble. */
const TODAY_GAP = 46;

export function getNodeY(index: number, todayIndex: number) {
  let y = TOP + index * SPACING;
  if (todayIndex >= 0 && index >= todayIndex) y += TODAY_GAP;
  if (todayIndex >= 0 && index > todayIndex) y += TODAY_GAP;
  return y;
}

export function getPathHeight(count: number, todayIndex: number) {
  return getNodeY(count - 1, todayIndex) + BOTTOM;
}

type Props = {
  days: Day[];
  width: number;
  /** Today's node was tapped. */
  onPressToday: () => void;
  /** "See my sketch" was tapped in a past day's popover. */
  onOpenSketch: (day: Day) => void;
};

/**
 * Duolingo-style winding path: past sketches, today's node, then locked days,
 * joined by a curved line.
 */
export function SketchPath({ days, width, onPressToday, onOpenSketch }: Props) {
  // Past day whose popover is open (Duolingo-style card under the node).
  const [selected, setSelected] = useState<string | null>(null);
  const amplitude = Math.min(width * 0.26, 100);
  const todayIndex = days.findIndex((d) => d.status === 'today');
  const selectedIndex = selected ? days.findIndex((d) => d.date === selected) : -1;

  const points = days.map((_, i) => ({
    x: width / 2 + WIGGLE[i % WIGGLE.length] * amplitude,
    y: getNodeY(i, todayIndex),
  }));

  return (
    <View style={{ width, height: getPathHeight(days.length, todayIndex) }}>
      {/* The curved line, drawn one segment at a time so the future part can be dashed. */}
      <Svg width={width} height={getPathHeight(days.length, todayIndex)} style={StyleSheet.absoluteFill}>
        {points.slice(0, -1).map((a, i) => {
          const b = points[i + 1];
          const midY = (a.y + b.y) / 2;
          const reached = i + 1 <= todayIndex;
          return (
            <Path
              key={i}
              d={`M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`}
              stroke={reached ? COLORS.ring : Ink.pencil}
              strokeWidth={reached ? 5 : 4}
              strokeLinecap="round"
              strokeDasharray={reached ? undefined : '2 12'}
              fill="none"
            />
          );
        })}
      </Svg>

      {days.map((day, i) => {
        const { x, y } = points[i];
        const size = SIZES[day.status];
        return (
          <View
            key={day.date}
            style={[styles.nodeSlot, { left: x - 60, top: y - size / 2, width: 120 }]}>
            {day.status === 'today' && <TodayBubble />}
            <Node
              day={day}
              size={size}
              onPress={() => {
                if (day.status === 'today') onPressToday();
                else setSelected((cur) => (cur === day.date ? null : day.date));
              }}
            />
            <NodeLabel day={day} />
          </View>
        );
      })}

      {/* Smudge cheers you on beside today's node, on the roomier side. */}
      {todayIndex >= 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.smudge,
            {
              top: points[todayIndex].y - 50,
              left:
                points[todayIndex].x >= width / 2
                  ? points[todayIndex].x - SIZES.today / 2 - 104
                  : points[todayIndex].x + SIZES.today / 2 + 16,
            },
          ]}>
          <Smudge size={84} />
        </View>
      )}

      {selectedIndex >= 0 && (
        <>
          {/* Tap anywhere else on the path to close the popover. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          <DayPopover
            day={days[selectedIndex]}
            width={width}
            nodeX={points[selectedIndex].x}
            top={points[selectedIndex].y + SIZES[days[selectedIndex].status] / 2 + DEPTH + 28}
            onOpen={() => {
              setSelected(null);
              onOpenSketch(days[selectedIndex]);
            }}
          />
        </>
      )}
    </View>
  );
}

const POPOVER_MARGIN = 16;

/** Card under a past node: the drawing, and an arrow button to see it full size. */
function DayPopover({
  day,
  width,
  nodeX,
  top,
  onOpen,
}: {
  day: Day;
  width: number;
  nodeX: number;
  top: number;
  onOpen: () => void;
}) {
  const tailLeft = Math.min(Math.max(nodeX - POPOVER_MARGIN - 10, 20), width - POPOVER_MARGIN * 2 - 40);

  let title = day.prompt.text;
  let body: string | null = null;
  if (day.status === 'frozen') {
    title = 'Streak freeze ❄️';
    body = 'You missed this one, but a freeze kept your streak alive.';
  }
  if (day.status === 'missed') {
    title = 'Rest day';
    body = 'Everyone needs a break. Smudge napped too.';
  }

  return (
    <View style={[styles.popover, { top, left: POPOVER_MARGIN, right: POPOVER_MARGIN }]}>
      <View style={[styles.popoverTail, { left: tailLeft, backgroundColor: COLORS.card }]} />
      <View style={[styles.popoverCard, { backgroundColor: COLORS.card }]}>
        <View style={styles.popoverRow}>
          {day.status === 'done' && (
            <SketchThumb size={72} imageUri={day.imageUri} emoji={day.prompt.emoji} shape="card" />
          )}
          <View style={styles.popoverText}>
            <ThemedText type="small" themeColor="textSecondary">
              {formatShortDate(day.date)}
            </ThemedText>
            <ThemedText type="smallBold" style={styles.popoverTitle}>
              {title}
            </ThemedText>
            {body && (
              <ThemedText type="small" themeColor="textSecondary">
                {body}
              </ThemedText>
            )}
          </View>
        </View>

        {day.status === 'done' && (
          <Pressable accessibilityRole="button" onPress={onOpen}>
            {({ pressed }) => (
              <View style={[styles.popoverButton, pressed && styles.popoverButtonPressed]}>
                <Text style={styles.popoverButtonText}>SEE MY SKETCH  →</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Node({ day, size, onPress }: { day: Day; size: number; onPress: () => void }) {
  const theme = useTheme();

  switch (day.status) {
    case 'done':
      return (
        <Raised size={size} top={COLORS.ring} bottom={COLORS.ringDark} onPress={onPress}>
          <SketchThumb size={size - 10} imageUri={day.imageUri} emoji={day.prompt.emoji} />
        </Raised>
      );
    case 'today':
      return (
        <View style={[styles.glow, { borderColor: Ink.pencil }]}>
          <Raised size={size} top={COLORS.accent} bottom={COLORS.accentDark} onPress={onPress}>
            <Text style={{ fontSize: size * 0.42 }}>✏️</Text>
          </Raised>
        </View>
      );
    case 'frozen':
      return (
        <Raised size={size} top={COLORS.ice} bottom={COLORS.iceDark} onPress={onPress}>
          <Text style={{ fontSize: size * 0.42 }}>❄️</Text>
        </Raised>
      );
    case 'missed':
      return (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={[
            styles.missed,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: theme.backgroundSelected,
              backgroundColor: theme.background,
            },
          ]}>
          <Text style={[styles.missedDots, { color: theme.textSecondary }]}>z z</Text>
        </Pressable>
      );
    case 'locked':
      return (
        <Raised size={size} top={theme.backgroundElement} bottom={theme.backgroundSelected}>
          <Text style={{ fontSize: size * 0.34, opacity: 0.6 }}>🔒</Text>
        </Raised>
      );
  }
}

/** A circle with a darker lip underneath, so it looks pressable (and sinks when pressed). */
function Raised({
  size,
  top,
  bottom,
  onPress,
  children,
}: {
  size: number;
  top: string;
  bottom: string;
  onPress?: () => void;
  children: ReactNode;
}) {
  const circle = { width: size, height: size, borderRadius: size / 2 };
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={{ width: size, height: size + DEPTH }}>
      {({ pressed }) => (
        <>
          <View style={[styles.abs, circle, { top: DEPTH, backgroundColor: bottom }]} />
          <View
            style={[
              styles.abs,
              styles.center,
              circle,
              { top: pressed ? DEPTH : 0, backgroundColor: top },
            ]}>
            {children}
          </View>
        </>
      )}
    </Pressable>
  );
}

function TodayBubble() {
  return (
    <View style={styles.bubbleWrap} pointerEvents="none">
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>TODAY</Text>
      </View>
      <View style={styles.bubbleTail} />
    </View>
  );
}

function NodeLabel({ day }: { day: Day }) {
  let text: string | null = null;
  if (day.status === 'done') text = formatShortDate(day.date);
  if (day.status === 'frozen') text = 'Freeze used';
  if (day.status === 'missed') text = 'Rest day';
  if (day.status === 'today') text = 'Tap to start';
  if (!text) return null;

  return (
    <ThemedText
      type="small"
      themeColor={day.status === 'today' ? 'text' : 'textSecondary'}
      style={styles.label}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  popover: {
    position: 'absolute',
  },
  popoverTail: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 20,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  popoverCard: {
    borderRadius: 20,
    padding: 16,
    gap: 14,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  },
  popoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  popoverText: {
    flex: 1,
    gap: 2,
  },
  popoverTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  popoverButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#000',
  },
  popoverButtonPressed: {
    borderBottomWidth: 0,
    marginTop: 4,
  },
  popoverButtonText: {
    color: '#fff',
    fontWeight: 800,
    fontSize: 15,
    letterSpacing: 1,
  },
  abs: {
    position: 'absolute',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeSlot: {
    position: 'absolute',
    alignItems: 'center',
  },
  glow: {
    padding: 6,
    margin: -9,
    borderWidth: 3,
    borderRadius: 100,
  },
  missed: {
    borderWidth: 3,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missedDots: {
    fontSize: 14,
    fontWeight: 700,
  },
  label: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 6,
    borderRadius: 6,
    overflow: 'hidden',
    // Paper behind the text so the path line passes under the label.
    backgroundColor: Colors.light.background,
  },
  smudge: {
    position: 'absolute',
  },
  bubbleWrap: {
    position: 'absolute',
    top: -44,
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  bubbleText: {
    color: COLORS.accent,
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: 1,
  },
  bubbleTail: {
    width: 12,
    height: 12,
    marginTop: -7,
    backgroundColor: '#fff',
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: COLORS.accent,
    transform: [{ rotate: '45deg' }],
  },
});
