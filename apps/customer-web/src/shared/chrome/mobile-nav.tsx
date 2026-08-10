'use client';

/**
 * The small-screen navigation — `NFR-USE-07`, `AX2`.
 *
 * ┌─ A DRAWER, NOT A COLLAPSED DESKTOP BAR ─────────────────────────────────────────────────────┐
 * │ The desktop bar is a row of small targets scanned with a mouse. The same markup at 390px is │
 * │ a row of small targets scanned with a thumb, which is a different job: full-width rows,     │
 * │ generous height, one column, and the two auth actions promoted to the bottom where a thumb  │
 * │ actually rests. Same `PRIMARY_NAV` source, different component.                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE THREE THINGS A DIALOG HAS TO DO, DONE BY THE PLATFORM ─────────────────────────────────┐
 * │ `<dialog>` with `showModal()` gives focus trapping, Escape-to-close, inert background and   │
 * │ the top layer for free — all four of which are what hand-rolled drawers get wrong, usually  │
 * │ by trapping focus in a way that Escape cannot escape. The alternative was a `role="dialog"` │
 * │ div plus a focus-trap dependency, and the dependency would need an `A-NN` row to buy back   │
 * │ behaviour the browser already ships.                                                         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE ONE THING IT DOES NOT GIVE YOU: A PAGE THAT STAYS WHERE THE READER LEFT IT ────────────┐
 * │ Modality is about focus and hit-testing, not about scrolling. Measured on the production    │
 * │ build at 320x844 with the drawer open at scrollY 600: one wheel over `dialog::backdrop` at  │
 * │ x=8 took the page to 1400, and a second wheel over the PANEL ITSELF took it to 1800. The    │
 * │ reader then closes the drawer somewhere they never chose to be.                              │
 * │                                                                                              │
 * │ Both mechanisms below are here because the split test says one is not enough:                │
 * │   `overscroll-contain` on the dialog alone → backdrop wheel still 600→1400, panel wheel held │
 * │   `overflow: hidden` on `body` alone       → both held at 600                                │
 * │ `::backdrop` is not in the dialog's scroll chain, so containment cannot reach it; and the    │
 * │ body lock is exactly the mechanism iOS Safari is known not to honour, so the panel keeps its │
 * │ own containment rather than trusting one mechanism twice.                                     │
 * │                                                                                              │
 * │ `position: fixed` on `body` is deliberately NOT used. It is the variant that discards the    │
 * │ scroll offset and then has to restore it by hand, which is how drawers end up teleporting    │
 * │ the reader to the top. With `overflow` alone the offset is never lost: measured 600 before   │
 * │ opening and 600 after Escape-closing, through a backdrop wheel, a panel wheel and PageDown.  │
 * │                                                                                              │
 * │ The lock is written through CSSOM, never a `style` prop: `shell.spec.ts` bans `style={` and  │
 * │ `style-src` carries no `'unsafe-inline'`, so a style ATTRIBUTE would be dropped by the CSP   │
 * │ and the page would silently keep scrolling. A property write is not an attribute write —     │
 * │ verified against the shipped policy, `getComputedStyle(body).overflow === 'hidden'` and zero │
 * │ CSP violations logged.                                                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Motion (`A-41`) is deliberately absent here. A drawer that animates open is a drawer a returning
 * visitor waits for several times a session, and `MO2` already says exit beats enter. The panel
 * appears; the page does not perform.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { t } from '../i18n/index.ts';
import { icon } from '../icons/index.tsx';
import { PRIMARY_NAV } from './nav-model.ts';

/*
 * Plain string constants concatenated at the call site, because the current row differs from the
 * rest by two utilities and `shell.spec.ts` will not have an arbitrary utility inside an
 * interpolated template literal. The weight lives in the two variants rather than in the shared
 * part: `font-medium` and `font-semibold` are the same utility group, so whichever Tailwind emits
 * last would win regardless of the order they were written in the attribute.
 */
const ROW =
  'block rounded-control px-inset-sm py-inset-sm text-base text-content transition-colors duration-fast ease-standard';
const ROW_LINK = ROW + ' font-medium hover:bg-surface-sunken';
const ROW_CURRENT = ROW + ' bg-surface-sunken font-semibold';

