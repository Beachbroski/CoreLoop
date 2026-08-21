import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deadlineSignal, isNewCampaign, spotsLabel, tileAspectRatio } from '@/lib/campaign-signals';
import { coverArtSpec } from '@/lib/cover-art';
import { formatCentsCompact } from '@/lib/format-money';
import { CoverArt } from './cover-art';
import { ThemedText } from './themed-text';

import type { CampaignListItem } from '@creatordocks/shared';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const ENTRANCE_MS = 300;
const ENTRANCE_STAGGER_MS = 55;
const ENTRANCE_CAP = 10;

/**
 * Campaign ids whose entrance has already played. Reanimated runs `entering`
 * on every MOUNT, and the Discover masonry re-buckets its columns on every
 * search keystroke and every category change — a campaign that moves from
 * column 0 to column 1 gets a different parent, so React unmounts and remounts
 * it and the whole feed re-fades while the creator is still typing.
 *
 * Module scope, not React state, precisely because React state is what the
 * remount throws away. It holds one cuid per campaign the creator has actually
 * seen — a few hundred short strings in the longest realistic session — and it
 * is intentionally never pruned: forgetting an id would replay the animation,
 * which is the bug.
 */
const enteredCampaignIds = new Set<string>();

function brandInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  return (letters || name[0] || '•').toUpperCase();
}

type TileLabelParts = {
  title: string;
  brandName: string;
  payout: string;
  niche: string;
  spots: string | null;
  deadlineLabel: string;
  isNew: boolean;
};

/**
 * One sentence for VoiceOver. Without it the tile announces as ~6 disconnected
 * fragments ("New", "$1,200", "Acme", "Ends in 4h", …) with no indication they
 * describe the same campaign.
 */
function tileAccessibilityLabel(parts: TileLabelParts): string {
  return [
    parts.title,
    `by ${parts.brandName}`,
    `${parts.payout} payout`,
    parts.niche,
    parts.spots,
    parts.deadlineLabel,
    parts.isNew ? 'New' : null,
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * One mosaic tile: cover art (shape varies per campaign) with the payout
 * overlaid, then a caption. Signals are all derived from real API data —
 * deadline urgency, freshness, open spots — never invented social proof.
 */
export function CampaignTile({
  campaign,
  width,
  index,
  maxArtHeight,
}: {
  campaign: CampaignListItem;
  width: number;
  index: number;
  /** Caps the cover art so a full-width tile doesn't become a tall slab. */
  maxArtHeight?: number;
}) {
  const theme = useTheme();
  const router = useRouter();
  const pressed = useSharedValue(0);

  // Lazy initialiser, so the answer is fixed for the life of this mount even
  // though the effect below mutates the set a moment later.
  const [isFirstAppearance] = useState(() => !enteredCampaignIds.has(campaign.id));

  useEffect(() => {
    enteredCampaignIds.add(campaign.id);
  }, [campaign.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.97]) }],
  }));

  function onPressIn() {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutated by design
    pressed.value = withTiming(1, { duration: 120 });
  }

  function onPressOut() {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutated by design
    pressed.value = withTiming(0, { duration: 120 });
  }

  function onPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/discover/${campaign.id}`);
  }

  const naturalArtHeight = width / tileAspectRatio(campaign.id);
  const artHeight = Math.round(maxArtHeight ? Math.min(naturalArtHeight, maxArtHeight) : naturalArtHeight);
  const deadline = deadlineSignal(campaign.deadline);
  const isNew = isNewCampaign(campaign.createdAt);
  const spots = spotsLabel(campaign.creatorsNeeded);
  const brandName = campaign.brand.name ?? 'A brand';
  const payout = formatCentsCompact(campaign.budget);
  // Only the darker palette stop is used behind the white initials: the light
  // stops score as low as 2.15:1 against white, the dark stops 5.70:1 or better.
  const [, markEnd] = coverArtSpec(campaign.id, campaign.niche).colors;

  return (
    <Animated.View
      entering={
        isFirstAppearance
          ? FadeIn.duration(ENTRANCE_MS).delay(Math.min(index, ENTRANCE_CAP) * ENTRANCE_STAGGER_MS)
          : undefined
      }>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessible
        accessibilityRole="button"
        accessibilityLabel={tileAccessibilityLabel({
          title: campaign.title,
          brandName,
          payout,
          niche: campaign.niche,
          spots,
          deadlineLabel: deadline.label,
          isNew,
        })}
        style={[
          styles.tile,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          animatedStyle,
        ]}>
        <CoverArt seed={campaign.id} niche={campaign.niche} height={artHeight} overlayStyle={styles.artOverlay}>
          <View style={styles.artTop}>
            {deadline.urgent && !deadline.passed ? (
              // Fixed Brand.coral, not `theme.accent`: this badge always sits on
              // a dark scrim over the cover art, so light mode's darkened
              // foreground coral would disappear into it.
              <View style={[styles.badge, styles.badgeUrgent, { borderColor: Brand.coral }]}>
                <View style={[styles.pulse, { backgroundColor: Brand.coral }]} />
                <ThemedText type="small" style={styles.badgeUrgentText}>
                  {deadline.label}
                </ThemedText>
              </View>
            ) : isNew ? (
              <View style={[styles.badge, styles.badgeNew]}>
                <ThemedText type="small" style={styles.badgeNewText}>
                  New
                </ThemedText>
              </View>
            ) : null}
          </View>

          {/* `accentFill` — the pill carries `onAccent` text, so it needs the
              darker fill coral (4.51:1) rather than the foreground `accent`
              (3.25:1). */}
          <View style={[styles.price, { backgroundColor: theme.accentFill }]}>
            <ThemedText type="smallBold" themeColor="onAccent" style={styles.priceText}>
              {payout}
            </ThemedText>
          </View>
        </CoverArt>

        <View style={styles.caption}>
          {/* Brand owns its own row — real brand names are long and were
              getting crushed to "Jacks…" when the niche shared the line. */}
          <View style={styles.brandRow}>
            {campaign.brand.avatarUrl ? (
              <Image source={{ uri: campaign.brand.avatarUrl }} style={styles.mark} contentFit="cover" />
            ) : (
              <View style={[styles.mark, { backgroundColor: markEnd }]}>
                {/* Rule 3 of the Dynamic Type policy (see themed-text.tsx): a
                    glyph in an 18pt disc that cannot grow, whose information —
                    the brand name — is spelled out in full right beside it. */}
                <ThemedText allowFontScaling={false} style={styles.markText}>
                  {brandInitials(brandName)}
                </ThemedText>
              </View>
            )}
            <ThemedText type="small" numberOfLines={1} style={styles.brandName}>
              {brandName}
            </ThemedText>
          </View>

          <ThemedText numberOfLines={2} style={styles.title}>
            {campaign.title}
          </ThemedText>

          <View style={styles.metaRow}>
            <View style={[styles.nicheDot, { backgroundColor: markEnd }]} />
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.niche}>
              {campaign.niche}
            </ThemedText>
            {spots ? (
              <>
                <ThemedText type="small" themeColor="textSecondary" style={styles.sep}>
                  ·
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {spots}
                </ThemedText>
              </>
            ) : null}
            {deadline.label ? (
              <>
                <ThemedText type="small" themeColor="textSecondary" style={styles.sep}>
                  ·
                </ThemedText>
                <ThemedText type="small" themeColor={deadline.urgent && !deadline.passed ? 'accent' : 'textSecondary'}>
                  {deadline.label}
                </ThemedText>
              </>
            ) : null}
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: Spacing.four - 4,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.16,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 2 },
    }),
  },
  artOverlay: {
    padding: Spacing.two + 2,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  artTop: {
    flexDirection: 'row',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Spacing.two + 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  badgeUrgent: {
    backgroundColor: 'rgba(9, 10, 14, 0.62)',
    borderWidth: 1,
  },
  badgeUrgentText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  badgeNew: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  badgeNewText: {
    color: '#16181f',
    fontWeight: '700',
  },
  pulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  price: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.two + 2,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 4,
  },
  priceText: {
    fontSize: 15,
    lineHeight: 19,
  },
  caption: {
    padding: Spacing.three - 4,
    gap: Spacing.one + 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  mark: {
    width: 18,
    height: 18,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  markText: {
    color: '#ffffff',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  brandName: {
    flexShrink: 1,
    fontWeight: '700',
  },
  nicheDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  niche: {
    flexShrink: 1,
  },
  title: {
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
  sep: {
    opacity: 0.5,
  },
});
