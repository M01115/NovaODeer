import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ANNOTATION_COLORS, AnnotatedSketch, badgeFor } from '@/components/annotated-sketch';
import { CloseButton } from '@/components/close-button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { Smudge, type SmudgeMood } from '@/components/smudge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { HAND_FONT } from '@/constants/handwriting';
import { Ink, nunito, Spacing } from '@/constants/theme';
import { DEMO_FEEDBACK, DEMO_PROMPT, DEMO_SKETCH, DEMO_SKETCH_ASPECT } from '@/data/demo-feedback';
import {
  ANNOTATION_LABELS,
  type FeedbackError,
  getCompliments,
  type OkFeedback,
  type SketchFeedback,
} from '@/data/feedback';
import {
  AI_UNAVAILABLE,
  getSubmission,
  PICK_ERRORS,
  pickSketch,
  requestFeedback,
  type Submission,
} from '@/data/submission';
import { toDateKey } from '@/data/history';
import { useMascotName } from '@/data/outfit';
import { markPostedToday } from '@/data/today';
import { useTheme } from '@/hooks/use-theme';

type Phase =
  | { name: 'preview' }
  | { name: 'loading' }
  | { name: 'result'; feedback: SketchFeedback }
  | { name: 'error'; error: FeedbackError['error'] }
  /** Labeled sample, only offered when the live AI is down. */
  | { name: 'demo' };

/** Rotating lines while Smudge looks, so the wait feels alive. */
/** Rotating lines while the mascot looks, in its voice, so the wait feels alive. */
const LOOKING_LINES = [
  'ooh hold on, zooming in…',
  'following every single line…',
  'wait, I see something cute…',
  'okay okay, almost done squinting!',
];

/**
 * After a sketch session: preview the photo, send it to Smudge, then explore the
 * feedback. Smudge circles details it liked; tap a circle or a note to switch between them.
 */
