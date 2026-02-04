const { withSentryConfig } = require('@sentry/nextjs');

const isDesktopExport = process.env.NEXT_OUTPUT === 'export';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Gzip compression
  compress: true,

  // Image optimization (unoptimized required for static export)
  images: isDesktopExport
    ? { unoptimized: true }
    : { formats: ['image/avif', 'image/webp'] },

  // Tree-shake barrel imports (lucide-react icons, react-query)
  experimental: {
    optimizePackageImports: ['lucide-react', '@tanstack/react-query', 'recharts'],
  },

  // 'export' for Tauri desktop (static), 'standalone' for Docker/production
  output: isDesktopExport ? 'export' : 'standalone',

  // Proxy API requests to backend (dev only; not available in static export)
  ...(isDesktopExport ? {} : {
    async rewrites() {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      return [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ];
    },
  }),
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,

  // Organization and project in Sentry
  org: process.env.SENTRY_ORG || 'manchengo',
  project: process.env.SENTRY_PROJECT || 'manchengo-web',

  // Upload source maps for error debugging
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,

  // Hide source maps from generated client bundles
  hideSourceMaps: true,

  // Tunnel sentry requests to avoid ad blockers (not available in static export)
  ...(isDesktopExport ? {} : { tunnelRoute: '/monitoring' }),
};

// Only wrap with Sentry if DSN is configured
const finalConfig = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;

module.exports = finalConfig;
