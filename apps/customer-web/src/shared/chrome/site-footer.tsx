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
import { BrandMark } from './brand-mark.tsx';
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
         *
         * ┌─ AND A FLOOR UNDER THE FIVE, BECAUSE `1fr` IS A SHARE AND NOT A WIDTH ──────────────┐
         * │ `minmax(0,1fr)` measured 118.5px at 1024, 129.1 at 1100 and only 135.2 by 1140.       │
         * │ Against the intrinsic width of the rows that have to fit inside one of them:          │
         * │ "Privacy policy" + its Soon badge is 130.5px, "Refund policy" 130.4, "Terms of use"  │
         * │ 125.4, "Help centre" 118.5. So on every laptop from 1024 to about 1110 the Support    │
         * │ column broke over two lines with the badge stranded on the second, beside four       │
         * │ columns that did not break. The rows did not get taller - 18px of label over a 26px  │
         * │ badge line is exactly the 2.75rem the row already reserves - which is why this read  │
         * │ as a typographic mess rather than as a layout bug, and why it survived.               │
         * │                                                                                      │
         * │ 136px is the 130.5 the widest row needs plus the 5.5 it gains when Inter has not     │
         * │ loaded and the fallback stack is measuring. The floor stops binding at about 1106,   │
         * │ where the fr share passes it and the tracks go back to equal, so `xl` is unchanged.   │
         * │                                                                                      │
         * │ The floor is `px` and NOT `rem` on purpose. At 200% text zoom a rem floor would be   │
         * │ 5x272px inside a container that did not grow, and the footer would scroll sideways;  │
         * │ a px floor holds the columns apart at 100% and lets the labels wrap at 200%, which   │
         * │ is what reflow asks for. It is the same unit as the wrapper it sits in.               │
         * │                                                                                      │
         * │ The column gap pays for it: `inline-xl` (24px) at `lg`, so at 1024 the five floors   │
         * │ and five gaps leave the brand a 142px track, against the 122.5px its mark and        │
         * │ wordmark measure. Keeping the 32px stack gap would have left the brand 102px, twenty │
         * │ short of its own width, and the wordmark cannot wrap - it is one word in a flex row. │
         * └──────────────────────────────────────────────────────────────────────────────────────┘
         */}
        <div className="grid gap-stack-xl sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(5,minmax(136px,1fr))] lg:gap-x-inline-xl">
          <div>
            {/*
             * The same mark the header wears, at 26px, and now literally the same - one component
             * rather than two spans with a comment promising they match. The page opens and closes
             * on one mark.
             *
             * 26px because the brand column's track was measured against it: the note below records
             * 142px of track against the 122.5px this mark and the wordmark occupy, so a larger one
             * would push the wordmark to a second line at `lg`.
             */}
            <p className="gm-foot-brand">
              <BrandMark className="h-[1.625rem] w-[1.625rem] shrink-0" />
              {t('web.chrome.brand')}
            </p>
            <p className="mt-stack-xs max-w-ui text-sm text-content-muted">
              {t('web.chrome.footer.tagline')}
            </p>
          </div>

          {/*
           * ┌─ FIVE GROUPS IN TWO COLUMNS BELOW `sm`, NOT FIVE STACKED ───────────────────────────┐
           * │ Stacked, this footer measured 1210px at 320x568 - 2.13 viewports of chrome under    │
           * │ the page it belongs to - and the same 1210px at 360 and at 390, because a single    │
           * │ column does not care how wide the phone is. Paired, it is 825px: 1.45 viewports at  │
           * │ 320x568 and 0.98 at 390x844. The 385px comes off in the same place at every phone   │
           * │ width, as three rows of groups instead of five and two fewer 32px gaps.              │
           * │                                                                                      │
           * │ Nothing is hidden and nothing is dropped. A `<details>` over the least-used groups  │
           * │ saved about the same and charged a tap for it, on the one navigation a member       │
           * │ reaches for precisely because the page above it did not answer them.                 │
           * │                                                                                      │
           * │ `sm:contents` rather than a second set of column rules: above 640 this wrapper      │
           * │ stops being a box and the five `nav`s are items of the grid above again, which is   │
           * │ what `sm:grid-cols-2` and the `lg` template are both written against. One column    │
           * │ set that changes shape, not two that have to be kept in agreement.                   │
           * │                                                                                      │
           * │ The column gap here is `inline-lg` (16px) and not the 32px stack: it puts the two   │
           * │ columns at 134px on a 320px phone, and the widest row in the footer ("Privacy       │
           * │ policy" and its Soon badge) measures 130.5px. At the 32px gap the columns are       │
           * │ 126px and that row breaks in two.                                                    │
           * └──────────────────────────────────────────────────────────────────────────────────────┘
           */}
          <div className="grid grid-cols-2 gap-x-inline-lg gap-y-stack-xl sm:contents">
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
                 * has not shipped. Paired into two columns the row is still 134px wide at 320px,
                 * so both dimensions clear 44 and neither target reaches into its neighbour.
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
                         * ┌─ `content-muted`, AND A WORD ───────────────────────────────────────┐
                         * │ Measured on the rendered page: `content-disabled` came to 3.25:1 in  │
                         * │ the dark theme and 2.45:1 in the light one, against `SC 1.4.3`'s     │
                         * │ 4.5. WCAG exempts an INACTIVE CONTROL, and this is not one - it is   │
                         * │ static text naming a route, which the note at the top of this file   │
                         * │ says is here precisely so a reader can see the shape of the          │
                         * │ product. Text put there to be read has to be readable.                │
                         * │                                                                      │
                         * │ And the "Soon" was carried by the dimming alone for a sighted        │
                         * │ reader: the marker existed only in a `gm-visually-hidden` span, so   │
                         * │ colour was the whole signal, which `AX8` refuses. The mobile         │
                         * │ navigation already shows the word; the footer now does too, and the  │
                         * │ two agree.                                                            │
                         * └──────────────────────────────────────────────────────────────────────┘
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