export default function FeedbackScreen() {
  const name = useMascotName();
  const [submission, setSubmission] = useState<Submission | null>(getSubmission);
  const [phase, setPhase] = useState<Phase>({ name: 'preview' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const requestId = useRef(0);

  // Stop listening to an old request if the user retakes or leaves.
  useEffect(() => () => void requestId.current++, []);

  if (!submission) {
    return (
      <Screen>
        <CloseButton />
        <EmptyState
          emoji="🔍"
          title="No sketch yet"
          message="Finish a session and scan your sketch first."
        />
      </Screen>
    );
  }

  const getFeedback = async () => {
    const id = ++requestId.current;
    setPhase({ name: 'loading' });
    setSelectedId(null);
    const result = await requestFeedback(submission, name);
    if (id !== requestId.current) return;
    if ('error' in result) {
      setPhase({ name: 'error', error: result.error });
      return;
    }
    setPhase({ name: 'result', feedback: result });
    if (result.status === 'ok') {
      setSelectedId(result.annotations.find((a) => a.located)?.id ?? null);
    }
  };

  const retake = async (source: 'camera' | 'library') => {
    const picked = await pickSketch(source, submission.seconds);
    if (!picked.ok) {
      const message = PICK_ERRORS[picked.reason];
      if (message) Alert.alert('Hmm', message);
      return;
    }
    requestId.current++;
    setSubmission(picked.submission);
    setPhase({ name: 'preview' });
    setSelectedId(null);
  };

  const showDemo = () => {
    setPhase({ name: 'demo' });
    setSelectedId(DEMO_FEEDBACK.status === 'ok' ? DEMO_FEEDBACK.annotations[0].id : null);
  };

  const isDemo = phase.name === 'demo';
  const feedback: SketchFeedback | null =
    phase.name === 'result' ? phase.feedback : isDemo ? DEMO_FEEDBACK : null;
  const ok = feedback?.status === 'ok' ? feedback : null;

  let mood: SmudgeMood = 'happy';
  let bubble = 'ooh is this the one?? tap “Get feedback” and I’ll take a look!';
  if (phase.name === 'loading') {
    mood = 'focus';
    bubble = '';
  } else if (phase.name === 'error') {
    mood = 'hurry';
    bubble = phase.error.message;
  } else if (feedback) {
    mood = feedback.status === 'ok' ? 'proud' : 'happy';
    bubble = feedback.overallReaction;
  }

  /**
   * Posts today's sketch: unlocks the friends feed and shows the team's streak completion
   * screen, then Home shows the feed with this sketch and Smudge's feedback.
   * Feedback is only attached when it's Smudge's real feedback on THIS sketch (never the demo).
   */
  const post = () => {
    const real = phase.name === 'result' ? phase.feedback : null;
    const okReal = real?.status === 'ok' ? real : null;
    const sketchId = toDateKey(new Date());
    markPostedToday({
      id: sketchId,
      seconds: submission.seconds,
      image: submission.image,
      medium: submission.medium === 'paper' ? 'paper' : 'upload',
      // Short version for the feed: the reaction plus the first compliment.
      feedback: okReal
        ? `${okReal.overallReaction} ${getCompliments(okReal)[0]?.comment ?? ''}`.trim()
        : undefined,
      // Full structured result: 2 compliments + 1 tip with annotation boxes.
      analysis: {
        sketchId,
        status: real ? real.status : phase.name === 'error' ? 'failed' : 'skipped',
        feedback: real ?? undefined,
        analyzedAt: real ? Date.now() : undefined,
      },
    });
    router.replace('/complete');
  };

  /** Never lose a streak to an AI hiccup: post the sketch without feedback. */
  const postAnyway = (
    <Pressable accessibilityRole="button" onPress={post} hitSlop={8} style={styles.link}>
      <ThemedText type="small" themeColor="textSecondary">
        Post my sketch without feedback
      </ThemedText>
    </Pressable>
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="small" themeColor="textSecondary">
            {isDemo ? DEMO_PROMPT : submission.prompt} · {formatMinutes(submission.seconds)}
          </ThemedText>
          <ThemedText type="smallBold" style={styles.title}>
            {TITLES[phase.name](name)}
          </ThemedText>
        </View>
        <CloseButton />
      </View>

      {isDemo && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoText}>
            DEMO SAMPLE · The live AI is unavailable, so this is a saved example on a sample sketch,
            not feedback on yours.
          </Text>
        </View>
      )}

      <View style={phase.name === 'loading' && styles.dimmed}>
        <AnnotatedSketch
          source={isDemo ? DEMO_SKETCH : submission.image}
          aspect={isDemo ? DEMO_SKETCH_ASPECT : submission.width / submission.height}
          annotations={ok?.annotations ?? []}
          selectedId={selectedId}
          onSelect={setSelectedId}
          showAnnotations={!!ok}
        />
        {phase.name === 'loading' && <ScanLine />}
      </View>

      <View style={styles.mascotRow}>
        <BouncySmudge
          mood={mood}
          mode={phase.name === 'loading' ? 'thinking' : ok ? 'celebrate' : 'idle'}
        />
        <ThemedView type="backgroundElement" style={styles.bubble}>
          {phase.name === 'loading' ? (
            <LookingText />
          ) : (
            <Text style={styles.speech}>{bubble}</Text>
          )}
        </ThemedView>
      </View>

      {ok && <Observations feedback={ok} selectedId={selectedId} onSelect={setSelectedId} />}

      <View style={styles.actions}>
        {phase.name === 'preview' && (
          <>
            <PrimaryButton label="✨  Get feedback" onPress={getFeedback} />
            <View style={styles.row}>
              <SecondaryButton label="📷 Retake" onPress={() => retake('camera')} />
              <SecondaryButton label="🖼️ Choose another" onPress={() => retake('library')} />
            </View>
          </>
        )}

        {phase.name === 'error' && (
          <>
            <PrimaryButton label="Try again" onPress={getFeedback} />
            <SecondaryButton label="Choose another photo" onPress={() => retake('library')} />
            {AI_UNAVAILABLE.has(phase.error.code) && (
              <Pressable
                accessibilityRole="button"
                onPress={showDemo}
                hitSlop={8}
                style={styles.link}>
                <ThemedText type="small" themeColor="textSecondary">
                  Show a demo sample instead (not your sketch)
                </ThemedText>
              </Pressable>
            )}
            {postAnyway}
          </>
        )}

        {feedback?.status === 'unclear' && (
          <>
            <PrimaryButton label="📷  Scan again" onPress={() => retake('camera')} />
            <SecondaryButton label="Choose from photos" onPress={() => retake('library')} />
            {postAnyway}
          </>
        )}

        {ok && (
          <>
            {isDemo ? (
              <>
                <PrimaryButton label="Try my sketch again" onPress={getFeedback} />
                {postAnyway}
              </>
            ) : (
              <PrimaryButton label="Post today’s sketch 🎉" onPress={post} />
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

/** Screen titles, framed around the mascot (it's the one reacting). */
const TITLES: Record<Phase['name'], (name: string) => string> = {
  preview: () => 'Your sketch',
  loading: (name) => `${name} is looking…`,
  result: (name) => `${name}’s notes`,
  error: (name) => `${name} got stuck`,
  demo: (name) => `${name}’s notes (demo)`,
};

function formatMinutes(seconds: number) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`;
  return `${Math.round(seconds / 60)} min`;
}

/** The 2–3 notes. Tapping one circles its detail on the sketch. */
function Observations({
  feedback,
  selectedId,
  onSelect,
}: {
  feedback: OkFeedback;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.observations}>
      {feedback.annotations.map((a, i) => {
        const selected = a.id === selectedId;
        const color = ANNOTATION_COLORS[a.kind];
        const isTip = a.kind === 'improvement';
        return (
          <Animated.View key={a.id} entering={FadeInDown.delay(150 + i * 120).duration(300)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${ANNOTATION_LABELS[i]} ${a.feature}. ${a.comment}`}
              accessibilityState={{ selected }}
              onPress={() => onSelect(a.id)}
              style={({ pressed }) => [
                styles.note,
                { backgroundColor: theme.backgroundElement },
                isTip && styles.noteTip,
                selected && { borderColor: color, borderStyle: isTip ? 'dashed' : 'solid' },
                pressed && styles.pressed,
              ]}>
              <View
                style={[
                  styles.noteBadge,
                  { borderColor: color, backgroundColor: selected ? color : '#FFFFFF' },
                ]}>
                <Text style={[styles.noteBadgeText, { color: selected ? '#FFFFFF' : color }]}>
                  {badgeFor(a, i)}
                </Text>
              </View>
              <View style={styles.noteText}>
                <View style={styles.noteHead}>
                  <Text style={[styles.noteLabel, { color }]}>{ANNOTATION_LABELS[i]}</Text>
                  {!a.located && <Text style={styles.noteUnplaced}>not circled</Text>}
                </View>
                <Text style={styles.noteSpeech}>{a.comment}</Text>
                <Text style={styles.noteFeature}>{capitalize(a.feature)}</Text>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Smudge hops while thinking, and does a happy triple hop when the notes arrive. */
function BouncySmudge({
  mood,
  mode,
}: {
  mood: SmudgeMood;
  mode: 'idle' | 'thinking' | 'celebrate';
}) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    if (mode === 'thinking') {
      y.set(
        withRepeat(
          withSequence(withTiming(-6, { duration: 350 }), withTiming(0, { duration: 350 })),
          -1,
        ),
      );
    } else if (mode === 'celebrate') {
      const hop = () =>
        withSequence(
          withTiming(-18, { duration: 160 }),
          withSpring(0, { duration: 260, dampingRatio: 0.5 }),
        );
      y.set(withSequence(hop(), hop(), hop()));
    } else {
      y.set(withTiming(0, { duration: 150 }));
    }
  }, [mode, reduced, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <Animated.View style={style}>
      {/* Puff is the star here: big, reacting live to the sketch. */}
      <Smudge size={120} mood={mood} animated />
    </Animated.View>
  );
}

function LookingText() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % LOOKING_LINES.length), 1600);
    return () => clearInterval(id);
  }, []);
  return (
    <Animated.View key={index} entering={FadeIn.duration(250)}>
      <Text style={styles.speech}>{LOOKING_LINES[index]}</Text>
    </Animated.View>
  );
}

