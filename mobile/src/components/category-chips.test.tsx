import * as Haptics from 'expo-haptics';
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { ALL_CATEGORIES, CategoryChips } from './category-chips';

/**
 * The chip was a fixed 34pt box around a 14pt label, which clips at the very
 * first accessibility text size — the niche filter turned into a row of
 * half-eaten words. Its active label was also a hard-coded '#ffffff', invisible
 * to any contrast audit, rather than the `onAccent` token that names the
 * pairing.
 */
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'dark' }));

const CATEGORIES = [ALL_CATEGORIES, 'Fashion', 'Fitness'] as const;

function setup(value: string = ALL_CATEGORIES) {
  const onChange = jest.fn();
  return { onChange, ui: <CategoryChips categories={CATEGORIES} value={value} onChange={onChange} /> };
}

describe('CategoryChips', () => {
  it('grows with Dynamic Type instead of clipping its label', async () => {
    const { ui } = setup();
    await renderWithProviders(ui);

    const chip = StyleSheet.flatten(screen.getByText('Fashion').parent?.props.style);
    expect(chip.height).toBeUndefined();
    expect(chip.minHeight).toBe(34);
    // Padding is what holds the resting height at 34 now that it is a floor.
    expect(chip.paddingVertical).toBeGreaterThan(0);
  });

  it('marks the selected chip for assistive tech', async () => {
    const { ui } = setup('Fashion');
    await renderWithProviders(ui);

    expect(screen.getByRole('button', { name: 'Fashion', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fitness', selected: false })).toBeOnTheScreen();
  });

  it('labels the active chip with onAccent, the token rated for accentFill', async () => {
    const { ui } = setup('Fashion');
    await renderWithProviders(ui);

    expect(StyleSheet.flatten(screen.getByText('Fashion').props.style).color).toBe(Colors.dark.onAccent);
    expect(StyleSheet.flatten(screen.getByText('Fitness').props.style).color).toBe(Colors.dark.textSecondary);
  });

  it('reports a selection change with a selection haptic', async () => {
    const { ui, onChange } = setup();
    await renderWithProviders(ui);

    await fireEvent.press(screen.getByText('Fitness'));

    expect(onChange).toHaveBeenCalledWith('Fitness');
    // A filter switch is a selection, not a button press.
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('stays silent when the already-active chip is tapped', async () => {
    const { ui, onChange } = setup('Fashion');
    await renderWithProviders(ui);

    await fireEvent.press(screen.getByText('Fashion'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
