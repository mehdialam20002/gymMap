/**
 * The loading state for `SCR-WEB-002` — `B6`. A skeleton, not a spinner.
 *
 * ┌─ SCOPED TO THIS SEGMENT, AND THAT PLACEMENT IS LOAD-BEARING ────────────────────────────────┐
 * │ This file used to sit at `app/loading.tsx`, where it wrapped EVERY route in a Suspense       │
 * │ boundary. A streamed response commits its HTTP status with the first flushed byte — so by    │
 * │ the time `app/gyms/[citySlug]/[gymSlug]/page.tsx` called `notFound()`, the 200 was already   │
 * │ on the wire. The not-found page rendered under a 200: a textbook soft-404.                    │
 * │                                                                                              │
 * │ That is precisely what `FR-SRCH-13` cannot afford. A crawler reading 200 on a dead listing   │
 * │ keeps the URL in the index, keeps returning to it, and may index the not-found copy itself.  │
 * │                                                                                              │
 * │ `/search` never calls `notFound()` — an unmatched query is an empty RESULT SET, not a        │
 * │ missing page — so a boundary here costs nothing. Do not move this back up a level, and do    │
 * │ not add one to the gym-detail chain. `soft-404.spec.ts` asserts the status directly.          │
 * │                                                                                              │
 * │ What this boundary is FOR, corrected: it is not the slow route. That claim used to sit in    │
 * │ this comment and it is measured false — `/search` answers in 49.6 ms, which is faster than   │
 * │ `/how-it-works`, `/for-gyms/signup` and `/account/orders`, none of which has a boundary. The │
 * │ justification is the in-route facet swap: every filter, sort and chip on this page is a link │
 * │ back to `/search` with a different query string, so this is the one route a member re-enters │
 * │ over and over inside a single visit, and the only one where a fallback is seen more than     │
 * │ once. Cite that, not TTFB, if this is ever challenged.                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * A spinner communicates "something is happening"; a skeleton communicates "and it will look like
 * this", which is what stops the layout shift `NFR-PERF-02`'s CLS budget cannot afford.
 *
 * `MO6` — the shimmer stops the instant real content is available, and under
 * `prefers-reduced-motion` it is static (the duration tokens collapse to 1ms in `tokens.css`).
 *
 * ┌─ THE SHIMMER IS ANNOUNCED, AND EVERY BAR IS HIDDEN FROM THE ACCESSIBILITY TREE ─────────────┐
 * │ `aria-busy="true"` was set and nothing else was: measured, `role` was null, `aria-label` was │
 * │ null, and all sixteen `.animate-pulse` nodes had `aria-hidden` null. `aria-busy` on its own  │
 * │ names no region and starts no announcement, so a screen reader met an unnamed group of       │
 * │ sixteen empty boxes and said nothing at all about waiting.                                    │
 * │                                                                                              │
 * │ Three separate jobs, three elements, and none of them is a div with a role bolted on:        │
 * │                                                                                              │
 * │   `<section aria-label>`  a named region, so the skeleton is a place with a name rather      │
 * │                           than an anonymous run of boxes. `aria-busy` says it is mid-update.  │
 * │   `<output>`              the announcement. Implicit `role="status"`, so it is a polite live │
 * │                           region by being the right element rather than by being told.        │
 * │   `aria-hidden` bars      the drawing of a page is not the page. Sixteen unlabelled children │
 * │                           inside a live region are sixteen pieces of noise on one sentence.  │
 * │                                                                                              │
 * │ The live region is the small thing, not the wrapper - the same call `search-results.tsx`     │
 * │ makes when it puts `aria-live` on the count and not on the list of cards.                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { t } from '../../src/shared/i18n/index.ts';
import { FixtureNotice } from '../../src/features/discovery/search-results.tsx';

/**
 * The filter rail's five groups, at the height each one's option list actually takes.
 *
 * Below `lg` every group is one horizontally scrolling chip row and they are all 38px, so the
 * rail is a flat 5 × 66 + 4 × 12 = 378px. At `lg` the rows become columns and the heights are the
 * option counts: city, activity, price band, rating floor, facility. These five numbers are
 * measured off the rendered page and they move when the catalogue's facet counts move — which is
 * the same sentence as "this file changes when `search-results.tsx` changes", and the reason both
 * halves of the page's geometry are stated in one place rather than guessed in two.
 */
