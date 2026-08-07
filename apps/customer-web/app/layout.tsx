/**
 * The root shell — `SCR-WEB-*` chrome. `NFR-USE-02` (`AX2`), `NFR-USE-08`, `DesignSystem.md` §9.2.
 *
 * `app/` is ROUTING ONLY (constitution §7.4.1 `F1`). This file is the exception the rule allows:
 * a root layout is routing infrastructure, and everything it renders beyond the document skeleton
 * comes from `src/`.
 */

import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';

import { t } from '../src/shared/i18n/index.ts';
import { themeScript } from '../src/shared/theme/theme-script.ts';
import '../src/styles/globals.css';

export const metadata: Metadata = {
  title: t('web.home.meta.title'),
  description: t('web.home.meta.description'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // NOT `maximum-scale: 1` and NOT `user-scalable: no`. Both are common in mobile shells and both
  // break WCAG 1.4.4 by preventing zoom — for a user who needs 200% text, the page becomes
  // unusable. `TS2` already removes the iOS zoom-on-focus problem those settings usually paper
  // over, by keeping form inputs at 16px.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Set by middleware.ts per response. `script-src` admits `'nonce-…'` and no `'unsafe-inline'`,
  // so an inline script without this attribute does not execute — which is the point.
  const nonce = headers().get('x-nonce') ?? undefined;

  return (
    // `DV8` — `lang` on <html> drives screen-reader pronunciation AND the browser's font fallback
    // selection. A Devanagari gym name inside an English page will need `lang="hi"` on that
    // element specifically; the page-level value is the default, not the whole answer.
    //
    // `data-density="comfortable"` — customer-web is comfortable everywhere (§7.1). It is on the
    // element rather than assumed, so a nested region can override it the way the check-in desk
    // does on the other surface.
    <html lang="en" data-density="comfortable" suppressHydrationWarning>
      <head>
        {/*
         * DM2 — before first paint, and not dependent on any React bundle. A `useEffect` would
         * paint the default theme, hydrate, then repaint: the flash of the wrong theme. On a
         * server-rendered page that flash is guaranteed rather than occasional, because the
         * server cannot know the preference.
         *
         * `suppressHydrationWarning` on <html> above is required and is not a workaround: this
         * script deliberately mutates the element the server rendered, so React WILL see a
         * mismatch, and it is the correct one.
         */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {/*
         * AX2 — the skip link is the first focusable element in the document. Positioned off
         * screen rather than `display: none`, because a display-none element is not focusable
         * and a skip link that Tab cannot reach is decoration.
         */}
        <a href="#main" className="gm-skip-link">
          {t('web.chrome.skipToContent')}
        </a>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          {/* `tabIndex={-1}` so the skip link can move focus here — without it the browser
              scrolls to the anchor but leaves focus at the top of the document, and the next Tab
              starts over from the header. */}
          <main
            id="main"
            tabIndex={-1}
            aria-label={t('web.chrome.mainLandmark')}
            className="flex-1"
          >
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-app-chrome border-b border-subtle bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-container items-center justify-between gap-inline-lg px-inset-md py-inset-sm">
        <a href="/" className="gm-hit-target text-lg font-semibold text-content">
          {t('web.chrome.brand')}
        </a>
        <nav aria-label={t('web.chrome.nav.search')} className="flex items-center gap-inline-lg">
          <a
            href="/search"
            className="gm-hit-target text-base text-content-secondary hover:text-content"
          >
            {t('web.chrome.nav.search')}
          </a>
          <a
            href="/for-gyms"
            className="gm-hit-target text-base text-content-secondary hover:text-content"
          >
            {t('web.chrome.nav.forGyms')}
          </a>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-subtle bg-surface-subtle">
      <div className="mx-auto max-w-container px-inset-md py-region-sm">
        <nav aria-label={t('web.chrome.footer.legal')} className="flex flex-wrap gap-inline-xl">
          {(
            [
              ['/legal/terms', 'web.chrome.footer.terms'],
              ['/legal/privacy', 'web.chrome.footer.privacy'],
              ['/legal/refunds', 'web.chrome.footer.refunds'],
            ] as const
          ).map(([href, key]) => (
            <a
              key={href}
              href={href}
              className="gm-hit-target text-sm text-content-tertiary underline"
            >
              {t(key)}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
