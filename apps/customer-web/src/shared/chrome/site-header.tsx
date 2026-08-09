/**
 * The site header — `SCR-WEB-*` chrome. `AX2`, `NFR-USE-08`.
 *
 * A Server Component. The only client thing in the shell is the drawer's disclosure state, which
 * lives in `mobile-nav.tsx`; everything a crawler needs — brand, every primary link, the auth
 * entry points — is server-rendered, including inside the drawer.
 *
 * ┌─ A FLOATING PILL, AND THE GLASS IS MEASURED ────────────────────────────────────────────────┐
 * │ The pane is `.gm-chrome-glass` - a LIGHT tint carrying DARK ink, which is the opposite of    │
 * │ `.gm-glass` on the hero and is right for the opposite reason. This bar is sticky in the root │
 * │ layout, so it spends most of its life over the page rather than over a photograph, and a     │
 * │ dark tint there is a mid-grey wash rather than glass.                                         │
 * │                                                                                              │
 * │ The value it replaced was `bg-surface/95`, which Tailwind cannot compose against a `var()`   │
 * │ colour and therefore emitted NOTHING - a fully transparent bar with nav labels sitting on    │
 * │ whatever photo happened to scroll under them. That is why the tint is a `color-mix` and why  │
 * │ there is a test for it rather than a screenshot.                                              │
 * │                                                                                              │
 * │ 60% is not a taste value: it is the floor of the WORSE of the two themes, measured over the  │
 * │ worst frame a photograph can present. The arithmetic is in `globals.css`.                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE PILL CONDENSES ON SCROLL WITHOUT A SCROLL LISTENER ────────────────────────────────────┐
 * │ `animation-timeline: scroll()` in `globals.css`. §4.5 of the taste skill hard-bans           │
 * │ `addEventListener('scroll')`, and `MO4` allows only transform and opacity — so the pill      │
 * │ scales rather than animating its padding, and its children counter-scale so the wordmark     │
 * │ does not squash.                                                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The location control is a plain `<a>` to `/search`, not a picker. A dropdown that filters
 * nothing yet is a control that lies about what it does; when `FR-SRCH-02`'s geolocation lands it
 * becomes a real picker in this one file.
 */

import Link from 'next/link';

import { t } from '../i18n/index.ts';
import { icon } from '../icons/index.tsx';
import { PRIMARY_NAV } from './nav-model.ts';
import { MobileNav } from './mobile-nav.tsx';
import { ThemeToggle } from '../theme/theme-toggle.tsx';

