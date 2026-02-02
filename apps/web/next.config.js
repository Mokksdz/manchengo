/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Gzip compression
  compress: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Tree-shake barrel imports (lucide-react icons, react-query)
  experimental: {
    optimizePackageImports: ['lucide-react', '@tanstack/react-query', 'recharts'],
  },

  // Standalone output for production deployment
  output: 'standalone',

  // Proxy API requests to backend (dev only; production uses NEXT_PUBLIC_API_URL)
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
