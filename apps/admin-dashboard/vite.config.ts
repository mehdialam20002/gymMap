/**
 * `apps/admin-dashboard` — React 18 + Vite SPA. `FolderStructure.md` §6.
 *
 * Not Next.js, deliberately (`STACK_ADDITIONS.md` Part 1): the admin console is behind auth and
 * MFA, so it is never crawled and gains nothing from SSR — and a server render would put a
 * Node process in front of a surface that can read across every tenant, for no benefit.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3003,
    strictPort: true,

    // ┌─ THE API IS PROXIED, NOT CALLED CROSS-ORIGIN ────────────────────────────────────────┐
    // │ `__Host-gm_rt` is `Secure` and `SameSite=Strict`. Calling `:3000` directly from        │
    // │ `:3003` would need a CORS policy with `credentials: true` on the server — a real       │
    // │ security surface, invented for a dev convenience, that production does not want.       │
    // │                                                                                        │
    // │ A proxy makes every request same-origin, so the cookie is set and returned under       │
    // │ exactly the rules it will face in production. The dev setup then proves the real       │
    // │ thing rather than a relaxed variant of it.                                              │
    // └────────────────────────────────────────────────────────────────────────────────────────┘
    proxy: {
      '/v1': { target: 'http://127.0.0.1:3000', changeOrigin: false },
      '/healthz': { target: 'http://127.0.0.1:3000', changeOrigin: false },
      '/readyz': { target: 'http://127.0.0.1:3000', changeOrigin: false },
    },
  },
  preview: { port: 3003, strictPort: true },

  build: {
    // A source map for a surface that is behind MFA and never public. It costs nothing at
    // runtime (browsers fetch it only when devtools are open) and it is the difference between
    // a readable stack trace and minified noise during an incident on the console that
    // adjudicates money.
    sourcemap: true,
    // `NFR-PERF-10` is a customer-web budget; this surface has no such target, and a warning
    // that fires on every build is a warning everyone learns to scroll past.
    chunkSizeWarningLimit: 900,
  },

  // `packages/ui` is consumed as SOURCE and ships `.ts` extensions in its imports; Vite resolves
  // them natively. No `transpilePackages` equivalent is needed — that is a Next-specific concern.
  optimizeDeps: {
    // Excluded so a change in packages/ui is picked up without clearing Vite's dep cache. The
    // alternative is an edit to a token that appears to do nothing until the dev server restarts,
    // which costs more time than the pre-bundling saves.
    exclude: ['@gymmap/ui', '@gymmap/types'],
  },
});
