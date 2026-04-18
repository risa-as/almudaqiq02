import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
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
