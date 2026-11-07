import { router } from 'expo-router';
import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { scheduleOnRN } from 'react-native-worklets';

import { ChunkyButton } from '@/components/chunky-button';
import { CloseButton } from '@/components/close-button';
import { ColorWheel } from '@/components/color-wheel';
import { Smudge } from '@/components/smudge';
import { Colors, Ink, nunito } from '@/constants/theme';
import { DEFAULT_SECONDS, getPromptForDate } from '@/data/prompts';
import { toDateKey } from '@/data/history';
import { setSubmission } from '@/data/submission';
import { markPostedToday } from '@/data/today';
import { playSound } from '@/lib/sounds';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Pencils to pick from: graphite and two soft colours. */
const INKS = ['#2B2D33', '#E8354E', '#4F86F7'];
const WIDTHS = { thin: 3, thick: 7 };
/** The eraser paints in the page's own white, wider than a pencil. */
const PAPER = '#FFFFFF';
const ERASER_WIDTHS = { thin: 18, thick: 34 };
/** Rainbow ring for the colour-wheel button. */
const RAINBOW = ['#FF4D4D', '#FFB000', '#FFE02D', '#4CD964', '#18B4F0', '#7A5CFF', '#FF5AC8'];

type Stroke = { d: string; color: string; width: number };

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Draw on the phone (from the timer screen's "Draw on my phone"): a white page to sketch on
 * with your finger, quick colours plus a colour wheel for any colour, pencil width, an
 * eraser, undo and clear, and the same countdown as on paper.
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
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [wheelOpen, setWheelOpen] = useState(false);
  const erasing = tool === 'eraser';
  const pickColor = (c: string) => {
    setColor(c);
    setTool('pen');
  };
  const [saving, setSaving] = useState(false);
  // Clearing the page: Puff deflates sheepishly for a moment.
  const [deflated, setDeflated] = useState(false);
  useEffect(() => {
    if (!deflated) return;
    const id = setTimeout(() => setDeflated(false), 3000);
    return () => clearTimeout(id);
  }, [deflated]);
  const pageRef = useRef<ComponentRef<typeof View>>(null);
  const pageSize = useRef<{ width: number; height: number } | null>(null);

  // The stroke being drawn lives on the UI thread so the line follows the finger without lag.
  const live = useSharedValue('');
  const lastX = useSharedValue(0);
  const lastY = useSharedValue(0);
  const width = erasing ? (thick ? ERASER_WIDTHS.thick : ERASER_WIDTHS.thin) : thick ? WIDTHS.thick : WIDTHS.thin;
  const ink = erasing ? PAPER : color;

  const commit = (d: string) => {
    setStrokes((s) => [...s, { d, color: ink, width }]);
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
        // A data URI everywhere: shown in the feed and sent to Puff's AI feedback.
        result: 'data-uri',
      });
    } catch {
      // Still count the sketch if the snapshot fails.
    }
    markPostedToday({ id: toDateKey(new Date()), seconds: elapsed, image, medium: 'app' });
    if (image && pageSize.current) {
      setSubmission({
        image,
        width: pageSize.current.width,
        height: pageSize.current.height,
        medium: 'app',
        seconds: Math.round(elapsed),
        prompt: prompt.text,
      });
    }
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
          <View
            ref={pageRef}
            collapsable={false}
            style={styles.paper}
            onLayout={(e) => {
              pageSize.current = e.nativeEvent.layout;
            }}>
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
                stroke={ink}
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
        {wheelOpen && (
          <View style={styles.wheelPanel}>
            <ColorWheel value={color} onChange={pickColor} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done picking a colour"
              onPress={() => {
                playSound('tab');
                setWheelOpen(false);
              }}
              hitSlop={6}
              style={styles.wheelDone}>
              <View style={[styles.wheelChosen, { backgroundColor: color }]} />
              <Text style={styles.wheelDoneText}>Use this colour</Text>
            </Pressable>
          </View>
        )}
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
            accessibilityState={{ selected: !erasing && color === c }}
            onPress={() => {
              playSound('tab');
              pickColor(c);
              setWheelOpen(false);
            }}
            hitSlop={6}
            style={[styles.swatch, { backgroundColor: c }, !erasing && color === c && styles.swatchOn]}
          />
        ))}
        {/* Any colour: opens the colour wheel. Shows the current colour inside a rainbow ring. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick any colour"
          accessibilityState={{ expanded: wheelOpen }}
          onPress={() => {
            playSound('tab');
            setWheelOpen((o) => !o);
          }}
          hitSlop={6}
          style={[styles.wheelButton, wheelOpen && styles.toolOn]}>
          <Svg width={30} height={30} viewBox="0 0 30 30">
            {RAINBOW.map((c, i) => (
              <Path key={c} d={rainbowSlice(i)} fill={c} />
            ))}
            <Circle cx={15} cy={15} r={8} fill={erasing ? '#FFFFFF' : color} stroke="#FFFFFF" strokeWidth={2.5} />
          </Svg>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={thick ? 'Thin pencil' : 'Thick pencil'}
          onPress={() => {
            playSound('tab');
            setThick((t) => !t);
          }}
          hitSlop={6}
          style={styles.tool}>
          <View
            style={[
              styles.widthDot,
              { width: thick ? 14 : 7, height: thick ? 14 : 7, backgroundColor: erasing ? '#B9B5AC' : color },
            ]}
          />
        </Pressable>
        {/* Eraser: paints the page white again. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Eraser"
          accessibilityState={{ selected: erasing }}
          onPress={() => {
            playSound('tab');
            setTool((t) => (t === 'eraser' ? 'pen' : 'eraser'));
            setWheelOpen(false);
          }}
          hitSlop={6}
          style={[styles.tool, erasing && styles.toolOn]}>
          <Svg width={22} height={22} viewBox="0 0 22 22">
            <Rect x={3} y={7} width={16} height={9} rx={2.5} fill="#FFFFFF" stroke={Ink.ink} strokeWidth={1.8} transform="rotate(-35 11 11)" />
            <Rect x={3} y={7} width={7} height={9} rx={2.5} fill="#FFA9D4" stroke={Ink.ink} strokeWidth={1.8} transform="rotate(-35 11 11)" />
          </Svg>
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

/** One slice of the rainbow ring on the colour-wheel button (30x30 box, radius 14). */
function rainbowSlice(i: number) {
  const a0 = (i / RAINBOW.length) * 2 * Math.PI - Math.PI / 2;
  const a1 = ((i + 1) / RAINBOW.length) * 2 * Math.PI - Math.PI / 2 + 0.05;
  const p = (a: number) => `${(15 + 14 * Math.cos(a)).toFixed(2)} ${(15 + 14 * Math.sin(a)).toFixed(2)}`;
  return `M15 15 L${p(a0)} A14 14 0 0 1 ${p(a1)} Z`;
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
    gap: 9,
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
  toolOn: {
    backgroundColor: '#FFE7F3',
    transform: [{ scale: 1.08 }],
  },
  wheelButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: Ink.ink,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelPanel: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    padding: 16,
    gap: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Ink.ink,
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.18)',
  },
  wheelDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Ink.ink,
    backgroundColor: '#FFA9D4',
  },
  wheelChosen: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Ink.ink,
  },
  wheelDoneText: {
    color: Ink.ink,
    fontSize: 14,
    fontFamily: nunito(800),
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
