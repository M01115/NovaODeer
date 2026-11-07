import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, type PressableProps, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type WebSymbol = NonNullable<
  Extract<ComponentProps<typeof SymbolView>['name'], { web?: unknown }>['web']
>;

/** Browser version of the tab bar, laid out like the iPhone one: bottom bar, icon over label. */
export default function AppTabs() {
  return (
    <Tabs style={styles.tabs}>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <BottomBar>
          <TabTrigger name="today" href="/" asChild>
            <TabButton icon="edit">Today</TabButton>
          </TabTrigger>
          <TabTrigger name="feed" href="/feed" asChild>
            <TabButton icon="group">Feed</TabButton>
          </TabTrigger>
          <TabTrigger name="collection" href="/collection" asChild>
            <TabButton icon="grid_view">Collection</TabButton>
          </TabTrigger>
        </BottomBar>
      </TabList>
    </Tabs>
  );
}

function BottomBar(props: ComponentProps<typeof View>) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <View
      {...props}
      style={[
        styles.bar,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.backgroundSelected,
          paddingBottom: Math.max(insets.bottom, Spacing.two),
        },
      ]}
    />
  );
}

function TabButton({
  children,
  isFocused,
  icon,
  ...props
}: TabTriggerSlotProps & { icon: WebSymbol }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const color = isFocused ? colors.text : colors.textSecondary;

  return (
    // Cast: TabTriggerSlotProps' ref type doesn't match Pressable's in this SDK.
    <Pressable
      {...(props as PressableProps)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <SymbolView name={{ ios: 'circle', web: icon }} size={24} tintColor={color} />
      <ThemedText style={[styles.label, { color }]}>{children}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flex: 1,
  },
  slot: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.7,
  },
});