const FACET_GROUPS = [
  // 38 / 196
  {
    key: 'city',
    row: 'h-[2.375rem] lg:h-[12.25rem] animate-pulse rounded-control bg-surface-sunken',
  },
  // 38 / 436
  {
    key: 'activity',
    row: 'h-[2.375rem] lg:h-[27.25rem] animate-pulse rounded-control bg-surface-sunken',
  },
  // 38 / 156
  {
    key: 'price',
    row: 'h-[2.375rem] lg:h-[9.75rem] animate-pulse rounded-control bg-surface-sunken',
  },
  // 38 / 116
  {
    key: 'rating',
    row: 'h-[2.375rem] lg:h-[7.25rem] animate-pulse rounded-control bg-surface-sunken',
  },
  // 38 / 796
  {
    key: 'facilities',
    row: 'h-[2.375rem] lg:h-[49.75rem] animate-pulse rounded-control bg-surface-sunken',
  },
] as const;

export default function Loading() {
  return (
    <section
      className="gm-wrap gm-sec gm-sec-tight"
      aria-busy="true"
      aria-label={t('web.search.loading.region')}
    >
      <output className="gm-visually-hidden">{t('web.search.loading.status')}</output>

      {/*
       * ┌─ THE SHAPE OF THE PAGE, NOT A GENERIC THREE-CARD GRID ─────────────────────────────────┐
       * │ A skeleton's whole job is "and it will look like this". This one showed a heading, one  │
       * │ line and three cards across, while `SearchResults` renders a notice band, an eyebrow, a │
       * │ heading, a count, a search form, a filter rail, and then a SIDEBAR beside a two-column  │
       * │ results grid. Every one of those is a block that appears when the skeleton is replaced, │
       * │ so the thing built to prevent layout shift was causing it - and against `NFR-PERF-02`'s │
       * │ CLS budget, a wrong skeleton is worse than none, because it moves content twice.        │
       * │                                                                                        │
       * │ It was still wrong after that rewrite, in the way that is hard to see: the SHAPE was    │
       * │ right and every reserved height was short. Measured against the real page at 1280 -     │
       * │ form y 335 against 366, grid 407 against 440, first card y 463 against 491 and h 352    │
       * │ against 538, document 1604 against 3166. At 320 the notice band reserved 52px for a     │
       * │ block that renders 106, and the heading landed at 239 against 306. Reserving 352px for  │
       * │ a 538px card six times over is 1.1k of shift arriving in one frame.                     │
       * │                                                                                        │
       * │ Every height below is now a measurement off the rendered page rather than a round       │
       * │ number that looked about right, and the reconstruction was checked end to end: at 1280  │
       * │ this stack puts the eyebrow at 243, the heading at 278, the count at 345, the form at   │
       * │ 386, the grid at 460 and the first card at 511, which is the real page to the pixel.    │
       * │                                                                                        │
       * │ Same wrapper, same spacing tokens and the same grid template as `search-results.tsx`.   │
       * │ If that layout changes, this is the file that has to change with it.                    │
       * └────────────────────────────────────────────────────────────────────────────────────────┘
       */}

      {/*
       * The real notice, not a grey bar standing in for it.
       *
       * It is a constant string - it does not wait on anything, so there is nothing to be a
       * placeholder FOR - and it is the block whose height varies most with width: 106px at 320,
       * 86 at 360, 66 from 430 up. Any single reserved number is wrong at two of those three, and
       * the previous 52px was wrong at all of them. Rendering the component removes the guess and
       * makes the drift impossible: the band cannot disagree with itself.
       */}
      <FixtureNotice />

      {/* Heights are ARBITRARY VALUES, not `h-8` / `h-4`.
          `DesignSystem.md` §2.4 replaces Tailwind's numeric spacing scale with the token scale
          rather than extending it, so `h-8` resolves to nothing and Tailwind drops it silently.
          These bars had no height at all, which made the skeleton three invisible rows. */}

      {/* Every bar spells out `animate-pulse rounded-control bg-surface-sunken` rather than
          interpolating a shared constant. `shell.spec.ts` forbids an arbitrary utility inside a
          template literal that has an interpolation, because Tailwind's extractor reads source
          text and a class it cannot see is a class it does not emit - which in this file means a
          bar with no height, the exact bug the note above records. Repetition is the price. */}

      {/* The eyebrow: 17px tall, and `.gm-eyebrow-k` carries `margin: 0 0 18px`, which is where
          the heading's `mt-[18px]` comes from. `mt-stack-xs` was 8px and ten short. */}
      <div
        aria-hidden="true"
        className="mt-[26px] h-[1.0625rem] w-[9rem] animate-pulse rounded-control bg-surface-sunken"
      />

      {/* The heading and the count mirror their own type ramps instead of stepping at
          breakpoints, because both are `clamp()`d and therefore change at EVERY width, not at
          five of them. `.gm-h2` is `clamp(30px,4.6vw,58px)` at `line-height: 0.92` and `.gm-lede`
          is `clamp(15px,1.3vw,17px)` at 1.5, so these two expressions are exact from 320 to 2560
          - measured 28/33/43/53 and 23/23/25/26 against the real page. A stepped approximation
          was 10px out at 1279, which is a heading-sized jump. These are the two places this file
          restates a value from `globals.css`; both move when that rule moves. */}
      <div
        aria-hidden="true"
        className="mt-[18px] h-[calc(clamp(30px,4.6vw,58px)*0.92)] w-2/3 max-w-prose animate-pulse rounded-control bg-surface-sunken"
      />
      <div
        aria-hidden="true"
        className="mt-[14px] h-[calc(clamp(15px,1.3vw,17px)*1.5)] w-1/3 max-w-prose animate-pulse rounded-control bg-surface-sunken"
      />

      {/* The search form. 50px at every width, not 48 - the input is 48 and the row is 50. */}
      <div
        aria-hidden="true"
        className="mt-stack-md h-[3.125rem] max-w-form animate-pulse rounded-control bg-surface-sunken"
      />

      {/*
       * No bar for the active-filter chips. They are absent on a first load of `/search`, and a
       * row reserved for something that is usually not there is the same defect in the opposite
       * direction. On a facet swap they are present in the outgoing page and the incoming one,
       * which is the case where reserving nothing costs nothing.
       */}

      <div className="mt-stack-lg grid grid-cols-[minmax(0,1fr)] gap-inline-xl lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* The filter rail. Five groups, not three: five is what `Filters` renders. */}
        <div className="flex flex-col gap-stack-sm lg:gap-stack-lg">
          {FACET_GROUPS.map((group) => (
            <div key={group.key} className="flex flex-col gap-stack-xs">
              {/* The group's `<h2>`: `text-base font-semibold` measures 20px, not 16. */}
              <div
                aria-hidden="true"
                className="h-[1.25rem] w-[5rem] animate-pulse rounded-control bg-surface-sunken"
              />
              <div aria-hidden="true" className={group.row} />
            </div>
          ))}
        </div>

        <div className="min-w-0">
          {/* The sort bar, and it is not one height. Below `sm` it is a scroll row with
              `py-inset-sm` for the hit targets and measures 47; from `sm` it is `flex-wrap` and
              the five sorts take two lines, 61; from `md` they fit on one, 35. */}
          <div
            aria-hidden="true"
            className="h-[2.9375rem] animate-pulse rounded-control bg-surface-sunken sm:h-[3.8125rem] md:h-[2.1875rem]"
          />

          {/* Six cards at the card's real height. `SCR-WEB-002` fixes the count at six; the
              fixture happens to return eight, so the tail of the list still arrives below the
              fold, where it costs scroll distance rather than CLS.

              The heights are the measured card at each step - 524 / 571 / 637 / 603 / 538 - and
              the shape of that sequence is the layout, not noise: the card grows as the column
              grows, then drops at `xl` where the grid goes to two columns and each card is 420px
              wide again. A single height would be 113px wrong at `md`, six times over. */}
          <ul className="mt-stack-md grid gap-stack-md xl:grid-cols-2">
            {[0, 1, 2, 3, 4, 5].map((card) => (
              <li
                key={card}
                aria-hidden="true"
                className="h-[32.75rem] animate-pulse rounded-card bg-surface-sunken sm:h-[35.6875rem] md:h-[39.8125rem] lg:h-[37.6875rem] xl:h-[33.625rem]"
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
