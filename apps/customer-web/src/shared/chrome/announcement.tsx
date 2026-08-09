/**
 * The bar above the chrome — `SCR-WEB-*`.
 *
 * ┌─ IT SCROLLS AWAY, AND THAT IS WHAT MAKES THE PILL FLOAT ────────────────────────────────────┐
 * │ This sits in NORMAL FLOW, above a `position: sticky` header. So the page opens with the bar  │
 * │ and the navigation together, and the moment a visitor scrolls, the bar leaves and the pill   │
 * │ pins itself to the top on its own. That is the reference's whole behaviour, and it needs     │
 * │ neither a scroll listener nor a state flag — just the correct two positioning values.         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THREE CLAIMS, AND EACH ONE IS A RULE THE CODE ENFORCES ────────────────────────────────────┐
 * │ Verified gyms is `BR-GYM-01`. Transparent pricing is `BR-PLN-03`. Earned reviews is          │
 * │ `BR-REV-01`. A bar that said "40% OFF THIS WEEK" would be the version everyone scrolls past, │
 * │ and this product has three differentiators that are true today — which is rarer than a       │
 * │ discount and worth the strip more.                                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * On `surface-media`, which is opaque and theme-invariant: the bar reads the same in both themes
 * and its pairing is `MD1` at 18.64:1, already in the register.
 */

import Link from 'next/link';

import { t } from '../i18n/index.ts';
import { icon } from '../icons/index.tsx';

export function AnnouncementBar() {
  const Verified = icon.verified;

  return (
    /*
     * `relative` for the stacking order, not for position.
     *
     * The hero's background now reaches the top of the document so it can run behind the floating
     * navigation. It is absolutely positioned and this bar is not, so without a layer of its own
     * the gradient paints straight over the bar's ground AND its text.
     *
     * `z-app-chrome`, NOT `z-10`. The preset replaces Tailwind's numeric `zIndex` scale with the
     * token scale, exactly as it does `theme.spacing` - so `z-10` generates no rule at all and
     * the computed value stays `auto`. It was written that way first and measured at `auto` in
     * the browser, with the gradient still over the strip. Same silent nothing as `mb-1`, and
     * `ci:tailwind-tokens` does not cover z-index, so nothing said so.
     */
    <div className="relative z-app-chrome border-b border-subtle bg-surface-media">
      <div className="mx-auto flex max-w-container items-center justify-center gap-inline-sm px-inset-md py-inset-2xs">
        <Verified
          aria-hidden="true"
          className="h-[0.875rem] w-[0.875rem] shrink-0 text-content-on-media-accent"
          weight="fill"
        />
        {/*
         * `text-2xs` is `TS3` legal-microcopy territory, and this is exactly that register: a
         * standing claim strip nobody has to act on. It is deliberately NOT a size a member is
         * asked to read a number from.
         */}
        <p className="truncate text-2xs font-medium tracking-wide text-content-on-media">
          {t('web.chrome.announce.claims')}
        </p>
        {/* Hidden on the narrowest screens rather than wrapped: two lines of chrome before the
            navigation pushes the hero off a phone entirely. */}
        <Link
          href="/how-it-works"
          data-on-media="true"
          className="hidden shrink-0 text-2xs font-semibold text-content-on-media underline underline-offset-2 sm:inline"
        >
          {t('web.chrome.announce.link')}
        </Link>
      </div>
    </div>
  );
}
