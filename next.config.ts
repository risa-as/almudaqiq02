import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Both Prisma clients are loaded at runtime, never bundled. The local SQLite
  // client (@prisma/client-local) is only present in the Electron desktop build.
  serverExternalPackages: ["@prisma/client"],
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    resolveAlias: {
      // @prisma/client-local exists only in the Electron build.
      // Alias it to a no-op stub so the cloud/web build never tries to resolve it.
      '@prisma/client-local': './lib/prisma-client-local-stub',
    },
  },
  // Subdomain routing: allow *.your-domain.com to be served
  // Set NEXT_PUBLIC_APP_DOMAIN=your-domain.com in .env
  // Vercel handles wildcard domains automatically.
  // For self-hosted (nginx/Caddy), route all *.domain.com → this app.
  async headers() {
    return [
      {
        // Security headers for all routes
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },

  async redirects() {
    return [
      { source: '/orders',            destination: '/sales/invoices',        permanent: true },
      { source: '/customers',         destination: '/sales/customers',       permanent: true },
      { source: '/suppliers',         destination: '/purchases/suppliers',   permanent: true },
      { source: '/reports/expenses',  destination: '/accounting/expenses',   permanent: true },
      { source: '/reports/financials',destination: '/accounting/financials', permanent: true },
      { source: '/reports/shifts',    destination: '/accounting/shifts',     permanent: true },
      { source: '/reports/bi',        destination: '/reports/analytics',     permanent: true },
      { source: '/offers',            destination: '/marketing/offers',      permanent: true },
    ]
  },
};

export default nextConfig;
