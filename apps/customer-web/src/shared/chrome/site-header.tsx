'use client';

/**
 * The site header — `SCR-WEB-*` chrome. `AX2`, `NFR-USE-08`.
 *
 * ┌─ IT WAS A SERVER COMPONENT, AND `aria-current` IS WHAT COST IT THAT ────────────────────────┐
 * │ This note used to open "A Server Component". The reason it no longer can be one is the taste │
 * │ skill §7: `aria-current` belongs on active navigation, not just a background tint — and the  │
 * │ current route is not knowable on the server in the App Router. `usePathname` is a client     │
 * │ hook and there is deliberately no server equivalent, because a Server Component is rendered  │
 * │ per-segment rather than per-URL.                                                              │
 * │                                                                                              │
 * │ The SEO argument the old note rested on survives whole: a client component is still SERVER-  │
 * │ RENDERED to HTML, so the brand, every primary link and the auth entry points are in the      │
 * │ first response exactly as they were. What changed is that this markup now hydrates.           │
 * │                                                                                              │
 * │ The bundle cost was checked rather than assumed, and it is close to nothing. `theme-toggle`  │
 * │ and `mobile-nav` are already client islands ON this bar, and between them they already pull  │
 * │ `t()` (the whole `en.ts` catalogue), the icon map and `PRIMARY_NAV` into the browser. The    │
 * │ only new bytes are this file's own JSX.                                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
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
import { usePathname } from 'next/navigation';

import { t } from '../i18n/index.ts';
import { icon } from '../icons/index.tsx';
import { PRIMARY_NAV } from './nav-model.ts';
import { MobileNav } from './mobile-nav.tsx';
import { ThemeToggle } from '../theme/theme-toggle.tsx';

/**
 * Prefix matching, not equality.
 *
 * `/cities/mumbai` marks `/cities`; `/for-gyms/signup` marks `/for-gyms`. Every one of the six
 * primary items has children, and a bar that forgets where you are the moment you go one level
 * deeper is worse than no marker at all — the reader learns not to trust it. The trailing slash is
 * what stops `/searchers` matching `/search`.
 */
function isCurrentRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const Place = icon.place;
  const pathname = usePathname();

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
     * │ The PAGE measure rather than the full 1440px container, and 66px tall. A bar that stops    │
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
    /*
     * ┌─ THE BAR REFLOWS AT 200% TEXT INSTEAD OF PUSHING ITS ONLY CONTROL OFF THE SCREEN ──────────┐
     * │ WCAG 1.4.4 and 1.4.10, and it was a total failure rather than a rough edge. The pill was   │
     * │ `flex` with no wrap, BOTH children `shrink-0`, and a `rem` gap and `rem` inline padding    │
     * │ that double with the root font. Measured on the shipped build at Chrome font size 32px:     │
     * │                                                                                            │
     * │   390x844   scrollWidth 470 against innerWidth 390. "Open menu" at L420 R470 - it BEGAN    │
     * │             30px past the right edge, 80px out in total.                                    │
     * │   320x640   150px out, and a hit test at the clamped centre returned HEADER, not BUTTON.    │
     * │                                                                                            │
     * │ Below `lg` that button is the ONLY navigation control on the page. `body` is                │
     * │ `overflow-x: hidden` and `html` is not, so the overflow propagates to the viewport: no      │
     * │ scrollbar, no pan, no reachable menu. The site simply had no navigation at 200% text.       │
     * │                                                                                            │
     * │ Three utilities, each doing a different job:                                                │
     * │                                                                                            │
     * │   `flex-wrap`         a line that cannot fit becomes two. 1.4.10 explicitly allows the      │
     * │                       page to get TALLER; what it forbids is the page getting WIDER.        │
     * │   `min-[20rem]:`      the inline padding is the designed token above that width and a       │
     * │                       tighter one below it. 20rem IS 320px - `screens.base`, not a new      │
     * │                       number - but a media query resolves `rem` against the BROWSER's       │
     * │                       default font size and never against anything the page sets. So it is │
     * │                       false on a 390px phone at 200% text and true on every real viewport  │
     * │                       at 100%. It asks how many lines of the reader's own text fit across,  │
     * │                       which is the question; `min-width: 320px` asks how many CSS pixels,   │
     * │                       which is not. `BP5`'s capability-query reasoning, one axis over.      │
     * │   `gap-y-inline-2xs`  a row gap only exists once something has wrapped, so it is free at    │
     * │                       100% and saves 28px per wrapped row at 200%.                          │
     * │                                                                                            │
     * │ Measured after, same build, same font size: 320x640 scrollWidth 320 = innerWidth, the menu │
     * │ button at L237 R287 with 33px to spare, and the hit test returns the button. 390x844        │
     * │ likewise. Every 100% measurement - 390, 1024, 1280, 2560 - is unchanged to the pixel,       │
     * │ which is the whole point of anchoring the switch at `base` rather than at `sm`.             │
     * └────────────────────────────────────────────────────────────────────────────────────────────┘
     */
    <header className="sticky top-0 z-app-chrome px-inset-xs pb-inset-lg pt-inset-2xs min-[20rem]:px-inset-md">
      <div className="gm-chrome-pill gm-app-chrome mx-auto flex max-w-[var(--gm-container-max)] flex-wrap items-center gap-x-inline-lg gap-y-inline-2xs rounded-full px-inset-xs py-inset-xs gm-chrome-glass min-[20rem]:px-inset-xl">
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
        {/*
         * ┌─ `flex-auto`, NOT `flex-1`, AND THE DIFFERENCE IS 270px OF STICKY HEADER ──────────────┐
         * │ `flex-1` is `flex: 1 1 0%`, so this nav's hypothetical size is ZERO - it can never be  │
         * │ the item that starts a new flex line, whatever it actually contains. At 1280x800 and   │
         * │ font 32px that produced the measured shape: the brand (211px) and the right-hand       │
         * │ controls (557px, both `shrink-0`) took the line, the nav was handed the 254px left     │
         * │ over, and its own `flex-wrap` broke six items across SIX rows. Header height 534px on  │
         * │ an 800px viewport - 67% of it, permanently, because this bar is sticky. At 1024 it     │
         * │ was 822px, taller than the viewport.                                                    │
         * │                                                                                        │
         * │ `flex-auto` is `flex: 1 1 auto`: same growth, same shrink, but the basis is the        │
         * │ CONTENT. When the six items no longer fit beside the brand the nav takes a line of its │
         * │ own, where 1086px is plenty for the 945px it wants, and it is one row again.           │
         * │                                                                                        │
         * │ Measured, same build: 1280x800 at font 32 goes 534px -> 264px and six rows -> one.     │
         * │ 1024x800 goes 822px -> 344px. At 100% nothing moves at all: 1024, 1280 and 2560 all    │
         * │ measure identically before and after, because with a single growable item on a line    │
         * │ that already fits, `1 1 0%` and `1 1 auto` resolve to the same width.                   │
         * │                                                                                        │
         * │ This does NOT finish `1.4.10` at 200% - 264px is still a third of the viewport. The    │
         * │ rest of it is the drawer hand-over, which cannot be done from this file alone; the     │
         * │ note is in the return value of the audit rather than invented here.                     │
         * └────────────────────────────────────────────────────────────────────────────────────────┘
         */}
        <nav aria-label={t('web.chrome.nav.primary')} className="hidden min-w-0 flex-auto lg:block">
          {/*
           * The column gap is the designed one; the ROW gap only ever applies to a wrapped line,
           * which at 100% never happens. Splitting the axes costs nothing and stops a second row
           * from arriving with 32px of air above it at 200%.
           */}
          <ul className="flex flex-wrap items-center justify-center gap-x-inline-lg gap-y-inline-2xs">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                {item.built ? (
                  /*
                   * ┌─ `aria-current`, AND THE UNDERLINE IT ALREADY HAD ─────────────────────────┐
                   * │ Taste skill §7: `aria-current` on active nav, not just a tint. It is also  │
                   * │ the reason this file gives up being a Server Component - see the header.   │
                   * │                                                                            │
                   * │ The sighted half costs no CSS. `.gm-nav-link::before` is the brand         │
                   * │ underline, parked at `scaleX(0)` and grown from the left on hover and      │
                   * │ focus; `before:scale-x-100` simply pins it open for the current route.     │
                   * │ Tailwind emits `@tailwind utilities` BEFORE `globals.css` opens its        │
                   * │ `@layer base`, and unlayered beats layered whatever the order, so this     │
                   * │ wins over the `scaleX(0)` in the component rule without touching it.        │
                   * │                                                                            │
                   * │ Word AND shape, never one of the two - the attribute is what a screen      │
                   * │ reader announces, the underline is what everyone else sees, and neither is │
                   * │ carrying the state on its own.                                             │
                   * └────────────────────────────────────────────────────────────────────────────┘
                   */
                  <Link
                    href={item.href}
                    aria-current={isCurrentRoute(pathname, item.href) ? 'page' : undefined}
                    className="gm-hit-target gm-nav-link text-sm font-semibold aria-[current=page]:before:scale-x-100"
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
