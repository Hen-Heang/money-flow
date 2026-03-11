import type { NextConfig } from 'next'

// Allow self-signed certificates in dev (corporate network/VPN SSL inspection)
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

const nextConfig: NextConfig = {}

export default nextConfig
