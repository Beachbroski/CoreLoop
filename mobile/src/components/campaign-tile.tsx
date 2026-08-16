import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deadlineSignal, isNewCampaign, spotsLabel, tileAspectRatio } from '@/lib/campaign-signals';
import { coverArtSpec } from '@/lib/cover-art';
import { formatCentsCompact } from '@/lib/format-money';
import { CoverArt } from './cover-art';
import { ThemedText } from './themed-text';

import type { CampaignListItem } from '@creatordocks/shared';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const ENTRANCE_STAGGER_MS = 55;
const ENTRANCE_CAP = 10;

function brandInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  return (letters || name[0] || '•').toUpperCase();
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
}: {
  campaign: CampaignListItem;
  width: number;
  index: number;
}) {
  const theme = useTheme();
  const router = useRouter();
  const pressed = useSharedValue(0);

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

  const artHeight = Math.round(width / tileAspectRatio(campaign.id));
  const deadline = deadlineSignal(campaign.deadline);
  const isNew = isNewCampaign(campaign.createdAt);
  const spots = spotsLabel(campaign.creatorsNeeded);
  const brandName = campaign.brand.name ?? 'A brand';
  const [markStart, markEnd] = coverArtSpec(campaign.id, campaign.niche).colors;

  return (
    <Animated.View entering={FadeIn.duration(300).delay(Math.min(index, ENTRANCE_CAP) * ENTRANCE_STAGGER_MS)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          styles.tile,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          animatedStyle,
        ]}>
        <CoverArt seed={campaign.id} niche={campaign.niche} height={artHeight} overlayStyle={styles.artOverlay}>
          <View style={styles.artTop}>
            {deadline.urgent && !deadline.passed ? (
              <View style={[styles.badge, styles.badgeUrgent, { borderColor: theme.accent }]}>
                <View style={[styles.pulse, { backgroundColor: theme.accent }]} />
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

          <View style={[styles.price, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={styles.priceText}>
              {formatCentsCompact(campaign.budget)}
            </ThemedText>
          </View>
        </CoverArt>

        <View style={styles.caption}>
          <View style={styles.brandRow}>
            {campaign.brand.avatarUrl ? (
              <Image source={{ uri: campaign.brand.avatarUrl }} style={styles.mark} contentFit="cover" />
            ) : (
              <View style={[styles.mark, { backgroundColor: markStart }]}>
                <ThemedText style={styles.markText}>{brandInitials(brandName)}</ThemedText>
              </View>
            )}
            <ThemedText type="small" numberOfLines={1} style={styles.brandName}>
              {brandName}
            </ThemedText>
            <View style={[styles.nicheDot, { backgroundColor: markEnd }]} />
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.niche}>
              {campaign.niche}
            </ThemedText>
          </View>

          <ThemedText numberOfLines={2} style={styles.title}>
            {campaign.title}
          </ThemedText>

          <View style={styles.metaRow}>
            {spots ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  {spots}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.sep}>
                  ·
                </ThemedText>
              </>
            ) : null}
            {deadline.label ? (
              <ThemedText type="small" themeColor={deadline.urgent && !deadline.passed ? 'accent' : 'textSecondary'}>
                {deadline.label}
              </ThemedText>
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
    color: '#ffffff',
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
    marginLeft: 'auto',
  },
  niche: {
    flexShrink: 0,
    maxWidth: '45%',
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
