import { StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { ThemedText } from './themed-text';

// Matches app/globals.css's .brand-mark exactly: a 24%-radius rounded square,
// coral background, bold white "D". The web app renders this as an inline
// SVG data URI; here it's just a View + Text, same visual result.
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size * 0.24, backgroundColor: Brand.coral },
      ]}>
      <ThemedText style={[styles.letter, { fontSize: size * 0.5 }]}>D</ThemedText>
    </View>
  );
}

/** Logo + "CreatorDocks", matching web's .brand-lockup nav treatment. */
export function BrandLockup({ size = 34 }: { size?: number }) {
  return (
    <View style={styles.lockup}>
      <Logo size={size} />
      <ThemedText type="smallBold" style={styles.wordmark}>
        CreatorDocks
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Brand.coral,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  letter: {
    color: '#ffffff',
    fontWeight: '900',
  },
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    letterSpacing: -0.3,
  },
});
