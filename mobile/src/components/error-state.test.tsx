import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { ErrorState } from './error-state';

/** Apple's minimum touch target. */
const MIN_TOUCH_TARGET = 44;

/**
 * Two different failures wear this component, and conflating them is the bug:
 *
 * - **Recoverable** — a 500, a dropped connection. A Retry is the right offer.
 * - **Terminal** — a confirmed 404 behind "no longer available". The resource
 *   is gone. A Retry there can only fail again, and a button that cannot
 *   succeed teaches the creator that the app is broken rather than that the
 *   campaign was withdrawn.
 *
 * The API keeps them apart by making the control the caller's decision:
 * `onRetry` for the first, `onDismiss` for the second.
 */
describe('ErrorState recoverable errors', () => {
  it('offers a Retry that calls back', async () => {
    const onRetry = jest.fn();

    await renderWithProviders(<ErrorState message="Couldn't load campaigns." onRetry={onRetry} />);
    expect(screen.getByText("Couldn't load campaigns.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps the Retry target at the 44pt minimum', async () => {
    await renderWithProviders(<ErrorState message="Couldn't load." onRetry={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Retry' })).toHaveStyle({ minHeight: MIN_TOUCH_TARGET });
  });
});

describe('ErrorState terminal errors', () => {
  it('offers no Retry when the caller supplies none', async () => {
    await renderWithProviders(<ErrorState message="This application is no longer available." />);

    expect(screen.getByText('This application is no longer available.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('offers a way out instead, so a detail screen is not a dead end', async () => {
    const onDismiss = jest.fn();

    await renderWithProviders(
      <ErrorState message="This submission is no longer available." onDismiss={onDismiss} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('lets a screen rename the exit when "Go back" would be a lie', async () => {
    await renderWithProviders(
      <ErrorState message="Gone." onDismiss={jest.fn()} dismissLabel="Back to activity" />,
    );

    expect(screen.getByRole('button', { name: 'Back to activity' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull();
  });

  it('renders both controls when a failure is recoverable and the screen escapable', async () => {
    await renderWithProviders(<ErrorState message="Couldn't load." onRetry={jest.fn()} onDismiss={jest.fn()} />);

    // Retry first: the act that might actually get the creator what they came for.
    expect(screen.getAllByRole('button').map((node) => node.props.accessibilityLabel)).toEqual([
      'Retry',
      'Go back',
    ]);
  });
});

describe('ErrorState accessibility', () => {
  it('announces the message as an alert while its actions stay separately focusable', async () => {
    await renderWithProviders(<ErrorState message="Couldn't load." onRetry={jest.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load.");
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  });

  it('hides the warning glyph, which only restates the message', async () => {
    await renderWithProviders(<ErrorState message="Couldn't load." />);

    // Absent from the default queries *because* it is hidden from the
    // accessibility tree — that absence is the assertion.
    expect(screen.queryByTestId('symbol-view')).toBeNull();
    expect(screen.getByTestId('symbol-view', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
