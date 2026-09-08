import { z } from 'zod'

/**
 * Submission content must be an UploadThing URL produced by our own uploader,
 * never an arbitrary link. This module is the SINGLE source of truth for that
 * rule — web routes, the /api/v1 mobile API and the Expo app all import it from
 * here. Do not re-implement it in an app-local lib: a second copy was added
 * under lib/content-url.ts, drifted (it never grew the length cap), and only
 * one of the two got hardened. Extend this file instead.
 *
 * Two distinct risks it closes:
 *  1. `z.string().url()` accepts `javascript:`, `data:` and `vbscript:` URLs.
 *     A submitted contentUrl is rendered as a clickable link in the *brand's*
 *     dashboard — the role that can accept applications and release payouts.
 *  2. Even with a safe scheme, an arbitrary external host lets a creator
 *     present any link as "their content" under our domain's trust.
 *
 * UploadThing v7 `ufsUrl` resolves to https://<appId>.ufs.sh/f/<key>; the
 * legacy host is utfs.io. Per-file ownership (rejecting a *foreign* UploadThing
 * key) is a separate follow-up and is NOT covered here.
 */

const ALLOWED_HOST_SUFFIXES = ['.ufs.sh', '.utfs.io'] as const
const ALLOWED_HOSTS_EXACT = ['utfs.io'] as const

/** Defense in depth — rejected explicitly even though the host check would catch them. */
const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:', 'blob:'] as const

export const MAX_CONTENT_URL_LENGTH = 2048

export function isAllowedContentUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0 || url.length > MAX_CONTENT_URL_LENGTH) {
    return false
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  const protocol = parsed.protocol.toLowerCase()
  if (DANGEROUS_PROTOCOLS.includes(protocol as (typeof DANGEROUS_PROTOCOLS)[number])) return false
  if (protocol !== 'https:') return false

  const host = parsed.hostname.toLowerCase()
  if (ALLOWED_HOSTS_EXACT.includes(host as (typeof ALLOWED_HOSTS_EXACT)[number])) return true
  return ALLOWED_HOST_SUFFIXES.some(suffix => host.endsWith(suffix))
}

/** The single source of truth for a submission contentUrl field. */
export const contentUrlSchema = z
  .string()
  .max(MAX_CONTENT_URL_LENGTH)
  .refine(isAllowedContentUrl, { message: 'Content must be uploaded through CreatorDocks' })
