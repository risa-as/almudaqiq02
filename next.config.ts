import type { NextConfig } from "next";

// The Electron desktop build (and `dev:electron`) sets IS_ELECTRON=1. There we MUST
// load the real local SQLite client (@prisma/client-local); in the cloud/web build it
// isn't installed, so we alias it to a no-op stub instead.
const IS_ELECTRON = process.env.IS_ELECTRON === '1';

const nextConfig: NextConfig = {
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Both Prisma clients are loaded at runtime, never bundled. In the Electron build
  // the local SQLite client must also be external (so its runtime model delegates
  // stay intact); in the web build it's aliased to a stub below.
  serverExternalPackages: IS_ELECTRON
    ? ["@prisma/client", "@prisma/client-local"]
    : ["@prisma/client"],
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    // Alias @prisma/client-local to a no-op stub ONLY in the cloud/web build, where it
    // isn't installed. In the Electron build the alias is omitted so createRequire loads
    // the REAL client — otherwise the stub leaks in and prisma.<model> becomes undefined.
    resolveAlias: IS_ELECTRON
      ? {}
      : { '@prisma/client-local': './lib/prisma-client-local-stub' },
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
