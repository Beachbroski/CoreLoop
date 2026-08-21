import { StyleSheet, Text } from 'react-native';

import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { Collapsible } from './collapsible';

/**
 * The header was a bare Pressable wrapping a 24pt disc and one line of 14pt
 * text: a ~24pt tap target, announced by VoiceOver as plain text with no hint
 * it could be tapped and no indication of whether the section was already open.
 */
describe('Collapsible', () => {
  it('announces itself as a collapsed button before it is opened', async () => {
    await renderWithProviders(
      <Collapsible title="Details">
        <Text>Body</Text>
      </Collapsible>,
    );

    expect(screen.getByRole('button', { name: 'Details', expanded: false })).toBeOnTheScreen();
    expect(screen.queryByText('Body')).toBeNull();
  });

  it('reveals its content and flips the expanded state', async () => {
    await renderWithProviders(
      <Collapsible title="Details">
        <Text>Body</Text>
      </Collapsible>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getByText('Body')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Details', expanded: true })).toBeOnTheScreen();
  });

  it('closes again on a second press', async () => {
    await renderWithProviders(
      <Collapsible title="Details">
        <Text>Body</Text>
      </Collapsible>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Details' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Details' }));

    expect(screen.queryByText('Body')).toBeNull();
  });

  it('clears the 44pt minimum tap target and keeps hit slop at the edges', async () => {
    await renderWithProviders(
      <Collapsible title="Details">
        <Text>Body</Text>
      </Collapsible>,
    );

    const header = screen.getByRole('button', { name: 'Details' });
    expect(StyleSheet.flatten(header.props.style).minHeight).toBeGreaterThanOrEqual(44);
    expect(header.props.hitSlop).toBeTruthy();
  });
});
