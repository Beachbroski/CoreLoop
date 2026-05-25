export function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_URL) return process.env.NEXT_PUBLIC_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return undefined
}
