import type { NextConfig } from 'next'

// Corporate network/VPN SSL inspection can present a self-signed root CA that
// Node doesn't trust by default, breaking outbound HTTPS in dev. Don't disable
// certificate verification process-wide — instead point Node at the corporate
// CA bundle so verification still happens, just against the right trust store:
//   NODE_EXTRA_CA_CERTS=/path/to/corporate-root-ca.pem npm run dev
// (or set it in your shell profile / .env.local as a real env var, not here).

// script-src needs 'unsafe-eval' in development only (Next.js dev/HMR and some
// AI SDK internals rely on it); production never includes it.
const isDev = process.env.NODE_ENV !== 'production'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://api.openai.com https://api.resend.com https://v6.exchangerate-api.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig

