import type { CampaignListItem } from '@creatordocks/shared';
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';
import { renderWithProviders, screen } from '@/test/render';
import { CampaignTile } from './campaign-tile';

/**
 * Two bugs, both invisible in a screenshot.
 *
 * The entrance fade replayed on every search keystroke and every category
 * change: the Discover masonry re-buckets its columns as the feed filters, a
 * campaign that moves between columns gets a different parent, React remounts
 * it, and Reanimated runs `entering` again. The whole feed re-faded while the
 * creator was still typing.
 *
 * The price pill and the brand initials both hard-coded '#ffffff'. Only one of
 * them is the `onAccent` pairing — the pill sits on `accentFill`, which was
 * chosen so white clears 4.5:1 on it. The initials sit on generated cover art
 * and are a different case, which is why they keep their literal.
 */
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'dark' }));

function campaign(id: string): CampaignListItem {
  return {
    id,
    title: 'Summer capsule',
    budget: 15000,
    deadline: '2099-01-01T00:00:00.000Z',
    niche: 'Fashion',
    platforms: ['tiktok'],
    creatorsNeeded: 3,
    createdAt: '2026-08-01T00:00:00.000Z',
    brand: { name: 'Test Brand', avatarUrl: null },
  };
}

describe('CampaignTile', () => {
  describe('entrance animation', () => {
    it('plays the first time a campaign appears', async () => {
      const view = await renderWithProviders(<CampaignTile campaign={campaign('camp_first')} width={160} index={0} />);

      expect(view.toJSON()?.props.entering).toBeTruthy();
    });

    it('does not replay when the same campaign is remounted by a re-filter', async () => {
      const first = await renderWithProviders(
        <CampaignTile campaign={campaign('camp_refilter')} width={160} index={0} />,
      );
      expect(first.toJSON()?.props.entering).toBeTruthy();
      await first.unmount();

      // The masonry moved this campaign into another column, so React tears the
      // tile down and builds a new one. It has still already been seen.
      const second = await renderWithProviders(
        <CampaignTile campaign={campaign('camp_refilter')} width={160} index={2} />,
      );

      expect(second.toJSON()?.props.entering).toBeUndefined();
    });

    it('still plays for a campaign the creator has not seen yet', async () => {
      const seen = await renderWithProviders(<CampaignTile campaign={campaign('camp_seen')} width={160} index={0} />);
      await seen.unmount();

      const fresh = await renderWithProviders(
        <CampaignTile campaign={campaign('camp_unseen')} width={160} index={1} />,
      );

      // The set remembers campaigns, not tiles: a different campaign is a
      // genuine first appearance and still gets its fade.
      expect(fresh.toJSON()?.props.entering).toBeTruthy();
    });
  });

  describe('colour tokens', () => {
    it('draws the price pill label with onAccent', async () => {
      await renderWithProviders(<CampaignTile campaign={campaign('camp_price')} width={160} index={0} />);

      // The tile is one `accessible` element — VoiceOver reads its composed
      // sentence, so every inner Text is hidden from the tree by design.
      const price = screen.getByText('$150', { includeHiddenElements: true });
      expect(StyleSheet.flatten(price.props.style).color).toBe(Colors.dark.onAccent);
    });

    it('keeps the brand initials off the Dynamic Type scale', async () => {
      await renderWithProviders(<CampaignTile campaign={campaign('camp_mark')} width={160} index={0} />);

      // Rule 3 of the Dynamic Type policy: a glyph in an 18pt disc that cannot
      // grow, whose information is spelled out in full right beside it.
      expect(screen.getByText('TB', { includeHiddenElements: true }).props.allowFontScaling).toBe(false);
      expect(screen.getByText('Test Brand', { includeHiddenElements: true })).toBeOnTheScreen();
    });
  });
});
