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

  // 'export' for Tauri desktop (static), 'standalone' for Docker, undefined for Vercel
  output: isDesktopExport ? 'export' : (process.env.DOCKER_BUILD ? 'standalone' : undefined),

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY HEADERS
  // ═══════════════════════════════════════════════════════════════════════════
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-eval' required for Next.js hot-reload / React Refresh in dev
              process.env.NODE_ENV === 'development'
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
                : "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' " + (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000') + " wss: ws:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },

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

// Only wrap with Sentry if DSN is configured AND in production
// Sentry webpack plugin causes 'Cannot read properties of undefined (reading call)' in dev
const finalConfig =
  process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production'
    ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
    : nextConfig;

module.exports = finalConfig;
