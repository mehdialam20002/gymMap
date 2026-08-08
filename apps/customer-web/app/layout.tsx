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
// `app/` is routing only (`F1`). The chrome moved to `src/shared/chrome/` when it grew past two
// links; a root layout may RENDER components, it may not be where they live.
import { AnnouncementBar } from '../src/shared/chrome/announcement.tsx';
import { SiteHeader } from '../src/shared/chrome/site-header.tsx';
import { SiteFooter } from '../src/shared/chrome/site-footer.tsx';
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
         *
         * ┌─ AND `suppressHydrationWarning` ON THE SCRIPT, FOR A DIFFERENT REASON ─────────────────┐
         * │ React logged `Prop nonce did not match. Server: "" Client: "<the nonce>"`, which reads  │
         * │ like the nonce failed to reach the server render. It did reach it — the browser then    │
         * │ ERASED it. Nonce hiding is required behaviour: once the nonce is applied, the content   │
         * │ attribute is emptied so a CSS selector or a DOM read cannot exfiltrate it and forge a   │
         * │ trusted inline script. So React compares its prop against an attribute the browser has  │
         * │ deliberately blanked and reports a mismatch that cannot be fixed by fixing anything.    │
         * │                                                                                        │
         * │ Suppressed HERE ONLY, on the one element whose attribute the browser removes. Not on    │
         * │ <body> or a wrapper, where it would also hide real mismatches in everything below.      │
         * └────────────────────────────────────────────────────────────────────────────────────────┘
         */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
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
          {/* In normal flow, ABOVE the sticky header. That ordering is the whole behaviour: the
              bar scrolls away and the navigation pill pins itself, with no scroll listener. */}
          <AnnouncementBar />
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
