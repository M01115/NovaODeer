import { router } from 'expo-router';
import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { scheduleOnRN } from 'react-native-worklets';

import { ChunkyButton } from '@/components/chunky-button';
import { CloseButton } from '@/components/close-button';
import { Smudge } from '@/components/smudge';
import { Colors, Ink, nunito } from '@/constants/theme';
import { DEFAULT_SECONDS, getPromptForDate } from '@/data/prompts';
import { markPostedToday } from '@/data/today';
import { playSound } from '@/lib/sounds';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Pencils to pick from: graphite and two soft colours. */
const INKS = ['#2B2D33', '#E8354E', '#4F86F7'];
const WIDTHS = { thin: 3, thick: 7 };

type Stroke = { d: string; color: string; width: number };

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Draw on the phone (from the timer screen's "Draw on my phone"): a white page to sketch on
 * with your finger, a few pencils, undo and clear, and the same countdown as on paper.
 * "I'm done" saves the page as an image and posts it like a scanned sketch.
 */
export default function DrawScreen() {
  const insets = useSafeAreaInsets();
  const prompt = useMemo(() => getPromptForDate(), []);
  const total = prompt.seconds ?? DEFAULT_SECONDS;

  // Timer: starts when the page opens, keeps counting after time is up.
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const elapsed = (now - startedAt) / 1000;
  const remaining = total - elapsed;
  const overtime = remaining < 0;

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(INKS[0]);
  const [thick, setThick] = useState(false);
  const [saving, setSaving] = useState(false);
  // Clearing the page: Puff deflates sheepishly for a moment.
  const [deflated, setDeflated] = useState(false);
  useEffect(() => {
    if (!deflated) return;
    const id = setTimeout(() => setDeflated(false), 3000);
    return () => clearTimeout(id);
  }, [deflated]);
  const pageRef = useRef<ComponentRef<typeof View>>(null);

  // The stroke being drawn lives on the UI thread so the line follows the finger without lag.
  const live = useSharedValue('');
  const lastX = useSharedValue(0);
  const lastY = useSharedValue(0);
  const width = thick ? WIDTHS.thick : WIDTHS.thin;

  const commit = (d: string) => {
    setStrokes((s) => [...s, { d, color, width }]);
    live.set('');
  };

  const pan = usePanGesture({
    minDistance: 0,
    onUpdate: (e) => {
      'worklet';
      const d = live.get();
      if (!d) {
        live.set(`M${e.x.toFixed(1)} ${e.y.toFixed(1)} l0.1 0.1`);
      } else if (Math.abs(e.x - lastX.get()) + Math.abs(e.y - lastY.get()) > 1.5) {
        live.set(`${d} L${e.x.toFixed(1)} ${e.y.toFixed(1)}`);
      } else {
        return;
      }
      lastX.set(e.x);
      lastY.set(e.y);
    },
    onDeactivate: () => {
      'worklet';
      const d = live.get();
      if (d) scheduleOnRN(commit, d);
    },
  });

  const liveProps = useAnimatedProps(() => ({ d: live.get() || 'M0 0' }));

  const done = async () => {
    if (saving) return;
    setSaving(true);
    let image: string | undefined;
    try {
      image = await captureRef(pageRef, {
        format: 'png',
        quality: 1,
        result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
      });
    } catch {
      // Still count the sketch if the snapshot fails.
    }
    markPostedToday({ seconds: elapsed, image });
    router.replace('/complete');
  };

  const empty = strokes.length === 0;

  return (
    <View style={[styles.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.small}>Today’s prompt</Text>
          <Text style={styles.prompt}>{prompt.text}</Text>
        </View>
        <View style={[styles.clock, overtime && styles.clockLate]}>
          <Text style={[styles.clockText, overtime && styles.clockTextLate]}>
            {overtime ? `+${formatClock(-remaining)}` : formatClock(remaining)}
          </Text>
        </View>
        <CloseButton />
      </View>

      {/* The page */}
      <View style={styles.paperWrap}>
        <GestureDetector gesture={pan}>
          <View ref={pageRef} collapsable={false} style={styles.paper}>
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              {strokes.map((s, i) => (
                <Path
                  key={i}
                  d={s.d}
                  stroke={s.color}
                  strokeWidth={s.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
              <AnimatedPath
                animatedProps={liveProps}
                stroke={color}
                strokeWidth={width}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
            {empty && (
              <View pointerEvents="none" style={styles.hint}>
                <Text style={styles.hintText}>Draw here with your finger</Text>
              </View>
            )}
          </View>
        </GestureDetector>
        <View pointerEvents="none" style={styles.mascot}>
          <Smudge size={64} mood={saving ? 'rolling' : deflated ? 'deflate' : overtime ? 'happy' : 'squint'} animated />
        </View>
      </View>

      {/* Pencils */}
      <View style={styles.tools}>
        {INKS.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Pencil colour ${c}`}
            accessibilityState={{ selected: color === c }}
            onPress={() => {
              playSound('tab');
              setColor(c);
            }}
            hitSlop={6}
            style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchOn]}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={thick ? 'Thin pencil' : 'Thick pencil'}
          onPress={() => {
            playSound('tab');
            setThick((t) => !t);
          }}
          hitSlop={6}
          style={styles.tool}>
          <View style={[styles.widthDot, { width: thick ? 14 : 7, height: thick ? 14 : 7, backgroundColor: color }]} />
        </Pressable>
        <View style={styles.spacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo"
          disabled={empty}
          onPress={() => {
            playSound('back');
            setStrokes((s) => s.slice(0, -1));
          }}
          hitSlop={6}
          style={[styles.tool, empty && styles.toolOff]}>
          <Text style={styles.toolText}>↶</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear the page"
          disabled={empty}
          onPress={() => {
            playSound('back');
            setStrokes([]);
            setDeflated(true);
          }}
          hitSlop={6}
          style={[styles.tool, empty && styles.toolOff]}>
          <Text style={styles.toolText}>✕</Text>
        </Pressable>
      </View>

      <ChunkyButton label={saving ? 'Saving…' : 'I’m done'} onPress={done} sound="snap" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerText: {
    flex: 1,
  },
  small: {
    color: '#8A877F',
    fontSize: 13,
    fontFamily: nunito(500),
  },
  prompt: {
    color: Ink.ink,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: nunito(600),
  },
  clock: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Ink.ink,
    backgroundColor: '#FFFFFF',
  },
  clockLate: {
    borderColor: Ink.red,
  },
  clockText: {
    color: Ink.ink,
    fontSize: 16,
    fontFamily: nunito(800),
    fontVariant: ['tabular-nums'],
  },
  clockTextLate: {
    color: Ink.red,
  },
  paperWrap: {
    flex: 1,
  },
  paper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Ink.ink,
    overflow: 'hidden',
  },
  hint: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    color: '#B9B5AC',
    fontSize: 16,
    fontFamily: nunito(600),
  },
  mascot: {
    position: 'absolute',
    right: -6,
    bottom: -18,
  },
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  swatchOn: {
    borderColor: Ink.ink,
    transform: [{ scale: 1.15 }],
  },
  tool: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: Ink.ink,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolOff: {
    opacity: 0.35,
  },
  toolText: {
    color: Ink.ink,
    fontSize: 18,
    lineHeight: 22,
    fontFamily: nunito(800),
  },
  widthDot: {
    borderRadius: 999,
  },
  spacer: {
    flex: 1,
  },
});
