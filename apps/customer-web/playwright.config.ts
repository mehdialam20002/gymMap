/**
 * `A-06` — Playwright, for the checks a unit test cannot make.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THESE EXIST, AND WHAT THEY ARE NOT
 *
 * `test/*.spec.ts` reads SOURCE. It is fast, it needs no browser, and it caught most of this
 * codebase's defects. What it cannot see is a page: a rule that loses on specificity, a control
 * whose click is taken by a decoration, a heading level that only skips for one data shape, a
 * chunk that 400s, a canonical that Next rewrote on the way out.
 *
 * Every one of those was found this session by driving a browser by hand, and every one of them
 * would have shipped green. These specs are those checks, made permanent — the reason `test:e2e`
 * and `test:a11y` stopped being `echo "no-op"`.
 *
 * They assert PROPERTIES, not appearances. No screenshot comparison: a pixel diff fails on a font
 * hint and teaches its reader to approve failures, which is worse than no test.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { defineConfig, devices } from '@playwright/test';

/*
 * ┌─ 3002 AND `.next-build`, AND BOTH HALVES ARE LOAD-BEARING ──────────────────────────────────┐
 * │ `pnpm dev` runs `next dev --port 3001`, writing to `.next`. A production `next start` reads  │
 * │ the same directory on the same port. When both ran at once — which is exactly what happens   │
 * │ when somebody has the dev server up and CI-like checks running — the server kept serving     │
 * │ HTML that referenced chunks the other process had just deleted: 400s, 500s, a blank page and │
 * │ three incomplete builds, every one of which reads as a code defect and is not one.           │
 * │                                                                                              │
 * │ `next.config.mjs` already provides the escape (`NEXT_DIST_DIR`) and `eslint/index.mjs`       │
 * │ already ignores `.next-build` by name. This uses both, so a developer can run the e2e suite  │
 * │ without stopping their dev server, and neither notices the other.                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const PORT = Number(process.env['GM_E2E_PORT'] ?? 4310);
const BASE_URL = `http://127.0.0.1:${String(PORT)}`;

export default defineConfig({
  testDir: './e2e',
  /*
   * `fullyParallel` off. These specs share one server and several of them navigate every route in
   * the app; running them at once turns a 22-route sweep into 88 concurrent requests and the
   * failures that produces are about the load, not the page.
   */
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    /*
     * `reduce`, because every one of these checks is about a settled page. The site's motion is
     * correct under `RM1` and asserting against a mid-animation frame is how a suite becomes
     * flaky — the marquee alone would move under every measurement.
     */
    contextOptions: { reducedMotion: 'reduce' },
    trace: process.env['CI'] ? 'on-first-retry' : 'off',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    /*
     * 360, not 390. A modern iPhone is 390 and everything is tuned for it; the failures live at the
     * narrow end, where an entry Android sits. The `narrow` spec goes to 320 on its own.
     */
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } } },
  ],

  /*
   * Built and served, never `next dev`. Half of what these specs check does not exist in dev: the
   * production CSP has no `unsafe-eval`, the chunks are hashed and immutable, hydration is the real
   * thing, and `robots.txt` and `sitemap.xml` are generated rather than routed. A suite that passes
   * against a dev server is a suite that has not seen the artefact anybody deploys.
   */
  webServer: {
    command: `pnpm exec next build && pnpm exec next start --port ${String(PORT)}`,
    url: BASE_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 240_000,
    env: { NEXT_DIST_DIR: '.next-build' },
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
