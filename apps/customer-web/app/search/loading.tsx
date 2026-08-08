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
    <div className="mx-auto max-w-container px-inset-md py-region-md" aria-busy="true">
      <span className="gm-visually-hidden">{t('web.state.loading')}</span>
      <div className="h-8 w-2/3 max-w-prose animate-pulse rounded-control bg-surface-sunken" />
      <div className="mt-stack-md h-4 w-1/2 max-w-prose animate-pulse rounded-control bg-surface-sunken" />
      <div className="mt-stack-xl grid gap-stack-lg sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-card bg-surface-sunken" />
        ))}
      </div>
    </div>
  );
}
