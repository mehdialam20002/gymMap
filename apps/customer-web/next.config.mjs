/**
 * `apps/customer-web` — Next.js 14 App Router. `FolderStructure.md` §4, `Security.md` §11.
 *
 * CSP is NOT here. §11.1 assigns it to application middleware because the nonce must be generated
 * per response, and a nonce in a static config is a constant — which is `'unsafe-inline'` with
 * extra steps. See `middleware.ts`.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // `packages/ui` is consumed as SOURCE, not as build output (see its package.json). Without
  // this, Next refuses the workspace TypeScript and the failure reads as a module-resolution
  // problem rather than a missing transpile.
  transpilePackages: ['@gymmap/ui', '@gymmap/types'],

  // A build that ships despite a type error is a build that ships a type error. Both default to
  // false in Next 14; stated explicitly so a future "just unblock the deploy" edit is visible in
  // the diff rather than being the absence of a line.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

  // NFR-SEC-12 §11.2 — the static half. The nonce-bearing CSP is in middleware.ts, and these are
  // also set at the edge; the duplication covers local development and any deployment where the
  // edge configuration has drifted.
  //
  // HSTS is deliberately NOT set here. It is an edge concern: it must apply to responses the
  // application never sees, and a two-year `preload` directive emitted from a dev server that
  // someone runs on `localhost` over plain HTTP is a foot-gun with a long memory.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // `X-Frame-Options` is NOT set: `frame-ancestors 'none'` in the CSP supersedes it, and
          // the two disagreeing is a real source of confusion during an incident.
        ],
      },
    ];
  },

  images: {
    // AVIF first, WebP second. The order is the preference order, and AVIF is meaningfully
    // smaller on the photography this site is mostly made of — which is where NFR-PERF-02's LCP
    // budget is actually spent.
    formats: ['image/avif', 'image/webp'],
    // Remote patterns stay empty until the CDN host is provisioned. An empty list means the
    // optimiser refuses unknown hosts, which is the correct default: a wildcard here turns the
    // image endpoint into an open proxy that anyone can bill us for.
    remotePatterns: [],
  },

  // `NFR-PERF-10` — 200 KB gzipped. The header carries a build id and nothing about the stack.
  poweredByHeader: false,
};

export default nextConfig;
