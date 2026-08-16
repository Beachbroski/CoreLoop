import { useEffect, useRef, useState } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { formatCentsCompact } from '@/lib/format-money';
import { ThemedText, type ThemedTextProps } from './themed-text';

type AnimatedMoneyProps = {
  cents: number;
  durationMs?: number;
  themeColor?: ThemedTextProps['themeColor'];
  style?: StyleProp<TextStyle>;
};

/**
 * Count-up money display for hero numbers. Deliberately JS-driven (rAF +
 * setState) rather than a worklet: Intl-based currency formatting can't run
 * on the UI runtime. Renders instantly when the user prefers reduced motion.
 */
export function AnimatedMoney({ cents, durationMs = 700, themeColor = 'accent', style }: AnimatedMoneyProps) {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    // Reduced motion renders the final value directly (see below) — no
    // animation loop, and no setState inside the effect body.
    if (reducedMotion) return;

    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(cents * eased));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [cents, durationMs, reducedMotion]);

  // The visible string changes ~60x/sec during the count-up. A fixed label of
  // the final amount stops VoiceOver re-announcing every frame, and keeps the
  // announced value truthful the moment the element is focused.
  return (
    <ThemedText
      type="money"
      themeColor={themeColor}
      accessible
      accessibilityLabel={formatCentsCompact(cents)}
      style={style}>
      {formatCentsCompact(reducedMotion ? cents : display)}
    </ThemedText>
  );
}
