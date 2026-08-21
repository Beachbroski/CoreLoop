import { act, renderWithProviders, screen } from '@/test/render';
import { AnimatedMoney } from './animated-money';

/**
 * The count-up is a first-appearance reveal, and it used to replay from $0 on
 * every value change — including a pull-to-refresh. For half a second the
 * earnings screen told a creator their lifetime total was $0 and then counted
 * it back up, which is the one number in the app that must never lie.
 *
 * Frames are driven by hand rather than by timers: the component reads
 * `performance.now()` for its start stamp and takes the timestamp rAF hands
 * back, so controlling both makes every assertion exact instead of flaky.
 */

let pendingFrames: ((timestamp: number) => void)[] = [];
let clock = 0;

/** Runs the next queued frame at `clock + elapsedMs`. */
async function advanceOneFrame(elapsedMs: number): Promise<void> {
  const next = pendingFrames.shift();
  if (!next) throw new Error('No animation frame was scheduled');
  await act(async () => {
    next(clock + elapsedMs);
  });
}

beforeEach(() => {
  clock = 1000;
  pendingFrames = [];
  jest.spyOn(performance, 'now').mockImplementation(() => clock);
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
    pendingFrames.push(callback);
    return pendingFrames.length;
  });
  jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AnimatedMoney', () => {
  it('counts up from zero the first time a total appears', async () => {
    await renderWithProviders(<AnimatedMoney cents={10000} durationMs={700} />);

    expect(screen.getByText('$0')).toBeOnTheScreen();

    await advanceOneFrame(700);

    expect(screen.getByText('$100')).toBeOnTheScreen();
  });

  it('resumes from what is on screen instead of restaging from $0', async () => {
    const { rerender } = await renderWithProviders(<AnimatedMoney cents={10000} durationMs={700} />);
    await advanceOneFrame(700);
    expect(screen.getByText('$100')).toBeOnTheScreen();

    // A pull-to-refresh that nudges the lifetime total upward.
    await act(async () => {
      rerender(<AnimatedMoney cents={12000} durationMs={700} />);
    });

    // The old behaviour showed "$0" here for a frame before counting back up.
    expect(screen.queryByText('$0')).toBeNull();
    await advanceOneFrame(350);
    // Halfway through an ease-out cubic from $100, not from $0.
    expect(screen.getByText('$117.50')).toBeOnTheScreen();

    await advanceOneFrame(700);
    expect(screen.getByText('$120')).toBeOnTheScreen();
  });

  it('does not restage at all when a refetch returns the same total', async () => {
    const { rerender } = await renderWithProviders(<AnimatedMoney cents={10000} durationMs={700} />);
    await advanceOneFrame(700);
    pendingFrames = [];

    await act(async () => {
      rerender(<AnimatedMoney cents={10000} durationMs={700} />);
    });

    expect(pendingFrames).toHaveLength(0);
    expect(screen.getByText('$100')).toBeOnTheScreen();
  });

  it('announces the final amount from the very first frame', async () => {
    await renderWithProviders(<AnimatedMoney cents={10000} durationMs={700} />);

    // The visible string changes ~60x/sec; the announced one must not, and must
    // be true the moment VoiceOver lands on it.
    expect(screen.getByLabelText('$100')).toBeOnTheScreen();
  });
});
