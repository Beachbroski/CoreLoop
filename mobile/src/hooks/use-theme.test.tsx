import { renderHook } from '@testing-library/react-native';
import type { ColorSchemeName } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from './use-theme';

// Mocked at the app's own indirection module rather than at 'react-native'.
// Spreading `jest.requireActual('react-native')` invokes every deprecated
// module getter on the way through and blows up the suite before it runs —
// `use-color-scheme.ts` exists precisely to give us this seam.
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: jest.fn() }));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

/**
 * `useTheme` is the single point of failure for the whole UI: every screen and
 * component reads `theme.<token>` from it, so if it ever returns undefined the
 * first property access crashes the app rather than degrading one screen.
 *
 * React Native types `useColorScheme()` as `ColorSchemeName` and the runtime
 * has returned `null` (native module unavailable) and `'unspecified'` in the
 * wild. Both used to index `Colors` to undefined. These cases are cast because
 * the point is exactly that the runtime disagrees with the type.
 */
describe('useTheme', () => {
  beforeEach(() => mockUseColorScheme.mockReset());

  it('returns the dark palette for the dark scheme', async () => {
    mockUseColorScheme.mockReturnValue('dark');

    const { result } = await renderHook(() => useTheme());

    expect(result.current).toBe(Colors.dark);
  });

  it('returns the light palette for the light scheme', async () => {
    mockUseColorScheme.mockReturnValue('light');

    const { result } = await renderHook(() => useTheme());

    expect(result.current).toBe(Colors.light);
  });

  it.each([
    ['null (native module unavailable)', null],
    ['undefined', undefined],
    ["'unspecified'", 'unspecified'],
    ['an unknown future scheme', 'sepia'],
  ])('falls back to a usable palette for %s', async (_label, scheme) => {
    mockUseColorScheme.mockReturnValue(scheme as ColorSchemeName);

    const { result } = await renderHook(() => useTheme());

    // The specific palette matters less than the guarantee: never undefined.
    expect(result.current).toBe(Colors.light);
    expect(result.current).toBeDefined();
  });

  it('never yields an undefined token, whatever the scheme', async () => {
    const schemes = ['dark', 'light', null, undefined, 'unspecified'];

    for (const scheme of schemes) {
      mockUseColorScheme.mockReturnValue(scheme as ColorSchemeName);
      const { result } = await renderHook(() => useTheme());

      for (const [token, value] of Object.entries(result.current)) {
        expect([token, value]).not.toContain(undefined);
      }
    }
  });
});

/**
 * Both palettes must expose the same token set. A token present in one and
 * missing from the other renders as `undefined` in only one appearance mode —
 * the kind of bug that ships because everyone develops in dark mode.
 */
describe('Colors palettes', () => {
  it('define identical token sets in light and dark', () => {
    expect(Object.keys(Colors.light).sort()).toEqual(Object.keys(Colors.dark).sort());
  });

  it('define every token as a non-empty string', () => {
    for (const [mode, palette] of Object.entries(Colors)) {
      for (const [token, value] of Object.entries(palette)) {
        expect(`${mode}.${token}: ${typeof value}`).toBe(`${mode}.${token}: string`);
        expect(value).not.toBe('');
      }
    }
  });
});
