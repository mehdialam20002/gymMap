/**
 * The site footer — `SCR-WEB-*` chrome, `FR-SRCH-13`.
 *
 * A marketplace footer is not decoration: it is the crawler's map of the product and a member's
 * second navigation. Five columns from `FOOTER_NAV`, so it cannot drift from the header.
 *
 * Unbuilt routes render as text with a "soon" marker rather than as links, for the same reason
 * they do in the header — and here the reason is sharper, because a footer full of 404s is
 * exactly what a crawler indexes first.
 */

import Link from 'next/link';

import { t } from '../i18n/index.ts';
import { FOOTER_NAV } from './nav-model.ts';

export function SiteFooter() {
  return (
    /*
     * A ground one step BELOW the page, matching the reference. `surface-sunken` rather than
     * `surface-subtle`: the closing band above it is already the page ground, and two adjacent
     * bands at the same value read as one very tall section with a stray rule through it.
     */
    <footer aria-label={t('web.chrome.footer.landmark')} className="gm-foot">
      <div className="gm-wrap gm-foot-in">
        {/*
         * Tracks sized from the CONTENT, not a round number of equal columns.
         *
         * This was `lg:grid-cols-6` with the brand block spanning two of them, which needs seven
         * slots for six tracks: the last nav column wrapped onto a second row and sat alone under
         * the brand, on every page of the site.
         *
         * The `5` mirrors `FOOTER_NAV.length` and is the one number here that can drift. It cannot
         * be read from the model at build time - Tailwind resolves classes by scanning source text
         * - so `shell.spec.ts` asserts the two agree instead, and adding a sixth column fails the
         * suite rather than quietly wrapping the fifth again.
         */}
        <div className="grid gap-stack-xl sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(5,minmax(0,1fr))]">
          <div>
            {/*
             * The same mark the header wears, at 26px. It is the one place in the footer where the
             * brand colour is a FILL, and `content-on-brand` is its proved foreground - the header's
             * note says the same thing, and the two are deliberately identical so the page opens
             * and closes on one mark rather than two treatments of it.
             */}
            <p className="gm-foot-brand">
              <span aria-hidden="true" className="gm-foot-mark">
                G
              </span>
              {t('web.chrome.brand')}
            </p>
            <p className="mt-stack-xs max-w-ui text-sm text-content-muted">
              {t('web.chrome.footer.tagline')}
            </p>
          </div>

          {FOOTER_NAV.map((column) => (
            <nav key={column.heading} aria-label={t(column.heading)}>
              <h2 className="gm-foot-h">{t(column.heading)}</h2>
              {/*
               * 44px ROWS, not `gm-hit-target` on a 16px link.
               *
               * `AX3` wants a 44px pointer target and `gm-hit-target` gets there with a `::after`
               * that grows outwards from the middle. On a stacked list of 16px links spaced 8px
               * apart that expansion runs 14px into the link above and the link below, and
               * overlapping targets are worse than small ones: the tap lands on a neighbour and
               * the reader has no way to tell why. Measured at 390px, every one of these was
               * 16px tall.
               *
               * So the ROW is the target. `min-h` from the size token, the gap removed because
               * the padding now provides the rhythm, and nothing invisible reaching into anything
               * else. The disabled items match, or the list would step unevenly where a milestone
               * has not shipped.
               */}
              <ul className="mt-stack-sm flex flex-col">
                {column.items.map((item) => (
                  <li key={item.href} className="flex min-h-[2.75rem] items-center">
                    {item.built ? (
                      <Link
                        href={item.href}
                        className="flex min-h-[2.75rem] w-full items-center text-sm text-content-secondary transition-colors duration-fast ease-standard hover:text-content"
                      >
                        {t(item.label)}
                      </Link>
                    ) : (
                      /*
                       * ┌─ `content-muted`, AND A WORD ─────────────────────────────────────────┐
                       * │ Measured on the rendered page: `content-disabled` came to 3.25:1 in    │
                       * │ the dark theme and 2.45:1 in the light one, against `SC 1.4.3`'s 4.5.  │
                       * │ WCAG exempts an INACTIVE CONTROL, and this is not one - it is static   │
                       * │ text naming a route, which the note at the top of this file says is    │
                       * │ here precisely so a reader can see the shape of the product. Text put  │
                       * │ there to be read has to be readable.                                   │
                       * │                                                                        │
                       * │ And the "Soon" was carried by the dimming alone for a sighted reader:  │
                       * │ the marker existed only in a `gm-visually-hidden` span, so colour was  │
                       * │ the whole signal, which `AX8` refuses. The mobile navigation already   │
                       * │ shows the word; the footer now does too, and the two agree.            │
                       * └────────────────────────────────────────────────────────────────────────┘
                       */
                      <span className="text-sm text-content-muted">
                        {t(item.label)}{' '}
                        <span className="gm-tag text-xs">{t('web.chrome.nav.soon')}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="gm-foot-bottom">
          <p className="m-0">{t('web.chrome.footer.copyright')}</p>
          {/*
           * Region and language are STATED, not offered. `OQ-16` makes the India region mandatory
           * under RBI payment-data localisation rather than configurable, and `A4.2` defers
           * multi-language UI — so a country switcher here would be a control that cannot work.
           */}
          <p className="m-0">
            {t('web.chrome.footer.region')} · {t('web.chrome.footer.language')} ·{' '}
            {t('web.chrome.footer.currency')}
          </p>
        </div>
      </div>
    </footer>
  );
}
