import { apiResponseSchema, type PaginationMeta } from '@creatordocks/shared';
import { z } from 'zod';

/**
 * How long one request may run before the client gives up on it.
 *
 * `fetch` on React Native has no timeout of its own: a request that leaves the
 * device on a captive-portal Wi-Fi or a stalled cell connection never settles,
 * so the query never resolves and the screen shows its skeleton forever. 15s is
 * comfortably above the slowest real /api/v1 response and well below the point
 * where a creator has already decided the app is broken.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Statuses for failures that never got as far as an HTTP status line.
 *
 * `TIMEOUT_STATUS` is deliberately a real 4xx: `shouldRetry` (query-client)
 * declines every 4xx, and a retried timeout costs another full REQUEST_TIMEOUT_MS
 * of spinner each time — three attempts is 45 seconds of nothing. A network
 * error keeps status 0 so it stays outside that band and is still retried,
 * which is the behaviour a dropped packet actually wants.
 */
export const TIMEOUT_STATUS = 408;
export const NETWORK_STATUS = 0;

/**
 * User-readable failure copy. Every error this module throws carries one of
 * these (or a message the server wrote for humans), so a screen can render
 * `error.message` directly instead of guessing from a status code.
 */
export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Sign in again to continue.';
export const TIMEOUT_MESSAGE = 'That took too long. Check your connection and try again.';
export const NETWORK_MESSAGE = "Couldn't reach CreatorDocks. Check your connection and try again.";
export const UNREADABLE_RESPONSE_MESSAGE = "The server sent something we couldn't read. Try again.";
export const UNEXPECTED_RESPONSE_MESSAGE = 'Unexpected response from server';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * The session is gone — expired, revoked, or signed out on another device.
 *
 * Typed rather than "an ApiError that happens to be 401" so the sign-out path
 * (`useSessionExpiry`) and any screen can branch on the thing itself.
 */
export class ApiAuthError extends ApiError {
  constructor(message: string = SESSION_EXPIRED_MESSAGE) {
    super(message, 401);
    this.name = 'ApiAuthError';
  }
}

/** The request was aborted by us at REQUEST_TIMEOUT_MS. */
export class ApiTimeoutError extends ApiError {
  constructor(message: string = TIMEOUT_MESSAGE) {
    super(message, TIMEOUT_STATUS);
    this.name = 'ApiTimeoutError';
  }
}

/** `fetch` itself rejected — no radio, DNS failure, TLS failure. */
export class ApiNetworkError extends ApiError {
  constructor(message: string = NETWORK_MESSAGE) {
    super(message, NETWORK_STATUS);
    this.name = 'ApiNetworkError';
  }
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiAuthError;
}

/* ------------------------------------------------------- auth failure bus -- */

type AuthFailureListener = () => void;

const authFailureListeners = new Set<AuthFailureListener>();

/**
 * Subscribes to "the server rejected our credentials". Returns an unsubscribe.
 *
 * This module cannot sign the creator out itself — that is Clerk's job, and
 * Clerk lives in React — and it must not navigate either: `(app)/_layout.tsx`
 * already redirects to `/sign-in` the moment `isSignedIn` goes false, so a
 * second redirect from here would race it. A listener that calls `signOut()`
 * feeds that existing redirect instead of competing with it.
 */
export function onAuthFailure(listener: AuthFailureListener): () => void {
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
}

function notifyAuthFailure(): void {
  // Iterate a copy: a listener is allowed to unsubscribe itself, which would
  // otherwise mutate the set mid-iteration.
  for (const listener of Array.from(authFailureListeners)) {
    try {
      listener();
    } catch (err) {
      // A broken listener must not turn an expired session into a crash.
      if (__DEV__) console.warn('[api-client] auth-failure listener threw', err);
    }
  }
}

/* ------------------------------------------------------------- transport -- */

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

/**
 * `fetch` plus the two things it does not give us: a deadline, and rejections
 * typed well enough to show someone.
 */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    // An abort surfaces as a DOMException on some runtimes and a plain Error on
    // others, so the signal is the only reliable way to tell our own deadline
    // apart from a genuine transport failure.
    if (controller.signal.aborted) throw new ApiTimeoutError();
    if (__DEV__) console.warn('[api-client] request failed', url, err);
    throw new ApiNetworkError();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads the body as JSON, or fails with a sentence a creator can read.
 *
 * Anything upstream of the API can put HTML in front of us — a proxy redirect
 * to a sign-in page, a CDN error page, a captive portal. Left to `res.json()`
 * that is a bare `SyntaxError: Unexpected token '<'`, which is untyped, not
 * retry-classifiable, and reaches the screen as a stack trace's worth of noise.
 */
async function readJson(res: Response): Promise<unknown> {
  try {
    return (await res.json()) as unknown;
  } catch (err) {
    if (__DEV__) console.warn('[api-client] non-JSON response', res.status, err);
    throw new ApiError(UNREADABLE_RESPONSE_MESSAGE, res.status);
  }
}

async function apiRequest<T>(
  path: string,
  dataSchema: z.ZodType<T>,
  options: RequestOptions,
): Promise<{ data: T; meta?: PaginationMeta }> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not set');

  const res = await fetchWithTimeout(`${apiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // Handled before the body is touched, and without reading it. A 401 body may
  // be our JSON envelope or the HTML of whatever login page something upstream
  // decided to serve, and neither is worth showing: the server's word for this
  // is "Unauthorized", which tells a creator nothing. The message is ours.
  //
  // Only a request that actually carried a token counts as a rejected session.
  // An unauthenticated call 401s by design (it is what the endpoint is for),
  // and treating that as an expired session would sign people out mid-launch,
  // in the window before Clerk has handed us a token.
  if (res.status === 401) {
    if (options.token) notifyAuthFailure();
    throw new ApiAuthError();
  }

  const parsed = apiResponseSchema(dataSchema).safeParse(await readJson(res));

  if (!parsed.success) {
    throw new ApiError(UNEXPECTED_RESPONSE_MESSAGE, res.status);
  }

  if (!parsed.data.success) {
    throw new ApiError(parsed.data.error, res.status);
  }

  return { data: parsed.data.data, meta: parsed.data.meta };
}

/**
 * Fetches from the mobile API and validates the response at runtime against
 * the shared schema — never trust the network, even our own API (see
 * docs/platform-split/03-ios-app.md). Token attachment is the caller's job
 * (via Clerk's getToken()) so this module stays testable without Clerk.
 */
export async function apiFetch<T>(
  path: string,
  responseSchema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const { data } = await apiRequest(path, responseSchema, options);
  return data;
}

/** Like apiFetch, but for paginated list endpoints — keeps the meta (total/page/limit). */
export async function apiFetchList<T>(
  path: string,
  itemSchema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<{ data: T[]; meta: PaginationMeta }> {
  const { data, meta } = await apiRequest(path, z.array(itemSchema), options);
  return { data, meta: meta ?? { total: data.length, page: 1, limit: Math.max(data.length, 1) } };
}
