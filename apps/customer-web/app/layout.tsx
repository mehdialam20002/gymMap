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
import { RoutePending } from '../src/shared/chrome/route-pending.tsx';
import { SiteHeader } from '../src/shared/chrome/site-header.tsx';
import { SiteFooter } from '../src/shared/chrome/site-footer.tsx';
import { SITE_URL } from '../src/shared/seo/site.ts';
import '../src/styles/globals.css';

export const metadata: Metadata = {
  /*
   * `metadataBase`, and it was missing.
   *
   * Every relative URL in metadata is resolved against this. Without it the landings' canonicals
   * emitted as `href="/gyms/bengaluru"` - which Google tolerates and the specification does not
   * promise - and, more seriously, any absolute-URL field would have resolved against `localhost`
   * in a production build, silently and with only a build-time warning to say so.
   */
  metadataBase: SITE_URL,
  title: t('web.home.meta.title'),
  description: t('web.home.meta.description'),
  /*
   * Open Graph, which the site had none of. Every page inherits these and overrides the two that
   * vary, so a link shared to WhatsApp - which is how this audience shares anything - shows a title
   * and a sentence instead of a bare URL.
   *
   * No `images`. There is no share image in `public/`, and pointing at one that does not exist is
   * worse than omitting the field: the scraper fetches a 404 and some clients then fall back to
   * whatever image they find on the page, which here would be a stock photograph of a gym that is
   * not the gym. Booked as work rather than faked.
   */
  /*
   * ┌─ WHAT WAS HERE SPOKE FOR EVERY PAGE, AND SAID "HOME" ───────────────────────────────────────┐
   * │ This block carried `url`, `title` and `description` as well, and the note above it claimed   │
   * │ "every page inherits these and overrides the two that vary". No page overrides them. So all   │
   * │ twenty-eight indexable URLs shipped the home page's `og:title`, the home page's description,  │
   * │ and `og:url` pointing at the site root - a gym link pasted into WhatsApp previewed the home   │
   * │ page and linked to the front door. The comment described an intention; the code shipped a     │
   * │ constant.                                                                                     │
   * │                                                                                              │
   * │ Only the three fields that really are site-wide stay. Next fills `og:title` and               │
   * │ `og:description` from each route's own `title` and `description` when they are absent here,   │
   * │ so every page now previews as itself - and it does so without twenty-eight more overrides to  │
   * │ keep in step, which is the version of this that stays true.                                   │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  openGraph: {
    type: 'website',
    siteName: 'GYM MAP',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary',
  },
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
    // ┌─ `en-IN`, NOT `en` — `Accessibility.md` 2.3 ASKED FOR THE REGION "FROM THE FIRST COMMIT" ─┐
    // │ The bare subtag shipped anyway, and it is not a cosmetic difference. The language tag is  │
    // │ what a screen reader resolves its voice and its number reading against, and this is a     │
    // │ rupee-denominated marketplace: under `en` a price is read in a US English voice, `₹` is    │
    // │ announced from the generic-currency fallback rather than as rupees, and the Indian digit  │
    // │ grouping this product's prices are written in (`1,20,000`) is read against a tag whose    │
    // │ convention is `120,000`. It is also the tag `Intl` inherits from the document, so it is    │
    // │ the default every date and number format in the app is measured against.                   │
    // │                                                                                          │
    // │ The language does NOT change: `en-IN` is still English, so no string moves and `ASM-07`'s │
    // │ one launch language is intact. `openGraph.locale` above has said `en_IN` since it was     │
    // │ written, so until now the document and its own metadata disagreed about where it was.      │
    // └──────────────────────────────────────────────────────────────────────────────────────────┘
    //
    // `data-density="comfortable"` — customer-web is comfortable everywhere (§7.1). It is on the
    // element rather than assumed, so a nested region can override it the way the check-in desk
    // does on the other surface.
    <html lang="en-IN" data-density="comfortable" suppressHydrationWarning>
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

        {/*
         * ┌─ THE ONLY THING ON THIS SITE THAT SAYS A NAVIGATION IS IN FLIGHT ────────────────────┐
         * │ Mounted HERE, once, and not as a `loading.tsx` per route. Measured at 1,500 ms        │
         * │ latency: home -> gym detail 3,744 ms, home -> /how-it-works 1,774 ms, /search -> gym  │
         * │ detail 1,959 ms, and across all three the maximum `[aria-busy="true"]` count on the   │
         * │ document was 0. The dead time is the RSC round trip and hydration, so it is the same  │
         * │ whatever the destination is - which is exactly the shape a per-route fallback cannot  │
         * │ serve and a single root-level affordance can.                                         │
         * │                                                                                      │
         * │ Directly below the skip link and above everything else, because it is the one element │
         * │ that describes the state of the document rather than its contents. It is `fixed`, so  │
         * │ its position here costs no layout; what the position buys is the live region's place  │
         * │ near the top of the reading order.                                                    │
         * └──────────────────────────────────────────────────────────────────────────────────────┘
         */}
        <RoutePending />

        {/*
         * Scroll progress. `aria-hidden`, because a `progressbar` role would put a value in the
         * accessibility tree that changes on every scroll frame and means nothing to anyone: how
         * far down a document you are is a thing a screen reader already reports on its own terms.
         *
         * Driven entirely by `animation-timeline: scroll()`. §4.5 bans a scroll listener outright,
         * and this is the case that used to justify one. Where the timeline is unsupported the
         * element is `display: none` - an empty bar is honest, a full one would be a false
         * statement about position.
         */}
        <div aria-hidden="true" className="gm-progress" />

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
