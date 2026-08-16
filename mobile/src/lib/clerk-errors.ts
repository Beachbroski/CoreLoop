/**
 * Classifies Clerk auth errors the sign-in screens need to react to, beyond
 * plain failure. Shapes follow Clerk's `{ errors: [{ code, message }] }`.
 */

function clerkErrorCodes(error: unknown): string[] {
  if (typeof error !== 'object' || error === null) return [];
  const entries = (error as { errors?: { code?: string }[] }).errors;
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => entry?.code).filter((code): code is string => typeof code === 'string');
}

/**
 * "You're already signed in" — a session already exists on the client, so the
 * new sign-in attempt is rejected. Recoverable: the caller can just proceed
 * into the app rather than dead-ending on an error.
 */
export function isSessionExistsError(error: unknown): boolean {
  return clerkErrorCodes(error).includes('session_exists');
}

/**
 * The session authenticated but is stuck on an unfinished Clerk task (e.g.
 * `choose-organization`, which Clerk requires when Organizations are enabled
 * and Personal Accounts are disabled). Clerk treats such a session as
 * signed-out, so the user silently can't get in — worth saying out loud
 * instead of showing a generic failure.
 */
export function isPendingSessionStatus(status: string | null | undefined): boolean {
  return status === 'pending';
}
