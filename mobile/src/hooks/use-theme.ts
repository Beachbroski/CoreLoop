/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  // React Native types useColorScheme() as non-nullable, but the underlying
  // Appearance module returns null whenever the native module is unavailable
  // (and 'unspecified' on some platforms). Indexing Colors with either would
  // yield undefined and crash on the first `theme.<token>` access — i.e. every
  // screen. Anything that isn't explicitly 'dark' falls back to light.
  const scheme = useColorScheme();

  return scheme === 'dark' ? Colors.dark : Colors.light;
}