/** A soft pencil line sweeping over the sketch while Smudge looks. */
function ScanLine() {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.set(withRepeat(withTiming(1, { duration: 1400 }), -1, true));
  }, [reduced, t]);
  const style = useAnimatedStyle(() => ({ top: `${t.get() * 96}%` }));
  return <Animated.View pointerEvents="none" style={[styles.scanLine, style]} />;
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: theme.text },
        pressed && styles.pressedScale,
      ]}>
      <Text style={[styles.primaryText, { color: theme.background }]}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryWrap, pressed && styles.pressedScale]}>
      <ThemedView type="backgroundElement" style={styles.secondary}>
        <ThemedText type="smallBold">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function capitalize(text: string) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
  },
  demoBanner: {
    backgroundColor: '#FFF4D6',
    borderColor: '#E2C98A',
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.two,
  },
  demoText: {
    color: '#5A4310',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 16,
  },
  dimmed: {
    opacity: 0.75,
  },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: Ink.red,
    opacity: 0.5,
  },
  mascotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginVertical: Spacing.one,
  },
  // The mascot's live reaction: a speech bubble with a tail pointing back at it.
  bubble: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.four,
    borderBottomLeftRadius: 6,
    minHeight: 56,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Ink.ink,
  },
  observations: {
    gap: Spacing.two,
  },
  // Each note is a speech bubble from the mascot (flat corner = it came from above).
  note: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 20,
    borderTopLeftRadius: 6,
    borderWidth: 2,
    borderColor: Ink.ink,
    backgroundColor: '#FFFFFF',
  },
  noteSpeech: {
    color: Ink.ink,
    fontSize: 19,
    lineHeight: 23,
    fontFamily: HAND_FONT,
  },
  noteFeature: {
    color: '#8C8173',
    fontSize: 11.5,
    fontFamily: nunito(700),
    marginTop: 2,
  },
  speech: {
    color: Ink.ink,
    fontSize: 19,
    lineHeight: 23,
    fontFamily: HAND_FONT,
  },
  noteBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  noteBadgeText: {
    fontSize: 13,
    fontWeight: 800,
  },
  noteTip: {
    // The tip sits a little apart from the compliments.
    marginTop: Spacing.one,
  },
  noteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  noteUnplaced: {
    color: Ink.pencil,
    fontSize: 11,
    fontWeight: 600,
  },
  noteText: {
    flex: 1,
    gap: 2,
  },
  actions: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  primary: {
    paddingVertical: Spacing.three + Spacing.one,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 18,
    fontWeight: 700,
  },
  secondaryWrap: {
    flex: 1,
  },
  secondary: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
  link: {
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  pressedScale: {
    transform: [{ scale: 0.97 }],
  },
});
