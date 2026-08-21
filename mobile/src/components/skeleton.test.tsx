import { renderWithProviders, screen } from '@/test/render';
import { Skeleton, SkeletonCard, SkeletonGroup, SkeletonRow } from './skeleton';

/**
 * Loading used to be completely silent to VoiceOver, and the cause was a fix:
 * every placeholder correctly hides itself, because stopping on twelve pulsing
 * grey blocks is torture. Nothing was put back in their place, so a blind
 * creator got an empty region and no way to tell a slow network from a broken
 * screen. `SkeletonGroup` is what speaks; these tests pin both halves — the
 * blocks stay silent, and the group does not.
 */
describe('Skeleton placeholders', () => {
  it('keeps a single block out of the accessibility tree', async () => {
    // Read off the rendered tree rather than a testID: the block deliberately
    // exposes no query handle, which is the property under test.
    const { toJSON } = await renderWithProviders(<Skeleton height={16} />);

    expect(toJSON()).toHaveProperty('props.accessibilityElementsHidden', true);
    expect(toJSON()).toHaveProperty('props.importantForAccessibility', 'no-hide-descendants');
  });

  it.each([
    ['SkeletonCard', <SkeletonCard key="card" />],
    ['SkeletonRow', <SkeletonRow key="row" />],
  ])('renders %s without contributing any announcement', async (_name, element) => {
    await renderWithProviders(element);

    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByLabelText(/loading/i)).toBeNull();
  });
});

describe('SkeletonGroup', () => {
  it('announces what is loading, once, for the whole placeholder region', async () => {
    await renderWithProviders(
      <SkeletonGroup label="Loading campaigns">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </SkeletonGroup>,
    );

    const group = screen.getByRole('progressbar');
    expect(group).toHaveProp('accessibilityLabel', 'Loading campaigns');
    expect(group.props.accessible).toBe(true);
    // One stop, not three: the cards underneath are all hidden.
    expect(screen.getAllByLabelText('Loading campaigns')).toHaveLength(1);
  });

  it('reports itself busy, so assistive tech knows to wait rather than re-read', async () => {
    await renderWithProviders(
      <SkeletonGroup label="Loading your earnings">
        <SkeletonRow />
      </SkeletonGroup>,
    );

    expect(screen.getByRole('progressbar')).toBeBusy();
  });

  it('takes screen-supplied layout without needing a wrapper View', async () => {
    await renderWithProviders(
      <SkeletonGroup label="Loading campaigns" style={{ gap: 12 }}>
        <SkeletonCard />
      </SkeletonGroup>,
    );

    expect(screen.getByRole('progressbar')).toHaveStyle({ gap: 12 });
  });
});
