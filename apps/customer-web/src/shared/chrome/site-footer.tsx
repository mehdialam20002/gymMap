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
    <footer
      aria-label={t('web.chrome.footer.landmark')}
      className="border-t border-subtle bg-surface-subtle"
    >
      <div className="mx-auto max-w-container px-inset-md py-region-md">
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
            <p className="text-lg font-semibold tracking-tight text-content">
              {t('web.chrome.brand')}
            </p>
            <p className="mt-stack-xs max-w-ui text-sm text-content-secondary">
              {t('web.chrome.footer.tagline')}
            </p>
          </div>

          {FOOTER_NAV.map((column) => (
            <nav key={column.heading} aria-label={t(column.heading)}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                {t(column.heading)}
              </h2>
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
                      <span className="text-sm text-content-disabled">{t(item.label)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-stack-2xl flex flex-wrap items-center justify-between gap-inline-md border-t border-subtle pt-stack-md">
          <p className="text-sm text-content-muted">{t('web.chrome.footer.rights')}</p>
          {/*
           * Region and language are STATED, not offered. `OQ-16` makes the India region mandatory
           * under RBI payment-data localisation rather than configurable, and `A4.2` defers
           * multi-language UI — so a country switcher here would be a control that cannot work.
           */}
          <p className="text-sm text-content-muted">
            {t('web.chrome.footer.region')} · {t('web.chrome.footer.language')}
          </p>
        </div>
      </div>
    </footer>
  );
}
