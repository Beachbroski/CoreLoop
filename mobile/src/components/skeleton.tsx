import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Hoisted so it is one object for the lifetime of the module rather than a new
 * one on every render — `accessibilityState` is compared by identity downstream.
 */
const BUSY = { busy: true } as const;

type SkeletonGroupProps = {
  /**
   * What is loading, phrased as a sentence VoiceOver can read on its own:
   * "Loading campaigns", "Loading your earnings". This is the ONLY thing a
   * screen reader gets while a screen loads, so a bare "Loading" wastes it.
   */
  label: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Wrap a screen's skeleton layout in this.
 *
 * Every placeholder below hides itself from VoiceOver, which is right — a
 * pulsing grey block carries no information and stopping on twelve of them is
 * torture. But hiding them and adding nothing back made loading *completely
 * silent*: the screen reader landed on an empty region and said nothing, so a
 * blind creator could not tell a slow network from a broken screen.
 *
 * The group is the thing that speaks. It collapses the whole placeholder region
 * into one accessible element that announces the busy state once, and stops
 * announcing when the real content replaces it.
 */
export function SkeletonGroup({ label, children, style }: SkeletonGroupProps) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={BUSY}
      accessibilityLiveRegion="polite"
      style={style}>
      {children}
    </View>
  );
}

type SkeletonProps = {
  width?: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Pulsing placeholder block — compose these into per-screen loading layouts. */
export function Skeleton({ width = '100%', height, borderRadius = Spacing.two, style }: SkeletonProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withRepeat(withTiming(0.45, { duration: 700 }), -1, true);
  }, [pulse, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // Placeholders carry no information — without this VoiceOver stops on every
  // pulsing block while a screen loads. `SkeletonGroup` supplies the busy
  // announcement that replaces them; hiding these without wrapping them leaves
  // the loading state silent.
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius, backgroundColor: theme.backgroundSelected },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Card-shaped skeleton matching the discover feed's campaign cards. */
export function SkeletonCard() {
  const theme = useTheme();

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Skeleton height={130} borderRadius={0} style={styles.cardCover} />
      <Animated.View style={styles.cardBody}>
        <Skeleton height={16} width="60%" />
        <Skeleton height={14} width="40%" />
        <Skeleton height={24} width="35%" />
      </Animated.View>
    </Animated.View>
  );
}

/** Row-shaped skeleton matching activity/earnings list rows. */
export function SkeletonRow() {
  const theme = useTheme();

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <Skeleton height={48} width={48} borderRadius={Spacing.two} />
      <Animated.View style={styles.rowBody}>
        <Skeleton height={14} width="70%" />
        <Skeleton height={12} width="45%" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    overflow: 'hidden',
  },
  cardCover: {
    width: '100%',
  },
  cardBody: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowBody: {
    flex: 1,
    gap: Spacing.two,
  },
});
