import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@smart-city/database', '@smart-city/shared'],
  serverExternalPackages: ['pg'],
}

export default nextConfig
