import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  reactCompiler: true,
  images: { unoptimized: true },
  poweredByHeader: false,
}
export default nextConfig
