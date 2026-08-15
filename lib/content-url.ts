// Submission content must be an UploadThing URL produced by our own uploader
// (app/api/v1/uploads or the web contentUploader), never an arbitrary link.
// UploadThing v7 `ufsUrl` resolves to https://<appId>.ufs.sh/f/<key>; the
// legacy host is utfs.io. This is the W6-7 "reject arbitrary URLs" gate —
// per-file ownership (rejecting a *foreign* UploadThing key) is a follow-up.
const ALLOWED_HOST_SUFFIXES = ['.ufs.sh', '.utfs.io'] as const
const ALLOWED_HOSTS_EXACT = ['utfs.io'] as const

export function isAllowedContentUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:') return false

  const host = parsed.hostname.toLowerCase()
  if (ALLOWED_HOSTS_EXACT.includes(host as (typeof ALLOWED_HOSTS_EXACT)[number])) return true
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}
