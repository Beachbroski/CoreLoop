import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { coverArtSpec, type CoverArtDecor } from '@/lib/cover-art';

type CoverArtProps = PropsWithChildren<{
  /** Campaign id — the stable seed for the generated artwork. */
  seed: string;
  /** Niche picks the palette family so related campaigns look related. */
  niche?: string;
  /** Future backend field: when a real cover image exists, it wins. */
  imageUrl?: string | null;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Styles for the absolute-fill overlay that hosts `children` (default: chip top-right). */
  overlayStyle?: StyleProp<ViewStyle>;
}>;

const WHITE = '#ffffff';

function Decor({ decor, pattern, height }: { decor: CoverArtDecor[]; pattern: string; height: number }) {
  // Decorative sizes key off the known height (width varies per layout);
  // circles just need equal w/h in px to stay circular.
  const reference = height * 1.5;

  return (
    <>
      {decor.map((d, i) => {
        const size = d.size * reference;
        const base = {
          position: 'absolute' as const,
          left: `${d.x * 100}%` as const,
          top: `${d.y * 100}%` as const,
          marginLeft: -size / 2,
          marginTop: -size / 2,
        };

        if (pattern === 'rings' || (pattern === 'arc' && i === 0)) {
          const ringSize = pattern === 'arc' ? size * 2.2 : size;
          return (
            <View
              key={i}
              style={{
                ...base,
                width: ringSize,
                height: ringSize,
                marginLeft: -ringSize / 2,
                marginTop: -ringSize / 2,
                borderRadius: ringSize / 2,
                borderWidth: Math.max(2, height * 0.07),
                borderColor: WHITE,
                opacity: d.opacity,
              }}
            />
          );
        }

        if (pattern === 'stripes') {
          return (
            <View
              key={i}
              style={{
                ...base,
                width: size * 2.4,
                height: height * 0.16,
                marginLeft: -size * 1.2,
                marginTop: -height * 0.08,
                borderRadius: 999,
                backgroundColor: WHITE,
                opacity: d.opacity,
                transform: [{ rotate: '-24deg' }],
              }}
            />
          );
        }

        // orbs (and arc's supporting elements)
        return (
          <View
            key={i}
            style={{
              ...base,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: WHITE,
              opacity: d.opacity,
            }}
          />
        );
      })}
    </>
  );
}

/**
 * Campaign cover artwork. Renders the real image when one exists (future
 * backend field); otherwise draws deterministic generated art from
 * lib/cover-art so every campaign has a distinct, stable visual identity.
 */
export function CoverArt({ seed, niche, imageUrl, height = 130, style, overlayStyle, children }: CoverArtProps) {
  const spec = coverArtSpec(seed, niche);

  return (
    <View style={[styles.container, { height }, style]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <LinearGradient
          colors={[spec.colors[0], spec.colors[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}>
          <Decor decor={spec.decor} pattern={spec.pattern} height={height} />
        </LinearGradient>
      )}
      {children ? <View style={[styles.overlay, overlayStyle]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
});
