/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
    emotion: true,
  },
  
  // Image optimization
  images: {
    domains: ['localhost', 'rankmybrand.ai'],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Experimental features for performance
  experimental: {
    optimizeCss: true,
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ];
  },
  
  // Rewrites for API proxy
  async rewrites() {
    return [
      {
        source: '/api/geo/:path*',
        destination: `${process.env.NEXT_PUBLIC_GEO_API || 'http://localhost:8000'}/api/v1/:path*`,
      },
      {
        source: '/api/crawler/:path*',
        destination: `${process.env.NEXT_PUBLIC_CRAWLER_API || 'http://localhost:3002'}/api/:path*`,
      },
      {
        source: '/api/search/:path*',
        destination: `${process.env.NEXT_PUBLIC_SEARCH_API || 'http://localhost:3002'}/api/search-intelligence/:path*`,
      },
    ];
  },
};

export default nextConfig;