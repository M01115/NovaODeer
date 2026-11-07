import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ArchiveView } from '@/components/archive-view';
import { Smudge } from '@/components/smudge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { onArchiveRequest } from '@/data/archive-events';
import { formatShortDate, getHistory, getStreak, toDateKey } from '@/data/history';
import { useTheme } from '@/hooks/use-theme';

// The streak screen shows once per app launch (resets when the app restarts).
let streakShownThisLaunch = false;

/** Let go past this fraction of the screen, or flick faster than this (pt/s), to open the archive. */
const OPEN_FRACTION = 0.25;
const OPEN_VELOCITY = 700;
/** Distance over which the top-edge hint wakes up. */
const HINT_DISTANCE = 70;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Home is all about today's prompt. The sketch archive sits directly above it, in the same
 * screen: pulling down drags Home down and the archive in, 1:1 with the finger, and letting
 * go springs the rest of the way (or back) carrying the finger's speed. One continuous move.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const days = useMemo(() => getHistory(), []);
  const streak = getStreak(days);
  const today = days.find((d) => d.status === 'today');
  const now = new Date();
  const dateLabel = `${WEEKDAYS[now.getDay()]}, ${formatShortDate(toDateKey(now))}`;

  // On landing, celebrate the streak first.
  useFocusEffect(
    useCallback(() => {
      if (streakShownThisLaunch) return;
      streakShownThisLaunch = true;
      router.push('/streak');
    }, [])
  );

  // Archive layer. `drag` is how far Home has moved down: 0 = Home, screenH = archive.
  const drag = useSharedValue(0);
  const screenH = useSharedValue(800);
  const [archiveOpen, setArchiveOpen] = useState(false);
  // Mount the archive just after Home appears, so the first pull is already smooth.
  const [archiveReady, setArchiveReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setArchiveReady(true), 400);
    return () => clearTimeout(id);
  }, []);

  const springTo = (target: number, velocity = 0) => {
    'worklet';
    // Sheet spring; never overshoots past either edge.
    return withSpring(target, {
      duration: 420,
      dampingRatio: 0.9,
      velocity,
      overshootClamping: true,
      reduceMotion: ReduceMotion.System,
    });
  };

  const settled = (open: boolean) => {
    setArchiveOpen(open);
    if (open && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openArchive = () => {
    setArchiveReady(true);
    drag.set(springTo(screenH.get()));
    settled(true);
  };
  const closeArchive = () => {
    drag.set(springTo(0));
    setArchiveOpen(false);
  };

  // The streak screen (and others) can ask for the archive.
  useEffect(() => onArchiveRequest(openArchive));

  const pan = usePanGesture({
    activeOffsetY: [-12, 12],
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      'worklet';
      if (reducedMotion) return;
      // Follows the finger exactly: Home slides down, the archive comes in from above.
      drag.set(Math.min(Math.max(0, e.translationY), screenH.get()));
    },
    onDeactivate: (e) => {
      'worklet';
      const open = e.translationY > screenH.get() * OPEN_FRACTION || e.velocityY > OPEN_VELOCITY;
      drag.set(springTo(open ? screenH.get() : 0, e.velocityY));
      if (open) scheduleOnRN(settled, true);
    },
  });

  const pageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drag.get() }],
  }));
  const archiveStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drag.get() - screenH.get() }],
  }));
  // The hint wakes up as you pull: darker and dropping.
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drag.get(), [0, HINT_DISTANCE], [0.55, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(drag.get(), [0, HINT_DISTANCE], [0, 6], Extrapolation.CLAMP) }],
  }));

  const onScreenLayout = (e: LayoutChangeEvent) => {
    screenH.set(e.nativeEvent.layout.height);
  };

  return (
    <ThemedView style={styles.screen} onLayout={onScreenLayout}>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.page,
            {
              paddingTop: insets.top + Spacing.one,
              paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
            },
            pageStyle,
          ]}>
          {/* Archive hint on the top edge; pull down or tap. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open sketch archive"
            accessibilityHint="Or pull down"
            onPress={openArchive}
            hitSlop={10}
            style={styles.archiveHint}>
            <Animated.View style={[styles.archiveHintInner, hintStyle]}>
              <ThemedText type="small" themeColor="textSecondary">
                Sketch archive
              </ThemedText>
              <Text style={[styles.archiveArrow, { color: theme.text }]}>﹀</Text>
            </Animated.View>
          </Pressable>

          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${streak} day streak`}
              onPress={() => router.push('/streak')}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.pill}>
                <ThemedText type="smallBold">🔥 {streak}</ThemedText>
              </ThemedView>
            </Pressable>

            <ThemedText type="smallBold" themeColor="textSecondary">
              {dateLabel}
            </ThemedText>
          </View>

          <View style={styles.mascotArea}>
            <Smudge size={150} animated />
            <ThemedView type="backgroundElement" style={styles.bubble}>
              <ThemedText type="small" style={styles.center}>
                Morning! Five minutes, any paper. You’ve got this.
              </ThemedText>
            </ThemedView>
          </View>

          <ThemedView type="backgroundElement" style={styles.promptCard}>
            <ThemedText type="small" themeColor="textSecondary">
              Today’s prompt
            </ThemedText>
            <ThemedText type="subtitle" style={styles.promptText}>
              {today?.prompt.text}
            </ThemedText>
          </ThemedView>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/session')}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.text },
              pressed && styles.primaryPressed,
            ]}>
            <Text style={[styles.plus, { color: theme.background }]}>+</Text>
            <ThemedText style={[styles.primaryLabel, { color: theme.background }]}>
              Snap my sketch
            </ThemedText>
          </Pressable>
        </Animated.View>
      </GestureDetector>

      {/* The archive, parked just above the screen until Home is pulled down. */}
      <Animated.View
        pointerEvents={archiveOpen ? 'auto' : 'none'}
        accessibilityElementsHidden={!archiveOpen}
        importantForAccessibility={archiveOpen ? 'auto' : 'no-hide-descendants'}
        style={[StyleSheet.absoluteFill, archiveStyle]}>
        {archiveReady && <ArchiveView onClose={closeArchive} />}
      </Animated.View>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
    // Pull-down with a mouse (web preview) shouldn't select text.
    userSelect: 'none',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  archiveHint: {
    alignSelf: 'center',
    marginBottom: -Spacing.two,
  },
  archiveHintInner: {
    alignItems: 'center',
  },
  archiveArrow: {
    fontSize: 18,
    lineHeight: 16,
    fontWeight: 700,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
  },
  mascotArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  bubble: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
    maxWidth: 280,
  },
  center: {
    textAlign: 'center',
  },
  promptCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.two,
    minHeight: 150,
    justifyContent: 'center',
  },
  promptText: {
    lineHeight: 40,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three + Spacing.one,
    borderRadius: Spacing.four,
  },
  primaryPressed: {
    transform: [{ scale: 0.97 }],
  },
  plus: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: 500,
  },
  primaryLabel: {
    fontSize: 18,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
  },
});
