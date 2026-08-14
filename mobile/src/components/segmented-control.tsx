import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

const PADDING = 4;

type SegmentedControlProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** Two-plus-way segment switcher with a spring-sliding active indicator. */
export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segmentWidth = width > 0 ? (width - PADDING * 2) / options.length : 0;
  const translate = useSharedValue(activeIndex * segmentWidth);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutated by design
    translate.value = withSpring(activeIndex * segmentWidth, { damping: 22, stiffness: 260 });
  }, [activeIndex, segmentWidth, translate]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translate.value }],
  }));

  function handlePress(next: T) {
    if (next === value) return;
    Haptics.selectionAsync();
    onChange(next);
  }

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            styles.indicator,
            { width: segmentWidth, backgroundColor: theme.backgroundSelected },
            indicatorStyle,
          ]}
        />
      )}
      {options.map((option) => (
        <Pressable key={option.value} onPress={() => handlePress(option.value)} style={styles.segment}>
          <ThemedText type="smallBold" themeColor={option.value === value ? 'accent' : 'text'}>
            {option.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: Spacing.two + PADDING,
    padding: PADDING,
  },
  indicator: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: Spacing.two,
  },
  segment: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
});
