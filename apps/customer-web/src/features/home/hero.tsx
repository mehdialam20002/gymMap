/**
 * `SCR-WEB-001` — the hero.
 *
 * Design read: `customer-web` for Priya, deciding, on a phone, being persuaded. Comfortable
 * density (`DesignSystem.md` §1.1), VARIANCE 7 and MOTION 4 — one moving thing, and it is the
 * footage. Nothing else on this surface animates.
 *
 * ┌─ WHY THE COPY SITS ON AN OPAQUE BAND RATHER THAN ON THE FOOTAGE ────────────────────────────┐
 * │ `contrast.proof.ts` refuses translucent colours on purpose, and the reason lands exactly    │
 * │ here: the ratio of light text over a 60% scrim depends on the video FRAME behind it. It is  │
 * │ provable against the establishing shot and unprovable four seconds later when the camera    │
 * │ finds a window. That is not a contrast measurement, it is a hope with a number next to it.  │
 * │                                                                                              │
 * │ So the veil below reaches FULLY OPAQUE `surface-media` across the half the copy occupies,   │
 * │ and every pairing in this file is `content-on-media` on `surface-media` — `MD1`, 19.28:1,   │
 * │ identical in both themes and re-measured by the accessibility suite.                         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The gradient turns with the breakpoint, and that is a layout decision rather than a flourish:
 * on a phone the opaque half is the BOTTOM and the copy sits in it; from `md` up the opaque half
 * is the LEFT, the copy moves into it, and the footage gets the right of the frame to itself.
 * A centred hero over a centred video is the composition every template ships.
 *
 * The form is the same real `<form method="get">` the page had before. It works before hydration,
 * it works with JavaScript off, and the URL it produces is shareable and crawlable — which is the
 * entire reason `SCR-WEB-002` keeps its state in the URL.
 */

import { t } from '../../shared/i18n/index.ts';
import { HeroMotionToggle, HeroVideo } from './hero-video.tsx';

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-surface-media">
      <HeroVideo />

      {/*
       * `from` at 0%, `via` at 50%, `to` at 100% — so the half nearest the copy is flat
       * `surface-media` with no video showing through it, and the ratio in that half is a
       * property of the palette rather than of the frame.
       */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-media via-surface-media to-transparent md:bg-gradient-to-r"
      />

      <div className="relative mx-auto max-w-container px-inset-md py-region-lg md:py-region-xl">
        <div className="max-w-prose">
          <h1 className="text-4xl font-bold tracking-tight text-content-on-media md:text-5xl">
            {t('web.home.hero.title')}
          </h1>

          {/*
           * Hierarchy is size and weight, never a dimmed colour. `TY1` allows one family, and
           * an opacity modifier here would put a pairing on screen that the §3.6 register does
           * not contain — which is how a surface acquires colours nobody measured.
           */}
          <p className="mt-stack-md text-lg text-content-on-media">{t('web.home.hero.subtitle')}</p>

          <form
            action="/search"
            method="get"
            className="mt-stack-xl flex max-w-form flex-col gap-stack-sm"
          >
            <label htmlFor="q" className="text-base font-medium text-content-on-media">
              {t('web.home.hero.searchLabel')}
            </label>
            <div className="flex flex-wrap gap-inline-sm">
              {/*
               * The input keeps `surface` and `content-primary`, the pairing the register
               * already proves at 17.85:1. A field tinted to match the band would be a fourth
               * colour on this surface and a fifth ratio to defend.
               */}
              <input
                id="q"
                name="q"
                type="search"
                placeholder={t('web.home.hero.searchPlaceholder')}
                className="min-w-0 flex-1 rounded-control border border-input bg-surface px-inset-md py-inset-sm text-md text-content placeholder:text-content-muted"
              />
              <button
                type="submit"
                className="gm-hit-target rounded-control bg-brand-solid px-inset-lg py-inset-sm text-md font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover active:bg-brand-solid-active"
                data-on-solid="true"
              >
                {t('web.home.hero.searchAction')}
              </button>
            </div>
          </form>

          {/* BR-GYM-01, at the point of action rather than three sections down. */}
          <p className="mt-stack-md text-sm text-content-on-media">{t('web.home.hero.trust')}</p>

          <div className="mt-stack-lg">
            <HeroMotionToggle />
          </div>
        </div>
      </div>
    </section>
  );
}
