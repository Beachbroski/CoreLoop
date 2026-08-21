import { useAuth } from '@clerk/clerk-expo';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useImageUploader } from '@/lib/uploadthing';
import { ThemedText } from './themed-text';

type ContentUploadFieldProps = {
  /** The uploaded content URL, or null before anything is uploaded. */
  value: string | null;
  onUploaded: (url: string) => void;
  onError: (message: string) => void;
};

/**
 * Pick → upload → preview control for submission content. Replaces the old
 * raw-URL text field: creators upload real media through UploadThing (our
 * bearer-authed /api/v1/uploads route) and the resulting URL feeds the
 * create/resubmit mutations.
 */
export function ContentUploadField({ value, onUploaded, onError }: ContentUploadFieldProps) {
  const theme = useTheme();
  const { getToken } = useAuth();

  const { openImagePicker, isUploading } = useImageUploader('mobileContentUploader', {
    headers: async (): Promise<Record<string, string>> => {
      const token = await getToken();
      return token ? { authorization: `Bearer ${token}` } : {};
    },
    onClientUploadComplete: (res) => {
      const uploaded = res?.[0]?.ufsUrl ?? res?.[0]?.url;
      if (!uploaded) {
        // Without this branch the spinner just stops: no preview, no error, and
        // Submit then complains the content is missing for no visible reason.
        onError("Upload finished but didn't return a file. Please try again.");
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUploaded(uploaded);
    },
    // Surface the server's reason (e.g. the waitlist-mode allowlist rejection);
    // a generic "try again" tells the user to repeat something that can't work.
    onUploadError: (err) => onError(err?.message || 'Upload failed. Please try again.'),
  });

  function pick() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // openImagePicker returns a promise — an unhandled rejection here would
    // leave the user staring at a control that silently did nothing.
    void openImagePicker({
      source: 'library',
      onInsufficientPermissions: () => onError('Photo access is needed to upload content.'),
      onCancel: () => {},
    })?.catch(() => onError("Couldn't open your photo library. Please try again."));
  }

  if (isUploading) {
    return (
      <View
        accessible
        accessibilityLabel="Uploading content"
        accessibilityState={{ busy: true }}
        style={[
          styles.tile,
          styles.center,
          { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
        ]}>
        <ActivityIndicator color={theme.accent} />
        <ThemedText type="small" themeColor="textSecondary">
          Uploading…
        </ThemedText>
      </View>
    );
  }

  if (value) {
    return (
      <Pressable
        onPress={pick}
        accessibilityRole="button"
        accessibilityLabel="Replace uploaded content"
        accessibilityHint="Opens your photo library"
        // Same pressed feedback as the empty state. Without it the only tappable
        // thing on the Submit screen that already has content looks inert.
        style={({ pressed }) => [
          styles.tile,
          {
            backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
            borderColor: theme.borderStrong,
          },
        ]}>
        <Image
          source={{ uri: value }}
          style={styles.preview}
          contentFit="cover"
          transition={150}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={styles.replaceRow}>
          <SymbolView
            name={{ ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' }}
            size={15}
            tintColor={theme.accent}
          />
          <ThemedText type="smallBold" themeColor="accent">
            Replace
          </ThemedText>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={pick}
      accessibilityRole="button"
      accessibilityLabel="Upload content"
      accessibilityHint="Pick a photo from your library"
      style={({ pressed }) => [
        styles.tile,
        styles.center,
        styles.empty,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: theme.borderStrong,
        },
      ]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}>
        <SymbolView
          name={{ ios: 'photo.badge.plus', android: 'add_photo_alternate', web: 'add_photo_alternate' }}
          size={24}
          tintColor={theme.accent}
        />
      </View>
      <ThemedText type="smallBold">Upload content</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        Pick a photo from your library
      </ThemedText>
    </Pressable>
  );
}

// `borderStrong`, not `border`, in all three states: this tile has no label
// chrome and no fill of its own — the outline is the entire affordance, which
// is exactly the case 1.4.11 covers and the case the whisper-weight `border`
// token is explicitly not rated for. The focused/active look still comes from
// `theme.accent` elsewhere; here the resting outline had to carry the control.
const styles = StyleSheet.create({
  tile: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 160,
  },
  empty: {
    borderStyle: 'dashed',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  hint: {
    textAlign: 'center',
  },
  preview: {
    width: '100%',
    height: 200,
  },
  replaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
});
