import { useMemo, useState } from 'react';
import { Alert, type LayoutChangeEvent, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CloseButton } from '@/components/close-button';
import { Screen } from '@/components/screen';
import { Smudge } from '@/components/smudge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getHistory, getStreak } from '@/data/history';
import {
  DEFAULT_OUTFIT,
  type Outfit,
  setMascotName,
  setOutfit,
  type Slot,
  useMascotName,
  useOutfit,
  WARDROBE,
} from '@/data/outfit';
import { usePostedToday } from '@/data/today';
import { useTheme } from '@/hooks/use-theme';

const SLOTS: Slot[] = ['hat', 'eyes', 'hold'];
const COLUMNS = 3;

/**
 * Profile (opened from the top-right of Home): Smudge in the middle, wearing whatever you've picked, your stats, and a
 * wardrobe to dress him up. Some items unlock with longer streaks (Duolingo/Finch style).
 * The look shows on Smudge everywhere in the app.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const outfit = useOutfit();
  const name = useMascotName();
  const posted = usePostedToday();
  const [slot, setSlot] = useState<Slot>('hat');
  const [gridWidth, setGridWidth] = useState(0);

  const stats = useMemo(() => {
    const history = getHistory();
    const done = history.filter((d) => d.status === 'done');
    const minutes = done.reduce((sum, d) => sum + (d.minutes ?? 0), 0) + (posted ? posted.seconds / 60 : 0);
    return {
      streak: getStreak(history) + (posted ? 1 : 0),
      sketches: done.length + (posted ? 1 : 0),
      minutes: Math.round(minutes),
    };
  }, [posted]);

  const tileW = gridWidth > 0 ? Math.floor((gridWidth - Spacing.two * (COLUMNS - 1)) / COLUMNS) - 1 : 0;

  return (
    <Screen>
      {/* Close (top left) and settings (top right) */}
      <View style={styles.topRow}>
        <CloseButton />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => Alert.alert('Settings', 'Coming soon.')}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundElement" style={styles.settings}>
            <Text style={[styles.settingsIcon, { color: theme.text }]}>⚙︎</Text>
          </ThemedView>
        </Pressable>
      </View>

      {/* Smudge, dressed up */}
      <View style={styles.hero}>
        <Smudge size={220} mood="happy" animated />
      </View>

      {/* Name and stats */}
      <ThemedView type="backgroundElement" style={styles.statsCard}>
        <View style={styles.nameRow}>
          <TextInput
            value={name}
            onChangeText={setMascotName}
            maxLength={16}
            accessibilityLabel="Mascot name"
            style={[styles.name, { color: theme.text }]}
          />
          <Text style={[styles.pencil, { color: theme.textSecondary }]}>✎</Text>
        </View>
        <View style={styles.statsRow}>
          <Stat value={`🔥 ${stats.streak}`} label="day streak" />
          <Stat value={`${stats.sketches}`} label="sketches" />
          <Stat value={`${stats.minutes}`} label="minutes" />
        </View>
      </ThemedView>

      {/* Wardrobe */}
      <ThemedView type="backgroundElement" style={styles.wardrobe}>
        <View style={styles.wardrobeHeader}>
          <ThemedText type="smallBold">Wardrobe</ThemedText>
          <Pressable accessibilityRole="button" onPress={() => setOutfit(DEFAULT_OUTFIT)} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              Reset
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.slots}>
          {SLOTS.map((sl) => {
            const on = sl === slot;
            return (
              <Pressable
                key={sl}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setSlot(sl)}
                style={[styles.slot, { backgroundColor: on ? theme.text : theme.background }]}>
                <Text style={[styles.slotText, { color: on ? theme.background : theme.text }]}>
                  {WARDROBE[sl].title}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={styles.grid}
          onLayout={(e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width)}>
          {tileW > 0 &&
            WARDROBE[slot].items.map((item) => {
              const locked = stats.streak < item.unlockStreak;
              const selected = outfit[slot] === item.id;
              // Preview: Smudge in today's look, with this one item swapped in.
              const preview = { ...outfit, [slot]: item.id } as Outfit;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: locked }}
                  accessibilityLabel={
                    locked ? `${item.label}, unlocks at a ${item.unlockStreak}-day streak` : item.label
                  }
                  onPress={() =>
                    locked
                      ? Alert.alert('Locked', `Keep a ${item.unlockStreak}-day streak to unlock ${item.label}.`)
                      : setOutfit({ [slot]: item.id } as Partial<Outfit>)
                  }
                  style={({ pressed }) => [
                    styles.tile,
                    {
                      width: tileW,
                      backgroundColor: theme.background,
                      borderColor: selected ? theme.text : 'transparent',
                    },
                    pressed && styles.pressedScale,
                  ]}>
                  <View style={[styles.preview, locked && styles.lockedPreview]}>
                    <Smudge size={52} outfit={preview} />
                  </View>
                  <Text numberOfLines={1} style={[styles.tileLabel, { color: theme.text }]}>
                    {item.label}
                  </Text>
                  {locked && (
                    <View style={[styles.lock, { backgroundColor: theme.text }]}>
                      <Text style={[styles.lockText, { color: theme.background }]}>
                        🔒 {item.unlockStreak}🔥
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
        </View>
      </ThemedView>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="smallBold" style={styles.statValue}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settings: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 20,
  },
  hero: {
    alignItems: 'center',
    paddingTop: Spacing.five,
    paddingBottom: Spacing.two,
  },
  statsCard: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  name: {
    fontSize: 22,
    fontWeight: 800,
    textAlign: 'center',
    minWidth: 80,
    padding: 0,
  },
  pencil: {
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    lineHeight: 24,
  },
  wardrobe: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    gap: Spacing.three,
  },
  wardrobeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slots: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 14,
  },
  slotText: {
    fontSize: 13,
    fontWeight: 700,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    alignItems: 'center',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    borderRadius: 16,
    borderWidth: 2,
    gap: 4,
  },
  preview: {
    height: 70,
    justifyContent: 'flex-end',
  },
  lockedPreview: {
    opacity: 0.35,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: 700,
  },
  lock: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  lockText: {
    fontSize: 10,
    fontWeight: 800,
  },
  pressed: {
    opacity: 0.7,
  },
  pressedScale: {
    transform: [{ scale: 0.96 }],
  },
});
