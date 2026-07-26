import type { PropsWithChildren } from 'react';
import type { ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

type ScreenProps = PropsWithChildren<{
  edges?: readonly Edge[];
  style?: ViewStyle | ViewStyle[];
}>;

/**
 * Root container for every screen. Tab screens sit above the tab bar, which
 * already reserves the bottom safe area, so they only need `top`; stack-only
 * screens (pushed on top of a tab, or outside the tab navigator entirely —
 * auth, sso-callback) need both edges since nothing else claims that space.
 */
export function Screen({ children, edges = ['top'], style }: ScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: theme.background }, style]}>
      {children}
    </SafeAreaView>
  );
}