export function SiteHeader() {
  const Place = icon.place;

  return (
    /*
     * `sticky`, and the padding on the OUTER element is what makes the pill appear to float: the
     * bar itself is the inner rounded element, and the gap around it is the header's own inset.
     * The outer element carries no background, so the page shows through the gap.
     */
    /*
     * TRANSPARENT, so the pill floats on whatever is behind it. On the home page that is the hero
     * photograph, because `.gm-under-chrome` pulls the hero up by exactly this element's height.
     *
     * The earlier version painted `bg-surface-media` here and let the hero start below it. That
     * put the navigation on a bar ABOVE the photograph rather than on it, which is most of why
     * the page did not read like the reference.
     */
    /*
     * ┌─ SHORTER AND THICKER, AND A GLASS PANE ────────────────────────────────────────────────────┐
     * │ 78rem (1248px) rather than the full 1440px container, and 66px tall. A bar that stops      │
     * │ short of the page edges reads as an object floating ON the photograph; one that runs the   │
     * │ full width reads as a strip laid OVER it. The extra height also shows more of what is       │
     * │ behind it, which is the entire point of the glass.                                          │
     * │                                                                                            │
     * │ The pane is `.gm-chrome-glass`, not `.gm-glass`. `SiteHeader` is mounted in the root       │
     * │ layout and is sticky, so it spends most of its life over the PAGE rather than over the     │
     * │ hero - and a dark tint there is a grey smudge. The chrome pane is light-tinted with dark   │
     * │ ink and flips with the theme; the arithmetic is in `globals.css`.                           │
     * │                                                                                            │
     * │ Nothing inside names an ink colour: the pane sets `color` and the children inherit it, so  │
     * │ the two cannot drift apart when the theme changes.                                          │
     * └────────────────────────────────────────────────────────────────────────────────────────────┘
     */
    <header className="sticky top-0 z-app-chrome px-inset-md pb-inset-lg pt-inset-2xs">
      <div className="gm-chrome-pill gm-app-chrome mx-auto flex max-w-[78rem] items-center gap-inline-lg rounded-full px-inset-xl py-inset-xs gm-chrome-glass">
        <Link
          href="/"
          className="gm-hit-target flex shrink-0 items-center gap-inline-2xs text-lg font-bold tracking-tight"
        >
          {/*
           * A mark, not a logo file. One glyph in a brand-filled circle: it survives at 24px, it
           * needs no asset pipeline, and it is the one place on this bar where the brand colour is
           * a FILL rather than ink — `content-on-brand` is the proved foreground for it.
           */}
          <span
            aria-hidden="true"
            className="flex h-[1.75rem] w-[1.75rem] items-center justify-center rounded-full bg-brand-solid text-sm font-bold text-content-on-brand"
          >
            G
          </span>
          {t('web.chrome.brand')}
        </Link>

        {/* Desktop. The drawer below carries the same items on small screens. */}
        <nav aria-label={t('web.chrome.nav.primary')} className="hidden min-w-0 flex-1 lg:block">
          <ul className="flex flex-wrap items-center justify-center gap-inline-lg">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                {item.built ? (
                  <Link
                    href={item.href}

                    className="gm-hit-target gm-nav-link text-sm font-semibold"
                  >
                    {t(item.label)}
                  </Link>
                ) : (
                  /*
                   * ┌─ FULL OPACITY AND A VISIBLE MARKER ────────────────────────────────────────┐
                   * │ This was `opacity-40` with the marker hidden from sighted readers, and the │
                   * │ comment defending it said the base pairing "is already proved at 15.52:1   │
                   * │ and has the headroom to spare". Opacity does not scale a contrast ratio:   │
                   * │ 40% of `content-on-media` on the chrome pill measures 2.06:1 against the   │
                   * │ worst frame, and the floor for 4.5:1 turns out to be opacity-97. There is  │
                   * │ no usable dimming here at all - the technique simply does not survive on a │
                   * │ translucent panel.                                                         │
                   * │                                                                            │
                   * │ The author's other instinct was right, though, and is preserved: five      │
                   * │ "SOON" pills across the bar would read as a construction site. There is    │
                   * │ exactly ONE unbuilt item in `PRIMARY_NAV`, so one marker is one marker.     │
                   * │ If that count grows, this becomes the wrong answer again.                   │
                   * │                                                                            │
                   * │ Word AND shape AND cursor, never opacity alone - `AX8`.                     │
                   * └────────────────────────────────────────────────────────────────────────────┘
                   */
                  <span
                    aria-disabled="true"
                    className="inline-flex cursor-default items-center gap-inline-2xs text-sm font-semibold"
                  >
                    {t(item.label)}
                    <span className="gm-visually-hidden"> ({t('web.chrome.nav.soon')})</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-inline-sm">
          {/*
           * Before the location pill, not after the sign-up button. The two things on the right
           * that are NOT navigation are the location filter and the theme, and a preference
           * control sitting between "Log in" and "Sign up" reads as a third thing to sign up for.
           */}
          <ThemeToggle />

          <Link
            href="/search"

            className="gm-hit-target gm-lift hidden items-center gap-inline-2xs rounded-full border border-strong px-inset-md py-inset-xs text-xs font-semibold md:inline-flex"
          >
            <Place aria-hidden="true" className="h-[0.875rem] w-[0.875rem]" />
            {t('web.chrome.location.anywhere')}
          </Link>

          {/*
           * Auth is not built, so these are marked rather than linked — same rule as the nav.
           * A "Log in" that 404s is the worst possible first impression of a marketplace.
           */}
          {/*
           * ┌─ ONE MARKER FOR THE PAIR, BECAUSE THEY ARE ONE FEATURE ─────────────────────────────┐
           * │ Both of these were dimmed too, and worse: element `opacity` composites a filled     │
           * │ control AS A GROUP, so `opacity-60` dimmed the red fill and the white label on it   │
           * │ together. White-on-pill measured 3.01:1 and the pill against the bar behind it      │
           * │ 1.15:1 - the primary conversion CTA was not distinguishable from the navigation.    │
           * │                                                                                     │
           * │ Full opacity restores 4.74:1 on the label. Log in and Sign up are not two unbuilt   │
           * │ things, they are one unbuilt thing called authentication, so they share one marker  │
           * │ rather than carrying two.                                                            │
           * └─────────────────────────────────────────────────────────────────────────────────────┘
           */}
          <span
            aria-disabled="true"
            className="hidden cursor-default text-xs font-semibold lg:inline"
          >
            {t('web.chrome.nav.signIn')}
            <span className="gm-visually-hidden"> ({t('web.chrome.nav.soon')})</span>
          </span>
          <span
            aria-disabled="true"
            className="gm-lift hidden cursor-default items-center gap-inline-2xs rounded-full bg-brand-solid px-inset-lg py-inset-xs text-xs font-semibold text-content-on-brand lg:inline-flex"
          >
            {t('web.chrome.nav.signUp')}
            <span className="gm-visually-hidden"> ({t('web.chrome.nav.soon')})</span>
          </span>

          <MobileNav />
        </div>
      </div>
    </header>
  );
}
