import * as Haptics from 'expo-haptics';
import { StyleSheet } from 'react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import { Colors } from '@/constants/theme';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { PrimaryButton } from './primary-button';

/**
 * The button's label and spinner were hard-coded '#ffffff' on a coral fill that
 * was chosen precisely so white clears 4.5:1 on it — a real pairing that no
 * contrast audit could see, because neither end of it had a name. `onAccent`
 * is that name, and theme.contrast.test.ts watches it.
 */
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'dark' }));

/**
 * RNTL 14 dropped the UNSAFE type queries and an ActivityIndicator has no text
 * and no accessible name to find it by — it is deliberately hidden from the
 * tree so VoiceOver reads the button's own wording. The rendered JSON is what
 * is left.
 */
function findHostNode(
  node: ReactTestRendererJSON | string | null,
  type: string,
): ReactTestRendererJSON | null {
  if (!node || typeof node === 'string') return null;
  if (node.type.includes(type)) return node;
  for (const child of node.children ?? []) {
    const found = findHostNode(child as ReactTestRendererJSON | string, type);
    if (found) return found;
  }
  return null;
}

describe('PrimaryButton', () => {
  it('labels itself with onAccent rather than a bare white literal', async () => {
    await renderWithProviders(<PrimaryButton onPress={jest.fn()}>Apply</PrimaryButton>);

    expect(StyleSheet.flatten(screen.getByText('Apply').props.style).color).toBe(Colors.dark.onAccent);
  });

  it('tints the loading spinner with the same token', async () => {
    const view = await renderWithProviders(
      <PrimaryButton onPress={jest.fn()} loading>
        Apply
      </PrimaryButton>,
    );

    const spinner = findHostNode(view.toJSON() as ReactTestRendererJSON | null, 'ActivityIndicator');
    expect(spinner?.props.color).toBe(Colors.dark.onAccent);
  });

  it('fires an impact haptic and the press handler', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<PrimaryButton onPress={onPress}>Apply</PrimaryButton>);

    await fireEvent.press(screen.getByRole('button', { name: 'Apply' }));

    expect(onPress).toHaveBeenCalled();
    // A button press, not a selection change.
    expect(Haptics.impactAsync).toHaveBeenCalled();
  });

  it('reports busy and refuses presses while loading', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <PrimaryButton onPress={onPress} loading>
        Apply
      </PrimaryButton>,
    );

    const button = screen.getByRole('button', { name: 'Apply' });
    expect(button).toBeBusy();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
