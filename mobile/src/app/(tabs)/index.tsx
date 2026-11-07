import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Smudge } from '@/components/smudge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatShortDate, getHistory, getStreak, toDateKey } from '@/data/history';
import { useTheme } from '@/hooks/use-theme';

// The streak screen shows once per app launch (resets when the app restarts).
let streakShownThisLaunch = false;

/** Pull down past this distance (pt), or flick faster than this (pt/s), to open the archive. */
const OPEN_DISTANCE = 110;
const OPEN_VELOCITY = 700;
const RUBBER_LIMIT = 320;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Rubber-band resistance: follows the finger at first, then stiffens. */
function rubberBand(offset: number) {
  'worklet';
  const distance = Math.abs(offset);
  const resisted = (1 - 1 / ((distance * 0.55) / RUBBER_LIMIT + 1)) * RUBBER_LIMIT;
  return Math.sign(offset) * resisted;
}

function openArchive() {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  router.push('/archive');
}

/**
 * Home is all about today's prompt. The sketch archive lives "above" it: pull down
 * (or tap the hint at the top edge) to open it.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Pull down to open the archive. Only downward drags move the page.
  const drag = useSharedValue(0);
  const pan = usePanGesture({
    activeOffsetY: [-12, 12],
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      'worklet';
      if (reducedMotion) return;
      drag.set(rubberBand(Math.max(0, e.translationY)));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > OPEN_DISTANCE || e.velocityY > OPEN_VELOCITY) {
        scheduleOnRN(openArchive);
      }
      drag.set(
        withSpring(0, {
          duration: 400,
          dampingRatio: 0.8,
          velocity: e.velocityY,
          reduceMotion: ReduceMotion.System,
        })
      );
    },
  });

  const pageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drag.get() }],
  }));
  // The hint wakes up as you pull: darker and dropping, ready to open.
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drag.get(), [0, OPEN_DISTANCE * 0.6], [0.55, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(drag.get(), [0, OPEN_DISTANCE * 0.6], [0, 6], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <ThemedView style={styles.screen}>
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

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Menu"
              onPress={() => setMenuOpen((v) => !v)}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.pill}>
                <ThemedText type="smallBold">•••</ThemedText>
              </ThemedView>
            </Pressable>
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

      {menuOpen && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(120)}
            style={[styles.menu, { top: insets.top + 86, backgroundColor: theme.background }]}>
            <MenuItem
              label="🗺️  My sketch path"
              onPress={() => {
                setMenuOpen(false);
                router.push('/journey');
              }}
            />
            <MenuItem
              label="🗂️  Sketch archive"
              onPress={() => {
                setMenuOpen(false);
                openArchive();
              }}
            />
          </Animated.View>
        </>
      )}
    </ThemedView>
  );
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="menuitem"
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
  menu: {
    position: 'absolute',
    right: Spacing.four,
    borderRadius: 16,
    paddingVertical: Spacing.one,
    minWidth: 200,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  },
  menuItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
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
