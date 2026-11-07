import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, ZoomIn } from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { Ink } from '@/constants/theme';
import type { Annotation, AnnotationKind } from '@/data/feedback';

/**
 * Compliments are circled in the app's red ink. The improvement tip uses a calm blue,
 * dashed, so it reads as "try this" and never as a warning.
 */
export const ANNOTATION_COLORS: Record<AnnotationKind, string> = {
  compliment: Ink.red,
  improvement: '#4F86B5',
};

/** Badge text: 1 and 2 for the compliments, a pencil for the tip. */
export function badgeFor(annotation: Annotation, index: number) {
  return annotation.kind === 'improvement' ? '✎' : String(index + 1);
}

/** Room around the detail so the circle doesn't sit on top of the lines. */
const PADDING = 1.3;
/** Smallest circle radius (pt), so tiny details still get a tappable circle. */
const MIN_RADIUS = 20;

/**
 * A hand-drawn loop around an ellipse: starts a little before the top, goes once around,
 * and overshoots, like someone circling something with a pen.
 */
function loopPath(cx: number, cy: number, rx: number, ry: number) {
  const steps = 48;
  const start = -Math.PI * 0.62;
  const sweep = Math.PI * 2.18;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = start + sweep * t;
    // Slight wobble and a spiral, so the loop doesn't close perfectly.
    const wobble = 1 + 0.035 * Math.sin(t * Math.PI * 5) + 0.07 * (t - 0.5);
    d += `${i === 0 ? 'M' : 'L'} ${(cx + Math.cos(a) * rx * wobble).toFixed(1)} ${(cy + Math.sin(a) * ry * wobble).toFixed(1)} `;
  }
  return d;
}

type Props = {
  source: ImageSource | string;
  /** Aspect ratio of the image (width / height). */
  aspect: number;
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Hide circles (e.g. while Puff is still looking). */
  showAnnotations: boolean;
};

/**
 * The user's sketch with Puff's circles around the details it commented on.
 * Only annotations with a reliable location get a circle (see Annotation.located).
 * Positions are fractions of the image, so circles stay in place at any size.
 */
export function AnnotatedSketch({
  source,
  aspect,
  annotations,
  selectedId,
  onSelect,
  showAnnotations,
}: Props) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  const circles =
    size && showAnnotations
      ? annotations
          .map((a, index) => ({ a, badge: badgeFor(a, index) }))
          .filter(({ a }) => a.located)
          .map(({ a, badge }) => ({
            id: a.id,
            badge,
            kind: a.kind,
            color: ANNOTATION_COLORS[a.kind],
            feature: a.feature,
            cx: (a.x + a.width / 2) * size.width,
            cy: (a.y + a.height / 2) * size.height,
            rx: Math.max(MIN_RADIUS, (a.width * size.width * PADDING) / 2),
            ry: Math.max(MIN_RADIUS, (a.height * size.height * PADDING) / 2),
          }))
      : [];
  const selected = circles.find((c) => c.id === selectedId);

  return (
    <View style={[styles.paper, { aspectRatio: aspect }]} onLayout={onLayout}>
      <Image
        source={typeof source === 'string' ? { uri: source } : source}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
      />

      {size && circles.length > 0 && (
        <Animated.View
          entering={FadeIn.duration(300)}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}>
          <Svg width={size.width} height={size.height}>
            {/* Every detail Puff noticed: a soft dashed ring. */}
            {circles.map((c) => (
              <Ellipse
                key={c.id}
                cx={c.cx}
                cy={c.cy}
                rx={c.rx}
                ry={c.ry}
                stroke={c.color}
                strokeOpacity={c.id === selectedId ? 0 : 0.45}
                strokeWidth={2}
                strokeDasharray="5 6"
                fill="none"
              />
            ))}
          </Svg>
        </Animated.View>
      )}

      {/* The selected detail: a bold pen loop that pops in (dashed and blue for the tip). */}
      {size && selected && (
        <Animated.View
          key={selected.id}
          entering={ZoomIn.duration(320).reduceMotion(ReduceMotion.System)}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}>
          <Svg width={size.width} height={size.height}>
            <Path
              d={loopPath(selected.cx, selected.cy, selected.rx, selected.ry)}
              stroke={selected.color}
              strokeWidth={selected.kind === 'improvement' ? 3 : 3.5}
              strokeDasharray={selected.kind === 'improvement' ? '9 7' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Animated.View>
      )}

      {/* Tap targets and badges. */}
      {circles.map((c) => {
        const isSelected = c.id === selectedId;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`${c.kind === 'improvement' ? 'Tip' : 'Detail'}: ${c.feature}`}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(c.id)}
            style={[
              styles.hit,
              { left: c.cx - c.rx, top: c.cy - c.ry, width: c.rx * 2, height: c.ry * 2 },
            ]}>
            <View
              style={[
                styles.badge,
                // Badge sits on the circle's top-right edge.
                {
                  left: c.rx + c.rx * 0.7 - 11,
                  top: c.ry - c.ry * 0.7 - 11,
                  borderColor: c.color,
                  backgroundColor: isSelected ? c.color : '#FFFFFF',
                },
              ]}>
              <Text style={[styles.badgeText, { color: isSelected ? '#FFFFFF' : c.color }]}>
                {c.badge}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    width: '100%',
    backgroundColor: Ink.paper,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Ink.paperLip,
  },
  hit: {
    position: 'absolute',
    borderRadius: 999,
  },
  badge: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 800,
  },
});