export function MobileNav() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  /*
   * The body's INLINE declarations exactly as they were before the lock. `''` is a real value —
   * it means "no inline declaration at all" — and writing back the computed `hidden auto` instead
   * would bake the base stylesheet's `overflow-x: hidden` (BP2) into the element permanently.
   * `null` means "not locked", which is what makes both halves idempotent: a second `showModal()`
   * cannot capture `hidden` as the value to restore, and a stray `close` event cannot un-lock a
   * page it never locked.
   */
  const bodyBeforeLock = useRef<{ overflow: string; paddingRight: string } | null>(null);

  const lockPage = useCallback(() => {
    if (bodyBeforeLock.current) return;
    const { style } = document.body;
    bodyBeforeLock.current = { overflow: style.overflow, paddingRight: style.paddingRight };
    /*
     * Taking the scrollbar away widens the viewport, and everything behind the backdrop jumps by
     * that width. The gutter is measured, not assumed: it is 0 wherever the scrollbar is an
     * overlay — every phone, and the headless Chromium these numbers came from, where it measured
     * exactly 0 — and roughly a scrollbar's width in a desktop window narrow enough to still show
     * the drawer trigger, which is anything under `lg`. Not a design length, so not a token.
     */
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    style.overflow = 'hidden';
    if (gutter > 0) style.paddingRight = `${gutter}px`;
  }, []);

  const unlockPage = useCallback(() => {
    const before = bodyBeforeLock.current;
    if (!before) return;
    bodyBeforeLock.current = null;
    document.body.style.overflow = before.overflow;
    document.body.style.paddingRight = before.paddingRight;
  }, []);

  const close = useCallback(() => {
    ref.current?.close();
    setOpen(false);
  }, []);

  const openDrawer = useCallback(() => {
    ref.current?.showModal();
    lockPage();
    setOpen(true);
  }, [lockPage]);

  // `showModal()` can be dismissed by Escape without any of our handlers running, so the dialog's
  // own `close` event is the authority on state — not the button that opened it. The unlock hangs
  // off that same event for that same reason, and only off it: Escape has to give the page back
  // too, and it is the one exit no handler of ours ever sees.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      setOpen(el.open);
      unlockPage();
    };
    el.addEventListener('close', sync);
    // Unmounting mid-open would otherwise leave the whole document unscrollable with no dialog
    // left on the page to blame for it.
    return () => {
      el.removeEventListener('close', sync);
      unlockPage();
    };
  }, [unlockPage]);

  const Menu = icon.menu;
  const Close = icon.close;

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        aria-expanded={open}
        aria-haspopup="dialog"
        /*
         * `text-content`, not the media pair. The trigger sits on `.gm-chrome-glass`, which tints
         * with `surface-default` and therefore flips - so a pinned near-white glyph measured
         * 1.05:1 on the light theme's white pill and simply was not there. Same defect, same
         * cause, as the theme control beside it; the note there carries the measurement.
         */
        className="inline-flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-full border border-strong text-content transition-opacity duration-fast ease-standard hover:opacity-80 lg:hidden"
      >
        <Menu aria-hidden="true" className="h-[1.25rem] w-[1.25rem]" />
        <span className="sr-only">{t('web.chrome.nav.openMenu')}</span>
      </button>

      {/*
       * `m-0 ml-auto h-full max-h-none` overrides the UA's centred box so the dialog is a
       * right-hand panel. `backdrop:` styles the ::backdrop pseudo-element, which is why no
       * separate overlay div exists.
       *
       * `overscroll-contain` is the half of the scroll fix that belongs on the element. The UA
       * gives a modal dialog `overflow: auto` (measured: `getComputedStyle(dialog).overflow` is
       * `auto` once `showModal()` has run), so it IS a scroll container and containment applies to
       * it — a flick that reaches the end of the panel stops there instead of handing the rest of
       * its momentum to the document underneath.
       */}
      <dialog
        ref={ref}
        aria-label={t('web.chrome.nav.primary')}
        className="m-0 ml-auto h-full max-h-none w-[min(20rem,85vw)] max-w-none overscroll-contain bg-surface p-0 text-content backdrop:bg-surface-scrim"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-subtle px-inset-md py-inset-sm">
            <span className="text-lg font-semibold tracking-tight">{t('web.chrome.brand')}</span>
            <button
              type="button"
              onClick={close}
              className="gm-hit-target inline-flex items-center justify-center rounded-control p-inset-2xs text-content-secondary transition-colors duration-fast ease-standard hover:text-content"
            >
              <Close aria-hidden="true" className="h-[1.25rem] w-[1.25rem]" />
              <span className="sr-only">{t('web.chrome.nav.closeMenu')}</span>
            </button>
          </div>

          {/*
           * Named, even though the dialog carries the same name: a `<nav>` is a landmark, and an
           * unnamed landmark is listed as "navigation" in the rotor next to the footer's and the
           * breadcrumb's. Same key as the dialog because it is the same list of links, and
           * inventing a second string for one list is how the two drift apart (`F35`, `AX2`).
           */}
          <nav
            aria-label={t('web.chrome.nav.primary')}
            className="flex-1 overflow-y-auto p-inset-sm"
          >
            <ul className="flex flex-col">
              {PRIMARY_NAV.map((item) => {
                /*
                 * Exact, not a prefix. `aria-current="page"` is a claim that THIS link points at
                 * the page you are on, so `/explore` must not claim it while the reader is on
                 * `/explore/yoga` — that reads as a wrong answer to a screen reader rather than as
                 * a helpful one. A section-level marker would be `aria-current="true"` and needs a
                 * decision about which items own which subtrees; there is no such data in
                 * `PRIMARY_NAV` today, so it is not invented here.
                 *
                 * The tint is not carrying this alone: `aria-current` names it for assistive
                 * technology and the weight change is a second, non-colour channel for everyone
                 * else (`AX8`).
                 */
                const isCurrent = item.built && pathname === item.href;
                return (
                  <li key={item.href}>
                    {item.built ? (
                      <Link
                        href={item.href}
                        onClick={close}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={isCurrent ? ROW_CURRENT : ROW_LINK}
                      >
                        {t(item.label)}
                      </Link>
                    ) : (
                      <span className="flex items-center justify-between px-inset-sm py-inset-sm text-base text-content-disabled">
                        {t(item.label)}
                        <span className="rounded-control bg-surface-sunken px-inset-2xs py-inset-2xs text-2xs font-medium uppercase tracking-wide text-content-muted">
                          {t('web.chrome.nav.soon')}
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Thumb reach. The two account actions sit at the bottom, not the top. */}
          <div className="border-t border-subtle p-inset-md">
            {/* No em-dash: §5.1 bans it in rendered strings, and this is one. */}
            <p className="text-sm text-content-disabled">
              {t('web.chrome.nav.signIn')} · {t('web.chrome.nav.signUp')} ·{' '}
              {t('web.chrome.nav.soon')}
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}
