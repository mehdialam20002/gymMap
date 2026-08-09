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

  /*
   * ┌─ WHY THE BUILD DIRECTORY IS OVERRIDABLE ────────────────────────────────────────────────┐
   * │ `next dev` and `next build` both own `.next` exclusively, and running one while the      │
   * │ other is serving corrupts it: the running server keeps a manifest pointing at chunks the │
   * │ new build has already deleted. It surfaces as `Cannot find module './776.js'`, or as a   │
   * │ stylesheet that 400s and a completely unstyled page — neither of which names the cause.  │
   * │                                                                                          │
   * │ That is not hypothetical here. Two sessions work in this repository at once (see          │
   * │ CLAUDE.md §3), so a build lands under a running dev server routinely.                     │
   * │                                                                                          │
   * │ Default is unchanged, so CI and deployment are untouched. A dev server that wants         │
   * │ isolation sets the variable:                                                              │
   * │                                                                                          │
   * │     NEXT_DIST_DIR=.next-dev pnpm exec next dev -p 3001                                    │
   * └──────────────────────────────────────────────────────────────────────────────────────────┘
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',

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
    /*
     * NAMED HOSTS ONLY. A wildcard here turns `/_next/image` into an open proxy that any stranger
     * can point at any URL and that we get billed for — which is why the list was empty until
     * something concrete needed it.
     *
     * Pexels serves the fixture catalogue's photography. Those listings are demo data, labelled
     * as such by `FixtureNotice` on every page that renders them, and the licence permits
     * commercial use without attribution. It comes OUT the day real gym media lands in the S3
     * bucket (`FR-GYM-02`), and it is listed here rather than as a wildcard so that removal is a
     * one-line diff somebody can actually find.
     */
    // Two named hosts, never a wildcard. Pexels carries the fixture catalogue's covers; Unsplash
    // carries the hero poster. Both go the day `FR-GYM-02`'s upload path exists and the CDN takes
    // over, and both are named again in `CSP_MEDIA_HOST` — the optimiser and the policy have to
    // agree or the image 404s in one and is blocked in the other.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },

  // `NFR-PERF-10` — 200 KB gzipped. The header carries a build id and nothing about the stack.
  poweredByHeader: false,
};

export default nextConfig;
