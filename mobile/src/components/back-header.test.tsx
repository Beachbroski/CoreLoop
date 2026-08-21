import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { act, fireEvent, renderWithProviders, screen } from '@/test/render';
import { BackHeader } from './back-header';

/**
 * A Pressable's `pressed` style is only reachable through the touch responder —
 * RNTL 14 dropped the UNSAFE queries that used to let a test read the style
 * callback directly, and `fireEvent(el, 'pressIn')` never reaches it because
 * the rendered host View carries responder handlers, not `onPressIn`. Granting
 * the responder is what actually flips the state.
 */
const RESPONDER_GRANT = {
  persist: () => {},
  nativeEvent: { touches: [], changedTouches: [], identifier: 1, pageX: 0, pageY: 0, locationX: 0, locationY: 0, target: 1, timestamp: 0, force: 0 },
};

async function pressAndHold(element: Parameters<typeof fireEvent>[0]): Promise<void> {
  await act(async () => {
    fireEvent(element, 'responderGrant', RESPONDER_GRANT);
  });
}

/**
 * Wave 1 turned `discover/[id]/apply` and `activity/submissions/new` into
 * modals. A chevron-left on a sheet promises a screen to go back TO, and a
 * sheet has none — it slides back down where it came from. The variant exists
 * so the affordance matches the presentation; `router.back()` dismisses either.
 */
describe('BackHeader', () => {
  it('draws a Back affordance for a pushed screen', async () => {
    await renderWithProviders(<BackHeader />);

    expect(screen.getByLabelText('Back')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Cancel')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('draws a Cancel affordance for a sheet', async () => {
    await renderWithProviders(<BackHeader variant="modal" />);

    expect(screen.getByLabelText('Cancel')).toBeOnTheScreen();
    expect(screen.getByText('Cancel')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Back')).toBeNull();
  });

  it('renders an optional title beside either affordance', async () => {
    await renderWithProviders(<BackHeader variant="modal" title="Apply" />);

    expect(screen.getByText('Apply')).toBeOnTheScreen();
  });

  it('dismisses through the router in both variants', async () => {
    // jest.setup.js mocks `useRouter` with a singleton, so this is the very
    // object the component navigates with.
    const router = useRouter();
    const { rerender } = await renderWithProviders(<BackHeader />);

    await fireEvent.press(screen.getByLabelText('Back'));
    expect(router.back).toHaveBeenCalledTimes(1);

    await rerender(<BackHeader variant="modal" />);
    await fireEvent.press(screen.getByLabelText('Cancel'));
    // A sheet dismisses downward, but it is still `router.back()` that does it.
    expect(router.back).toHaveBeenCalledTimes(2);
  });

  it('acknowledges the press visually, not only with a haptic', async () => {
    await renderWithProviders(<BackHeader />);

    // The haptic used to be the entire acknowledgement: nothing on screen
    // responded to the touch, which reads as a dropped press on a slow dismiss.
    expect(StyleSheet.flatten(screen.getByLabelText('Back').props.style).opacity).toBeUndefined();

    await pressAndHold(screen.getByLabelText('Back'));

    expect(StyleSheet.flatten(screen.getByLabelText('Back').props.style).opacity).toBeLessThan(1);
  });
});
