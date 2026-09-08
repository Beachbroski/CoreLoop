import { useSignInWithApple } from '@clerk/clerk-expo';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isPendingSessionStatus, isSessionExistsError } from '@/lib/clerk-errors';

/**
 * Matches `PrimaryButton`'s `minHeight` and the OAuth buttons' corner radius so
 * the three sit together as one stack. Both are passed as props rather than
 * style: Apple's button forbids setting `backgroundColor` or `borderRadius`
 * through `style`, and `cornerRadius` is the sanctioned way to round it.
 */
const BUTTON_HEIGHT = 52;

/**
 * Sign in with Apple.
 *
 * Required by App Store Review Guideline 4.8: an app offering third-party
 * sign-in (here Google and TikTok) must also offer an equivalent privacy-
 * preserving option, and Apple's is the one that qualifies.
 *
 * Uses the system `ASAuthorizationAppleIDButton` via
 * `AppleAuthentication.AppleAuthenticationButton` rather than a look-alike.
 * Apple's Human Interface Guidelines govern the wording, logo, colours and
 * proportions of this button, and the system control is automatically
 * compliant, localized and accessible — a hand-rolled one is a rejection risk
 * for no gain.
 *
 * iOS-only by construction. `useSignInWithApple` is a stub that throws on every
 * other platform, and the underlying native flow does not exist there; web
 * would need `useSSO({ strategy: 'oauth_apple' })` instead. The app ships iOS
 * only, so that path is deliberately not built.
 */
export function AppleSignInButton({
  onError,
  disabled = false,
  onPendingChange,
}: {
  onError: (message: string) => void;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const router = useRouter();
  const scheme = useColorScheme();
  const [isSupported, setIsSupported] = useState(false);
  const [isPending, setIsPending] = useState(false);
  // The re-entrancy guard has to be a ref, not the `isPending` state. Two taps
  // land in the same tick before React re-renders, so a state read is still
  // `false` on the second one and two native sheets race — and `pointerEvents`
  // below cannot help either, since it only takes effect after that render.
  const inFlight = useRef(false);

  useEffect(() => {
    // Apple's own guidance: render the button only once availability is
    // confirmed. It is false on a device signed out of iCloud and on any
    // platform without the native module, where the component renders nothing
    // and warns in development.
    if (Platform.OS !== 'ios') return;

    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (active) setIsSupported(available);
      })
      .catch(() => {
        // Availability is a capability probe, not an action the creator took.
        // A failure here means "no Apple button", never an error on screen.
        if (active) setIsSupported(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function onPress() {
    if (inFlight.current || disabled) return;

    inFlight.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsPending(true);
    onPendingChange?.(true);

    try {
      // Clerk's hook owns the whole exchange: it raises the native sheet with a
      // nonce, posts the resulting identity token as `oauth_token_apple`, and —
      // when Apple returns someone with no CreatorDocks account yet — transfers
      // the attempt into a sign-up. That last step is why this is one button
      // rather than separate sign-in and sign-up paths.
      const { createdSessionId, setActive, signIn, signUp } = await startAppleAuthenticationFlow();

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/discover');
        return;
      }

      if (isPendingSessionStatus(signIn?.status) || isPendingSessionStatus(signUp?.status)) {
        // Authenticated, but the session is held by an unfinished Clerk task,
        // which Clerk reports as signed-out. Same dead end the password and
        // OAuth paths call out rather than leaving as a silent no-op.
        onError("Sign-in couldn't be completed for this account. Please contact support.");
        return;
      }

      // Everything else that reaches here is a cancellation — Clerk swallows
      // Apple's ERR_REQUEST_CANCELED and returns a null session — so say
      // nothing. Someone who backed out of the sheet did not hit an error.
    } catch (err) {
      if (isSessionExistsError(err)) {
        // Already signed in on this device. Nothing to fix; just go.
        router.replace('/discover');
        return;
      }
      if (__DEV__) console.error('[apple-auth] flow failed', err);
      onError('Unable to continue with Apple. Please try again.');
    } finally {
      inFlight.current = false;
      setIsPending(false);
      onPendingChange?.(false);
    }
  }

  if (Platform.OS !== 'ios' || !isSupported) return null;

  const isInert = disabled || isPending;

  return (
    // The native button exposes no disabled state, so interaction is blocked
    // from the wrapper. Without this, a second tap while the sheet is opening
    // starts a competing flow.
    <View pointerEvents={isInert ? 'none' : 'auto'} style={{ opacity: isInert ? 0.6 : 1 }}>
      <AppleAuthentication.AppleAuthenticationButton
        testID="apple-sign-in-button"
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        // White on the dark theme, black on the light one — the two Apple
        // permits that keep contrast against the surface behind them.
        buttonStyle={
          scheme === 'dark'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={Spacing.two}
        style={styles.button}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: BUTTON_HEIGHT,
  },
});
