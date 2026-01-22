const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    // Disable ESLint during production builds - linting runs locally during development
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'production'
              ? process.env.NEXT_PUBLIC_APP_URL || '*'
              : '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/admin',
        missing: [
          {
            type: 'cookie',
            key: 'admin_token',
          },
        ],
        permanent: false,
        destination: '/admin-login',
      },
      // Teacher portal URL rename: /teacher -> /paedagogen
      {
        source: '/teacher',
        destination: '/paedagogen',
        permanent: true,
      },
      {
        source: '/teacher-login',
        destination: '/paedagogen-login',
        permanent: true,
      },
      {
        source: '/teacher/:path*',
        destination: '/paedagogen/:path*',
        permanent: true,
      },
      // Parent portal URL rename: /parent-portal -> /familie
      {
        source: '/parent-portal',
        destination: '/familie',
        permanent: true,
      },
      {
        source: '/parent-login',
        destination: '/familie-login',
        permanent: true,
      },
      {
        source: '/parent-portal/:path*',
        destination: '/familie/:path*',
        permanent: true,
      },
      // Fix broken email links where /e/ was stripped
      { source: '/16', destination: '/e/16', permanent: true },
      { source: '/24', destination: '/e/24', permanent: true },
    ];
  },
};

module.exports = withNextIntl(nextConfig);