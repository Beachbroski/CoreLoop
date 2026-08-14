/**
 * Distinguishes "the user changed their mind" from real OAuth failures so
 * sign-in screens never flash an error at someone who deliberately backed
 * out. Shapes verified against @clerk/clerk-expo useSSO + expo-web-browser:
 * cancellation surfaces as an auth-session RESULT (`type: 'cancel' |
 * 'dismiss'`), never a throw; the one thrown cancellation-equivalent is
 * Clerk's `oauth_access_denied` (user hit Deny on the provider's page).
 */

type AuthSessionResultLike = { type: string } | null | undefined;

export function isUserCancellation(result: AuthSessionResultLike): boolean {
  return result?.type === 'cancel' || result?.type === 'dismiss';
}

export function isUserCancelledError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const clerkErrors = (error as { errors?: { code?: string }[] }).errors;
  if (!Array.isArray(clerkErrors)) return false;
  return clerkErrors.some((entry) => entry?.code === 'oauth_access_denied');
}
