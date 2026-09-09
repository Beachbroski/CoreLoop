import type { CampaignListItem } from '@creatordocks/shared';

import DiscoverScreen from '@/app/(app)/discover/index';
import { ApiError } from '@/lib/api-client';
import { useCampaigns } from '@/lib/queries/use-campaigns';
import { fireEvent, renderWithProviders, screen } from '@/test/render';

/**
 * Discover is the first thing a creator sees, so its four states each need to
 * be right on their own: loading, hard failure, empty, and populated. Two of
 * them used to be wrong in ways that only show up on a bad connection —
 * a failed refetch wiped the loaded feed, and a category filter could survive
 * the disappearance of the chip that set it, stranding the creator on
 * "Nothing matches yet" with no control left to clear it.
 *
 * See src/lib/masonry.test.ts and src/lib/campaign-signals.test.ts for the
 * packing and aspect-ratio maths; this file is about what ends up on screen.
 */

jest.mock('@/lib/queries/use-campaigns', () => ({ useCampaigns: jest.fn() }));

const mockUseCampaigns = useCampaigns as jest.MockedFunction<typeof useCampaigns>;

/**
 * Deadlines are read against the real clock, and the "N live" count now depends
 * on them — so fixtures sit far enough either side of today that no assertion
 * in this file starts failing on a particular date.
 */
const OPEN_DEADLINE = '2099-01-01T00:00:00.000Z';
const PASSED_DEADLINE = '2020-01-01T00:00:00.000Z';

function campaign(overrides: Partial<CampaignListItem> & { id: string }): CampaignListItem {
  return {
    title: `Campaign ${overrides.id}`,
    budget: 15000,
    deadline: OPEN_DEADLINE,
    niche: 'Fashion',
    platforms: ['tiktok'],
    creatorsNeeded: 3,
    createdAt: '2026-08-01T00:00:00.000Z',
    brand: { name: 'Test Brand', avatarUrl: null },
    ...overrides,
  };
}

type CampaignsQuery = ReturnType<typeof useCampaigns>;

/**
 * React Query's result type is a discriminated union — `data` and `error` are
 * narrowed against each other per variant, so no single object literal
 * satisfies it. The screen only reads six fields, so the cast goes through
 * `unknown` rather than contorting the fixtures to please the union.
 */
type QueryState = {
  data?: { data: CampaignListItem[]; meta: { total: number; page: number; limit: number } };
  isLoading?: boolean;
  isRefetching?: boolean;
  isError?: boolean;
  error?: Error;
  refetch?: jest.Mock;
};

function queryState(state: QueryState): CampaignsQuery {
  return {
    data: undefined,
    isLoading: false,
    isRefetching: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    ...state,
  } as unknown as CampaignsQuery;
}

function feed(items: CampaignListItem[]) {
  return { data: items, meta: { total: items.length, page: 1, limit: 20 } };
}

beforeEach(() => mockUseCampaigns.mockReset());

