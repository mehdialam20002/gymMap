/**
 * The site header — `SCR-WEB-*` chrome. `AX2`, `NFR-USE-08`.
 *
 * A Server Component. The only client thing in the shell is the drawer's disclosure state, which
 * lives in `mobile-nav.tsx`; everything a crawler needs — brand, every primary link, the auth
 * entry points — is server-rendered, including inside the drawer.
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

export function SiteHeader() {
  const Place = icon.place;

  return (
    /*
     * ┌─ OPAQUE. `bg-surface/95 backdrop-blur` WAS NOT A SUBTLER VERSION OF THIS — IT WAS NOTHING ─┐
     * │ The preset maps each colour to a token as a finished value (`#F3F5F0`), not to the channel │
     * │ triplet Tailwind's `/95` modifier needs, so `bg-surface/95` is not a utility Tailwind can  │
     * │ emit. It emitted none. `getComputedStyle(header).backgroundColor` was `rgba(0, 0, 0, 0)`:  │
     * │ a fully transparent bar with a blur behind it, and nav labels sitting directly on whatever │
     * │ photo happened to scroll under them.                                                        │
     * │                                                                                            │
     * │ That is the exact failure `contrast.proof.ts` refuses to measure — a ratio against a       │
     * │ translucent fill depends on what is behind it, so it cannot be proved. On a page whose     │
     * │ content is gym photography, "what is behind it" is a different answer every scroll.        │
     * │                                                                                            │
     * │ `backdrop-blur` goes with it: nothing shows through an opaque background, so it was cost   │
     * │ with no effect. The frosted look is available the day a token carries an alpha channel     │
     * │ and the pairing can be proved; until then the bar is a bar.                                 │
     * └────────────────────────────────────────────────────────────────────────────────────────────┘
     */
    <header className="sticky top-0 z-app-chrome border-b border-subtle bg-surface">
      {/* `gm-app-chrome` sets the min-height that `--gm-chrome-height` promises — see globals.css.
          Sticky content further down the page offsets by that variable. */}
      <div className="gm-app-chrome mx-auto flex max-w-container items-center gap-inline-lg px-inset-md py-inset-sm">
        <Link
          href="/"
          className="gm-hit-target shrink-0 text-lg font-semibold tracking-tight text-content"
        >
          {t('web.chrome.brand')}
        </Link>

        {/* Desktop. The drawer below carries the same items on small screens. */}
        <nav aria-label={t('web.chrome.nav.primary')} className="hidden min-w-0 flex-1 lg:block">
          <ul className="flex flex-wrap items-center gap-inline-lg">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                {item.built ? (
                  <Link
                    href={item.href}
                    className="gm-hit-target text-base text-content-secondary transition-colors duration-fast ease-standard hover:text-content"
                  >
                    {t(item.label)}
                  </Link>
                ) : (
                  /*
                   * Dimmed, and the marker is for screen readers only.
                   *
                   * The first version put a "SOON" pill beside each of these. Five pills across
                   * the primary bar read as a construction site rather than a marketplace — the
                   * signal was honest and the visual weight was wrong. Disabled colour already
                   * says "not yet" to a sighted visitor; `aria-disabled` plus the hidden word
                   * says it to everyone else, without shouting at either.
                   */
                  <span
                    aria-disabled="true"
                    className="cursor-default text-base text-content-disabled"
                  >
                    {t(item.label)}
                    <span className="sr-only"> ({t('web.chrome.nav.soon')})</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-inline-sm">
          <Link
            href="/search"
            className="gm-hit-target hidden items-center gap-inline-2xs rounded-control border border-subtle px-inset-sm py-inset-2xs text-sm text-content-secondary transition-colors duration-fast ease-standard hover:border-strong hover:text-content md:inline-flex"
          >
            <Place aria-hidden="true" className="h-[1rem] w-[1rem]" />
            {t('web.chrome.location.anywhere')}
          </Link>

          {/*
           * Auth is not built, so these are marked rather than linked — same rule as the nav.
           * A "Log in" that 404s is the worst possible first impression of a marketplace.
           */}
          <span aria-disabled="true" className="hidden text-sm text-content-disabled lg:inline">
            {t('web.chrome.nav.signIn')}
            <span className="sr-only"> ({t('web.chrome.nav.soon')})</span>
          </span>
          <span
            aria-disabled="true"
            className="hidden cursor-default rounded-control bg-surface-sunken px-inset-sm py-inset-2xs text-sm font-medium text-content-disabled lg:inline-flex"
          >
            {t('web.chrome.nav.signUp')}
            <span className="sr-only"> ({t('web.chrome.nav.soon')})</span>
          </span>

          <MobileNav />
        </div>
      </div>
    </header>
  );
}
