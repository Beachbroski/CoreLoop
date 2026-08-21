import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { StaleDataBanner } from './stale-data-banner';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: jest.fn() }));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

/** Apple's minimum; the four hand-rolled copies rendered a 36pt target. */
const MIN_TOUCH_TARGET = 44;

/**
 * This banner existed four times — discover, activity, profile and earnings —
 * as four byte-identical copies, which is why one 36pt Retry target and one
 * sub-AA amber shipped in four places at once. Extracting it is only half the
 * fix; these tests are the half that stops it drifting back.
 */
beforeEach(() => mockUseColorScheme.mockReset().mockReturnValue('light'));

/**
 * The tinted row itself. It carries no role of its own — a layout View only
 * exposes one when it is an accessibility element, and making this one
 * accessible would swallow the Retry — so it is reached through the message it
 * wraps rather than through a testID that exists only for this file.
 */
function bannerShell() {
  const shell = screen.getByRole('alert').parent;
  if (!shell) throw new Error('StaleDataBanner rendered its message outside any shell.');
  return shell;
}

describe('StaleDataBanner', () => {
  it('reports the failure without taking the content away', async () => {
    await renderWithProviders(<StaleDataBanner message="Couldn't refresh campaigns." onRetry={jest.fn()} />);

    expect(screen.getByText("Couldn't refresh campaigns.")).toBeOnTheScreen();
  });

  it('retries on press', async () => {
    const onRetry = jest.fn();

    await renderWithProviders(<StaleDataBanner message="Couldn't refresh." onRetry={onRetry} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  /**
   * The regression that matters most. The old copies reached 36pt via an 8pt
   * `hitSlop`, which is both short of the minimum and invisible — a real
   * minHeight is a target the creator can see as well as hit.
   */
  it('gives Retry a real 44pt touch target rather than an invisible hitSlop', async () => {
    await renderWithProviders(<StaleDataBanner message="Couldn't refresh." onRetry={jest.fn()} />);

    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(retry).toHaveStyle({ minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET });
    expect(retry.props.hitSlop).toBeUndefined();
  });

  it.each(['light', 'dark'] as const)('uses the %s warning tokens, not a hard-coded amber', async (scheme) => {
    mockUseColorScheme.mockReturnValue(scheme);

    await renderWithProviders(<StaleDataBanner message="Couldn't refresh." onRetry={jest.fn()} />);

    expect(screen.getByText("Couldn't refresh.")).toHaveStyle({ color: Colors[scheme].warning });
    expect(screen.getByText('Retry')).toHaveStyle({ color: Colors[scheme].warning });
    expect(bannerShell()).toHaveStyle({ backgroundColor: Colors[scheme].warningSoft });
  });

  /**
   * `alert` on the container rather than `accessible`: collapsing the row into
   * a single element would swallow the Retry, leaving a screen-reader user
   * told about a failure they cannot act on.
   */
  it('announces the message as an alert while keeping Retry separately focusable', async () => {
    await renderWithProviders(<StaleDataBanner message="Couldn't refresh." onRetry={jest.fn()} />);

    // Two stops, not one. A row collapsed into a single accessible element
    // reads the failure and hides the only control that answers it.
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't refresh.");
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
    expect(bannerShell()).toHaveProp('accessibilityLiveRegion', 'polite');
  });

  it('accepts screen-supplied placement without losing its own fill', async () => {
    await renderWithProviders(
      <StaleDataBanner message="Couldn't refresh." onRetry={jest.fn()} style={{ marginHorizontal: 24 }} />,
    );

    expect(bannerShell()).toHaveStyle({
      marginHorizontal: 24,
      backgroundColor: Colors.light.warningSoft,
    });
  });
});
