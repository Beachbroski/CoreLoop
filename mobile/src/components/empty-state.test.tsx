import { renderWithProviders, screen } from '@/test/render';
import { EmptyState } from './empty-state';

/**
 * An empty state is something that *arrives*: the list resolves and the
 * skeletons are swapped out underneath a screen reader whose focus is
 * elsewhere. Without a live region the announcement stops at "Loading
 * campaigns" and never says what loading found — the same silence
 * `SkeletonGroup` was built to break, one step later in the sequence.
 */
describe('EmptyState', () => {
  it('reads title and message as one thought', async () => {
    await renderWithProviders(
      <EmptyState symbol="tray" title="No campaigns right now" message="Check back soon." />,
    );

    expect(screen.getByLabelText('No campaigns right now, Check back soon.')).toBeOnTheScreen();
    expect(screen.getByText('No campaigns right now')).toBeOnTheScreen();
    expect(screen.getByText('Check back soon.')).toBeOnTheScreen();
  });

  it('announces the title alone when there is no hint to add', async () => {
    await renderWithProviders(<EmptyState symbol="tray" title="Nothing matches yet" />);

    expect(screen.getByLabelText('Nothing matches yet')).toBeOnTheScreen();
  });

  it('announces itself when it replaces a loading state', async () => {
    await renderWithProviders(<EmptyState symbol="tray" title="No campaigns right now" />);

    const region = screen.getByLabelText('No campaigns right now');
    expect(region).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(region.props.accessible).toBe(true);
  });

  it('hides the symbol, which only restates the title pictorially', async () => {
    await renderWithProviders(<EmptyState symbol="tray" title="No campaigns right now" />);

    // Absent from the default queries *because* it is hidden from the
    // accessibility tree — that absence is the assertion.
    expect(screen.queryByTestId('symbol-view')).toBeNull();
    expect(screen.getByTestId('symbol-view', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
