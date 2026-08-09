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
 * Motion (`A-41`) is deliberately absent here. A drawer that animates open is a drawer a returning
 * visitor waits for several times a session, and `MO2` already says exit beats enter. The panel
 * appears; the page does not perform.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { t } from '../i18n/index.ts';
import { icon } from '../icons/index.tsx';
import { PRIMARY_NAV } from './nav-model.ts';

export function MobileNav() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    ref.current?.close();
    setOpen(false);
  }, []);

  const openDrawer = useCallback(() => {
    ref.current?.showModal();
    setOpen(true);
  }, []);

  // `showModal()` can be dismissed by Escape without any of our handlers running, so the dialog's
  // own `close` event is the authority on state — not the button that opened it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => setOpen(el.open);
    el.addEventListener('close', sync);
    return () => el.removeEventListener('close', sync);
  }, []);

  const Menu = icon.menu;
  const Close = icon.close;

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-on-media="true"
        // The TRIGGER lives inside the glass pill, so it takes the media pair. `text-content` is
        // the light-canvas ink and would go near-black on a near-black bar — correct-looking in
        // the file, invisible on the page. The PANEL below is a normal light surface and keeps
        // the canvas tokens; only this button crosses the boundary.
        className="gm-hit-target inline-flex items-center justify-center rounded-full border border-strong p-inset-2xs text-content-on-media transition-opacity duration-fast ease-standard hover:opacity-80 lg:hidden"
      >
        <Menu aria-hidden="true" className="h-[1.25rem] w-[1.25rem]" />
        <span className="sr-only">{t('web.chrome.nav.openMenu')}</span>
      </button>

      {/*
       * `m-0 ml-auto h-full max-h-none` overrides the UA's centred box so the dialog is a
       * right-hand panel. `backdrop:` styles the ::backdrop pseudo-element, which is why no
       * separate overlay div exists.
       */}
      <dialog
        ref={ref}
        aria-label={t('web.chrome.nav.primary')}
        className="m-0 ml-auto h-full max-h-none w-[min(20rem,85vw)] max-w-none bg-surface p-0 text-content backdrop:bg-surface-scrim"
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

          <nav className="flex-1 overflow-y-auto p-inset-sm">
            <ul className="flex flex-col">
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  {item.built ? (
                    <Link
                      href={item.href}
                      onClick={close}
                      className="block rounded-control px-inset-sm py-inset-sm text-base font-medium text-content transition-colors duration-fast ease-standard hover:bg-surface-sunken"
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
              ))}
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
