import { router } from 'expo-router';
import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseButton } from '@/components/close-button';
import { getNodeY, SketchPath } from '@/components/sketch-path';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getHistory, type Day } from '@/data/history';

/**
 * Past sketches as a Duolingo-style winding path, opened from the top bar on Home.
 * Opens scrolled to today's node.
 */
export default function JourneyScreen() {
  const insets = useSafeAreaInsets();
  const days = useMemo(() => getHistory(), []);
  const todayIndex = days.findIndex((d) => d.status === 'today');
  const sketchCount = days.filter((d) => d.status === 'done').length;

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height }
    );
  };

  // Land on today's node, centered. Wait for a real layout (web can report a tiny
  // height for a moment while the screen animates in).
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || !viewport || viewport.height < 200 || todayIndex < 0) return;
    landed.current = true;
    const y = Math.max(0, getNodeY(todayIndex, todayIndex) - viewport.height / 2);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: false }));
  }, [viewport, todayIndex]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openSketch = (day: Day) =>
    router.push({ pathname: '/sketch/[date]', params: { date: day.date } });

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <View>
          <ThemedText type="smallBold" style={styles.title}>
            Your sketch path
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {sketchCount} sketches so far
          </ThemedText>
        </View>
        <CloseButton />
      </View>

      <ScrollView
        ref={scrollRef}
        onLayout={onLayout}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom }}>
        {viewport && (
          <SketchPath
            days={days}
            width={viewport.width}
            // Today's prompt lives on Home, so today's node takes you back there.
            onPressToday={close}
            onOpenSketch={openSketch}
          />
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 18,
  },
});
