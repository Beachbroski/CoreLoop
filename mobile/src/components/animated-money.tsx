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
  /**
   * Where the next count-up starts. It is NOT always zero: the sweep from $0 is
   * the first-appearance reveal, and replaying it on every value change meant a
   * pull-to-refresh wiped the creator's lifetime earnings back to $0 and
   * re-counted them, which reads as "your money disappeared" for half a second.
   * Every subsequent change animates from whatever is currently on screen, so a
   * refresh that nudges the total moves the last digits and nothing else.
   *
   * A ref, not state, because it is updated once per animation frame and must
   * not itself schedule a render.
   */
  const startValue = useRef(0);

  useEffect(() => {
    // Reduced motion renders the final value directly (see below) — no
    // animation loop, and no setState inside the effect body. The start value
    // still tracks, so a mid-session settings change doesn't jump.
    if (reducedMotion) {
      startValue.current = cents;
      return;
    }

    const from = startValue.current;
    // Nothing to animate: a refetch that returns the same total should not
    // restage the number at all.
    if (from === cents) return;

    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (cents - from) * eased);
      // Tracked every frame so an interruption mid-sweep resumes from what the
      // creator can actually see, rather than snapping back to `from`.
      startValue.current = next;
      setDisplay(next);
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
