import { useEffect } from 'react';
import { StyleSheet, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

  return (
    <Animated.View
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
    <Animated.View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
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
    <Animated.View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
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
