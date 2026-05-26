import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https: https://img.clerk.com",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: https://challenges.cloudflare.com",
      "connect-src 'self' https: wss: https://clerk-telemetry.com https://*.clerk-telemetry.com",
      "worker-src 'self' blob:",
      "frame-src 'self' https://challenges.cloudflare.com https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://connect-js.stripe.com https://*.clerk.accounts.dev https://*.clerk.com https://accounts.google.com https://*.google.com",
      "form-action 'self' https://hooks.stripe.com https://connect.stripe.com https://*.clerk.accounts.dev https://*.clerk.com https://accounts.google.com https://*.google.com",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
