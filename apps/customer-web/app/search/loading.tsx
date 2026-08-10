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
 * │ missing page — so a boundary here costs nothing and still covers the slow route. Do not      │
 * │ move this back up a level, and do not add one to the gym-detail chain.                        │
 * │ `soft-404.spec.ts` asserts the status directly.                                               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * A spinner communicates "something is happening"; a skeleton communicates "and it will look like
 * this", which is what stops the layout shift `NFR-PERF-02`'s CLS budget cannot afford.
 *
 * `MO6` — the shimmer stops the instant real content is available, and under
 * `prefers-reduced-motion` it is static (the duration tokens collapse to 1ms in `tokens.css`).
 * `aria-busy` plus a visually-hidden label, because a shimmer is invisible to a screen reader.
 */

import { t } from '../../src/shared/i18n/index.ts';

export default function Loading() {
  return (
    <div className="gm-wrap gm-sec gm-sec-tight" aria-busy="true">
      <span className="gm-visually-hidden">{t('web.state.loading')}</span>
      {/* Heights are ARBITRARY VALUES, not `h-8` / `h-4`.
          `DesignSystem.md` §2.4 replaces Tailwind's numeric spacing scale with the token scale
          rather than extending it, so `h-8` resolves to nothing and Tailwind drops it silently.
          These bars had no height at all, which made the skeleton three invisible rows. */}
      {/*
       * ┌─ THE SHAPE OF THE PAGE, NOT A GENERIC THREE-CARD GRID ─────────────────────────────────┐
       * │ A skeleton's whole job is "and it will look like this". This one showed a heading, one  │
       * │ line and three cards across, while `SearchResults` renders a notice band, an eyebrow, a │
       * │ heading, a count, a search form, a filter row, and then a SIDEBAR beside a two-column   │
       * │ results grid. Every one of those is a block that appears when the skeleton is replaced, │
       * │ so the thing built to prevent layout shift was causing it - and against `NFR-PERF-02`'s │
       * │ CLS budget, a wrong skeleton is worse than none, because it moves content twice.        │
       * │                                                                                        │
       * │ Same wrapper, same spacing tokens and the same grid template as `search-results.tsx`.   │
       * │ If that layout changes, this is the file that has to change with it.                    │
       * └────────────────────────────────────────────────────────────────────────────────────────┘
       */}
      {/* The fixture notice band, which is the first thing on the real page. */}
      <div className="h-[3.25rem] animate-pulse rounded-card bg-surface-sunken" />

      <div className="mt-[26px] h-[0.875rem] w-[9rem] animate-pulse rounded-control bg-surface-sunken" />
      <div className="mt-stack-xs h-[2.5rem] w-2/3 max-w-prose animate-pulse rounded-control bg-surface-sunken" />
      <div className="mt-stack-sm h-[1rem] w-1/3 max-w-prose animate-pulse rounded-control bg-surface-sunken" />

      {/* The search form, then the active-filter row. */}
      <div className="mt-stack-md h-[3rem] max-w-form animate-pulse rounded-control bg-surface-sunken" />

      <div className="mt-stack-lg grid grid-cols-[minmax(0,1fr)] gap-inline-xl lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* The filter rail. A row of chips below `lg`, a column of groups above it. */}
        <div className="flex flex-col gap-stack-sm lg:gap-stack-lg">
          {[0, 1, 2].map((group) => (
            <div key={group} className="flex flex-col gap-stack-2xs">
              <div className="h-[1rem] w-[5rem] animate-pulse rounded-control bg-surface-sunken" />
              <div className="h-[6rem] animate-pulse rounded-control bg-surface-sunken" />
            </div>
          ))}
        </div>

        <div className="min-w-0">
          {/* The sort bar. */}
          <div className="h-[2.5rem] animate-pulse rounded-control bg-surface-sunken" />
          <ul className="mt-stack-md grid gap-stack-md xl:grid-cols-2">
            {[0, 1, 2, 3].map((card) => (
              <li key={card} className="h-[22rem] animate-pulse rounded-card bg-surface-sunken" />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