describe('Discover states', () => {
  it('shows skeletons, not an empty state, while loading', async () => {
    mockUseCampaigns.mockReturnValue(queryState({ isLoading: true }));

    await renderWithProviders(<DiscoverScreen />);

    expect(screen.queryByText('No campaigns right now')).toBeNull();
    expect(screen.queryByText("Couldn't load campaigns.")).toBeNull();
  });

  it('shows a retryable error when nothing has ever loaded', async () => {
    const refetch = jest.fn();
    mockUseCampaigns.mockReturnValue(
      queryState({ isError: true, error: new ApiError('boom', 500), refetch }),
    );

    await renderWithProviders(<DiscoverScreen />);
    expect(screen.getByText("Couldn't load campaigns.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('keeps the loaded feed on screen when a refetch fails', async () => {
    mockUseCampaigns.mockReturnValue(
      queryState({
        isError: true,
        error: new ApiError('offline', 500),
        data: feed([campaign({ id: 'c1', title: 'Autumn lookbook' })]),
      }),
    );

    await renderWithProviders(<DiscoverScreen />);

    // The whole point: bad signal must not take the content away.
    expect(screen.getByText('Autumn lookbook')).toBeOnTheScreen();
    expect(screen.getByText("Couldn't refresh campaigns.")).toBeOnTheScreen();
    expect(screen.queryByText("Couldn't load campaigns.")).toBeNull();
  });

  it('distinguishes an empty feed from a filtered-to-nothing feed', async () => {
    mockUseCampaigns.mockReturnValue(queryState({ data: feed([]) }));

    await renderWithProviders(<DiscoverScreen />);

    expect(screen.getByText('No campaigns right now')).toBeOnTheScreen();
    expect(screen.queryByText('Nothing matches yet')).toBeNull();
  });

  it('renders campaigns with a live count', async () => {
    mockUseCampaigns.mockReturnValue(
      queryState({
        data: feed([
          campaign({ id: 'c1', title: 'Autumn lookbook' }),
          campaign({ id: 'c2', title: 'Gym opening', niche: 'Fitness' }),
        ]),
      }),
    );

    await renderWithProviders(<DiscoverScreen />);

    expect(screen.getByText('Autumn lookbook')).toBeOnTheScreen();
    expect(screen.getByText('Gym opening')).toBeOnTheScreen();
    expect(screen.getByText('2 live')).toBeOnTheScreen();
  });
});

describe('Discover search', () => {
  const items = [
    campaign({ id: 'c1', title: 'Autumn lookbook', niche: 'Fashion' }),
    campaign({ id: 'c2', title: 'Gym opening', niche: 'Fitness' }),
    campaign({ id: 'c3', title: 'Cafe launch', niche: 'Food', brand: { name: 'Blue Bottle', avatarUrl: null } }),
  ];

  beforeEach(() => mockUseCampaigns.mockReturnValue(queryState({ data: feed(items) })));

  it('matches on title', async () => {
    await renderWithProviders(<DiscoverScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('Search brands, niches, payouts…'), 'lookbook');

    expect(screen.getByText('Autumn lookbook')).toBeOnTheScreen();
    expect(screen.queryByText('Gym opening')).toBeNull();
  });

  it('matches on niche', async () => {
    await renderWithProviders(<DiscoverScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('Search brands, niches, payouts…'), 'fitness');

    expect(screen.getByText('Gym opening')).toBeOnTheScreen();
    expect(screen.queryByText('Autumn lookbook')).toBeNull();
  });

  it('matches on brand name', async () => {
    await renderWithProviders(<DiscoverScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('Search brands, niches, payouts…'), 'blue bottle');

    expect(screen.getByText('Cafe launch')).toBeOnTheScreen();
    expect(screen.queryByText('Gym opening')).toBeNull();
  });

  it('ignores case and surrounding whitespace', async () => {
    await renderWithProviders(<DiscoverScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('Search brands, niches, payouts…'), '  AUTUMN  ');

    expect(screen.getByText('Autumn lookbook')).toBeOnTheScreen();
  });

  it('explains that the emptiness came from the filter', async () => {
    await renderWithProviders(<DiscoverScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('Search brands, niches, payouts…'), 'zzzz');

    expect(screen.getByText('Nothing matches yet')).toBeOnTheScreen();
    expect(screen.queryByText('No campaigns right now')).toBeNull();
  });
});

describe('Discover category filter', () => {
  it('narrows the feed to the chosen category and titles the section with it', async () => {
    mockUseCampaigns.mockReturnValue(
      queryState({
        data: feed([
          campaign({ id: 'c1', title: 'Autumn lookbook', niche: 'Fashion' }),
          campaign({ id: 'c2', title: 'Gym opening', niche: 'Fitness' }),
          campaign({ id: 'c3', title: 'Cafe launch', niche: 'Food' }),
        ]),
      }),
    );
    await renderWithProviders(<DiscoverScreen />);
    expect(screen.getByText('Fresh drops')).toBeOnTheScreen();

    // By role, not by text: "Fitness" is also the niche printed on the tile.
    const chip = screen.getByRole('button', { name: 'Fitness' });
    await fireEvent.press(chip);

    expect(screen.getByText('Gym opening')).toBeOnTheScreen();
    expect(screen.queryByText('Autumn lookbook')).toBeNull();
    expect(screen.getByText('1 live')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fitness' })).toBeSelected();
  });

  it('clears a selection whose category vanished from the feed', async () => {
    const withFitness = feed([
      campaign({ id: 'c1', title: 'Autumn lookbook', niche: 'Fashion' }),
      campaign({ id: 'c2', title: 'Gym opening', niche: 'Fitness' }),
      campaign({ id: 'c3', title: 'Cafe launch', niche: 'Food' }),
    ]);
    mockUseCampaigns.mockReturnValue(queryState({ data: withFitness }));
    const { rerender } = await renderWithProviders(<DiscoverScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Fitness' }));
    expect(screen.getByText('Gym opening')).toBeOnTheScreen();

    // The refetch drops every Fitness campaign. Without the reset the creator
    // is stranded on "Nothing matches yet" with the Fitness chip gone.
    mockUseCampaigns.mockReturnValue(
      queryState({
        data: feed([
          campaign({ id: 'c1', title: 'Autumn lookbook', niche: 'Fashion' }),
          campaign({ id: 'c3', title: 'Cafe launch', niche: 'Food' }),
        ]),
      }),
    );
    await rerender(<DiscoverScreen />);

    expect(screen.getByText('Autumn lookbook')).toBeOnTheScreen();
    expect(screen.getByText('Cafe launch')).toBeOnTheScreen();
    expect(screen.queryByText('Nothing matches yet')).toBeNull();
    expect(screen.getByText('Fresh drops')).toBeOnTheScreen();
  });

  it('hides the chip row when there is only one niche to choose from', async () => {
    mockUseCampaigns.mockReturnValue(
      queryState({
        data: feed([
          campaign({ id: 'c1', niche: 'Fashion' }),
          campaign({ id: 'c2', niche: 'Fashion' }),
        ]),
      }),
    );

    await renderWithProviders(<DiscoverScreen />);

    // One niche means the row would be "All | Fashion" — two chips that filter
    // to the same thing.
    expect(screen.queryByText('All')).toBeNull();
  });
});

/**
 * `GET /api/v1/campaigns` filters expired campaigns out server-side, but React
 * Query serves the last fetched page while it refetches, so a deadline can pass
 * while its tile is still on screen. When that happens the header must not
 * claim the campaign is live — the creator would otherwise open the brief,
 * write a pitch, and only then be told the deadline has gone.
 */
describe('Discover live count', () => {
  it('leaves a campaign past its deadline out of the count', async () => {
    mockUseCampaigns.mockReturnValue(
      queryState({
        data: feed([
          campaign({ id: 'c1', title: 'Autumn lookbook' }),
          campaign({ id: 'c2', title: 'Expired drop', deadline: PASSED_DEADLINE }),
          campaign({ id: 'c3', title: 'Gym opening' }),
        ]),
      }),
    );

    await renderWithProviders(<DiscoverScreen />);

    expect(screen.getByText('2 live')).toBeOnTheScreen();
    // Still rendered, and honest about being shut — the count is what changed.
    expect(screen.getByText('Expired drop')).toBeOnTheScreen();
    expect(screen.getByText('Closed')).toBeOnTheScreen();
  });

  it('reports zero live when every campaign on screen has closed', async () => {
    mockUseCampaigns.mockReturnValue(
      queryState({
        data: feed([
          campaign({ id: 'c1', deadline: PASSED_DEADLINE }),
          campaign({ id: 'c2', deadline: PASSED_DEADLINE }),
        ]),
      }),
    );

    await renderWithProviders(<DiscoverScreen />);

    expect(screen.getByText('0 live')).toBeOnTheScreen();
    // "0 live" over visible tiles, not an empty state: there is still content.
    expect(screen.queryByText('No campaigns right now')).toBeNull();
  });

  it('counts only the live campaigns left after a category filter', async () => {
    mockUseCampaigns.mockReturnValue(
      queryState({
        data: feed([
          campaign({ id: 'c1', title: 'Autumn lookbook', niche: 'Fashion' }),
          campaign({ id: 'c2', title: 'Gym opening', niche: 'Fitness' }),
          campaign({ id: 'c3', title: 'Expired gym', niche: 'Fitness', deadline: PASSED_DEADLINE }),
        ]),
      }),
    );
    await renderWithProviders(<DiscoverScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Fitness' }));

    expect(screen.getByText('Gym opening')).toBeOnTheScreen();
    expect(screen.getByText('Expired gym')).toBeOnTheScreen();
    expect(screen.getByText('1 live')).toBeOnTheScreen();
  });
});

describe('Discover layout density', () => {
  it('lays a sparse feed out in a single column', async () => {
    mockUseCampaigns.mockReturnValue(
      queryState({ data: feed([campaign({ id: 'c1' }), campaign({ id: 'c2' })]) }),
    );

    await renderWithProviders(<DiscoverScreen />);

    // Two campaigns cannot fill a mosaic; the feed shows hero cards instead.
    expect(screen.getByText('2 live')).toBeOnTheScreen();
    expect(screen.getByText('Campaign c1')).toBeOnTheScreen();
    expect(screen.getByText('Campaign c2')).toBeOnTheScreen();
  });

  it('renders every campaign exactly once across the mosaic columns', async () => {
    const items = Array.from({ length: 7 }, (_, i) => campaign({ id: `c${i}` }));
    mockUseCampaigns.mockReturnValue(queryState({ data: feed(items) }));

    await renderWithProviders(<DiscoverScreen />);

    // Column packing is the easiest place to drop or duplicate a tile.
    for (const item of items) {
      expect(screen.getAllByText(item.title)).toHaveLength(1);
    }
    expect(screen.getByText('7 live')).toBeOnTheScreen();
  });
});
