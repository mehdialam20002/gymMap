'use client';

/**
 * The navigation-pending affordance — `NFR-USE-02` (`AX2`), `NFR-USE-08`, `DesignSystem.md` §6.6.
 *
 * ┌─ MEASURED: NOTHING ON THIS SITE SAID A NAVIGATION WAS IN FLIGHT, EXCEPT ON /search ─────────┐
 * │ At 1,500 ms latency / 30,000 B/s, against the pre-fix build:                                 │
 * │     home -> gym detail      3,744 ms                                                         │
 * │     home -> /how-it-works   1,774 ms                                                         │
 * │     /search -> gym detail   1,959 ms                                                         │
 * │ Across all three the MAXIMUM count of `[aria-busy="true"]` on the whole document was 0, of   │
 * │ skeleton nodes 0, and the clicked link took no pending styling at all. Re-measured against   │
 * │ the same build while writing this: / -> /how-it-works took 4,983 ms, still 0 and 0.           │
 * │                                                                                              │
 * │ `.gm-progress` is not this and never was. It is `aria-hidden` and driven by                  │
 * │ `animation-timeline: scroll()` — a scroll POSITION bar, which says nothing about a pending    │
 * │ route and is at its emptiest exactly when a navigation starts from the top of a page.         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ ONE AFFORDANCE IN THE ROOT LAYOUT, NOT A `loading.tsx` PER ROUTE ──────────────────────────┐
 * │ Unthrottled those same three transitions are 21-56 ms; at 4x CPU / 150 ms / 1.6 Mbps they    │
 * │ are 268-505 ms; at 6x / 400 ms / 400 kbps, 618-1,296 ms. The dead time tracks the RSC round  │
 * │ trip and hydration, NOT page complexity, so it is essentially uniform across destinations.   │
 * │ That is what makes a per-route fallback the wrong tool and this the right one: mounted once, │
 * │ it covers every route, including the ones nobody remembers to add a fallback to.              │
 * │                                                                                              │
 * │ And it is deliberately NOT a skeleton. There is zero async work in this app — every page is  │
 * │ a synchronous Server Component over an in-memory fixture and TTFB is 43-63 ms — so a         │
 * │ skeleton would draw the shape of content that was never being fetched. `MO6`: a shimmer that │
 * │ outlives its data is a lie about progress. What is genuinely slow is the client transition,  │
 * │ so the client transition is the only thing this reports.                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY NOT `useLinkStatus`, AND WHY NOT `useSearchParams` ────────────────────────────────────┐
 * │ `useLinkStatus` is the right primitive and this Next cannot supply it. Checked rather than   │
 * │ assumed: the installed `next` is 14.2.35, and `next/link.d.ts` re-exports exactly two things │
 * │ — the `LinkProps` type and the default `Link`. The hook landed in 15.3. So the fallback the  │
 * │ brief names is what this is built on: `usePathname` from `next/navigation`.                   │
 * │                                                                                              │
 * │ `useSearchParams` would have been the tidier completion signal and is refused on purpose.    │
 * │ Read from a component mounted in the ROOT layout, it forces every page in the app into       │
 * │ client-side rendering at build time in Next 14 unless it is wrapped in a Suspense boundary.  │
 * │ Trading the static rendering of all twenty-eight routes for a slightly wider trigger is not  │
 * │ a trade worth making. What it costs instead is written on `isWorthShowing` below.             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ REDUCED MOTION IS NOT HANDLED HERE, AND THAT IS THE POINT ─────────────────────────────────┐
 * │ `RM1` collapses every duration token to 1 ms in one place, in `tokens.css`. Because the bar  │
 * │ travels on `duration-deliberate` and nothing else, it is already covered. A                  │
 * │ `prefers-reduced-motion` query or a `motion-reduce:` variant in this file would be a SECOND  │
 * │ implementation of a rule that already has one, which is how the two drift apart.              │
 * │                                                                                              │
 * │ It degrades correctly rather than merely quickly: at 1 ms the bar stops travelling and       │
 * │ becomes a static mark that appears and disappears. `RM2` — movement goes, feedback stays.    │
 * │ Nothing here loops, so there is no infinite animation left running at 1 ms (§4.4).            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { t } from '../i18n/index.ts';

/**
 * Below this, nothing is drawn at all.
 *
 * A bar that flashes for 40 ms on every click is worse than no bar: it turns an instant navigation
 * into a flicker and trains people to distrust it. Unthrottled transitions here are 21-56 ms, so
 * 180 ms clears the entire fast path with room to spare and only genuinely slow transitions — the
 * 268 ms-and-up band — ever reach the screen.
 */
const SHOW_DELAY_MS = 180;

/**
 * The dead man's handle. Not a timeout on the navigation — a bound on being WRONG about one.
 *
 * The bar is armed on a click and disarmed when the pathname changes. Almost everything that could
 * break that pairing is already refused by `isWorthShowing`, but not everything can be: a handler
 * further down the capture chain can still cancel a click this component has already counted, and
 * a navigation can fail without ever committing a route. Without a cap, either case leaves the bar
 * up permanently, which is a worse lie than the one this component exists to fix.
 *
 * 15 s is deliberately far past the worst transition ever measured on this app (4,983 ms, at 1,500
 * ms latency) so it never truncates a real one. It exists to be unreachable.
 */
const GIVE_UP_MS = 15_000;

/**
 * How far the bar has travelled, as complete class names.
 *
 * Written out in full because Tailwind extracts class names by scanning source text — a computed
 * `` `scale-x-${n}` `` is not a string that exists in this file and every one of these would be
 * purged from the stylesheet. The tuple is indexed by `Phase`, so the mapping is total.
 *
 * These are the stock scale steps, and the ceiling is 90 rather than 100 on purpose: the extent
 * encodes ELAPSED TIME, not bytes received, and there is no byte count to encode — see the header.
 * A bar that reached the right-hand edge would be claiming completion it cannot observe, and it
 * would reach it while the page was still not there. It advances, then waits, and never arrives.
 */
const EXTENT = ['scale-x-0', 'scale-x-50', 'scale-x-75', 'scale-x-90'] as const;

/** 0 is idle. 1-3 are the visible steps, walked by `transitionend` rather than by a clock. */
type Phase = 0 | 1 | 2 | 3;

/**
 * Would this click produce a transition this component can see the END of?
 *
 * Everything below is a case where arming the bar would strand it, and the honest answer is to
 * stay dark rather than to guess:
 *
 *   - a modified or non-primary click, and `target`/`download` — the browser opens a tab or saves
 *     a file, and THIS document never navigates at all;
 *   - a cross-origin href — a full page load, where the browser's own throbber is the affordance
 *     and ours would be torn down mid-fade by the unload;
 *   - an href whose PATHNAME matches the current one. This is the deliberate gap. A query-only or
 *     hash-only change never moves `usePathname`, so nothing would ever disarm the bar. Refusing
 *     to arm is the only correct behaviour without `useSearchParams`, and it costs less than it
 *     sounds: /search already carries its own indicator for exactly those filter transitions, and
 *     that is why /search was the one route the audit found already covered.
 */
function isWorthShowing(event: MouseEvent): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const target = event.target;
  if (!(target instanceof Element)) return false;

  // `instanceof HTMLAnchorElement` and not a truthiness check: `closest('a[href]')` also matches
  // an SVG `<a>`, whose `.href` is an `SVGAnimatedString` rather than a resolved URL string.
  const anchor = target.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.hasAttribute('download')) return false;
  if (anchor.target !== '' && anchor.target !== '_self') return false;

  // `anchor.href` is already absolute; the base is belt and braces for a malformed attribute.
  let next: URL;
  try {
    next = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }

  if (next.origin !== window.location.origin) return false;
  return next.pathname !== window.location.pathname;
}

export function RoutePending() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>(0);
  const giveUp = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reveal = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The last pathname React has actually committed — `popstate` needs the OLD value (see below). */
  const settled = useRef(pathname);

  const disarm = useCallback(() => {
    if (reveal.current !== null) clearTimeout(reveal.current);
    if (giveUp.current !== null) clearTimeout(giveUp.current);
    reveal.current = null;
    giveUp.current = null;
    setPhase(0);
  }, []);

  const arm = useCallback(() => {
    disarm();
    reveal.current = setTimeout(() => setPhase(1), SHOW_DELAY_MS);
    giveUp.current = setTimeout(() => setPhase(0), GIVE_UP_MS);
  }, [disarm]);

  /*
   * The completion signal, and the only one.
   *
   * `usePathname` changes as part of the same commit that paints the new route, so the bar clears
   * at the moment the content it was standing in for appears — not a frame before it, which would
   * show a gap, and not on a timer, which would be a guess.
   */
  useEffect(() => {
    settled.current = pathname;
    disarm();
  }, [pathname, disarm]);

  useEffect(() => {
    /*
     * CAPTURE phase, on `document`.
     *
     * Next's `<Link>` calls `preventDefault()` on the anchor and performs the navigation itself,
     * and it does so through React's delegated handler — which in the App Router is bound to
     * `document` too, because React hydrates into the document. Listening in the bubble phase
     * would mean racing that handler for ordering AND seeing `defaultPrevented` already true on
     * every single internal link. Capture runs first, unconditionally, and needs to know nothing
     * about Next's internals to do it.
     *
     * This is a click listener, not a scroll listener. §4.5's hard ban is on `scroll`.
     */
    const onClick = (event: MouseEvent) => {
      if (isWorthShowing(event)) arm();
    };

    /*
     * Back and forward. By the time `popstate` fires, `window.location` is ALREADY the destination
     * while React is still on the old route, so the comparison is against the last committed
     * pathname rather than against the address bar. Usually the RSC payload is cached and the
     * whole thing is over well inside `SHOW_DELAY_MS`, which is precisely the case the delay
     * exists to keep off the screen; when it is not cached, a back button is exactly as slow as a
     * link and deserves the same affordance.
     */
    const onPopState = () => {
      if (window.location.pathname !== settled.current) arm();
    };

    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
      if (reveal.current !== null) clearTimeout(reveal.current);
      if (giveUp.current !== null) clearTimeout(giveUp.current);
    };
  }, [arm]);

  /*
   * `aria-busy` on the region that is actually stale.
   *
   * The audit counted `[aria-busy="true"]` on the document and found 0 during every measured
   * transition, and the count was the symptom rather than the disease: while a route is in flight
   * `<main>` is showing the PREVIOUS page's content, and nothing said so. `aria-busy` is the
   * attribute for precisely that — "this is being modified, wait before exposing it" — so it goes
   * on `<main>` and not on the bar, which is decoration, nor on the live region below, where it
   * would suppress the very announcement it is paired with.
   *
   * Set imperatively because `<main>` is rendered by the Server Component root layout and cannot
   * take client state. That is safe here and not in general: `<main>`'s props are static, so React
   * never re-renders the element and never reconciles an attribute it did not itself write. It is
   * removed on cleanup as well as on completion, so unmounting cannot strand it.
   */
  useEffect(() => {
    const main = document.getElementById('main');
    if (main === null) return;
    if (phase === 0) {
      main.removeAttribute('aria-busy');
      return;
    }
    main.setAttribute('aria-busy', 'true');
    return () => main.removeAttribute('aria-busy');
  }, [phase]);

  /*
   * The walk from step to step is driven by the transition ENDING, not by a second set of timers.
   *
   * A duplicated `400` in JavaScript would be the `duration-deliberate` token copied into a place
   * the token layer cannot reach — and under `RM1` the CSS would collapse to 1 ms while the
   * JavaScript kept pacing at 400 ms, so reduced motion would get a bar that jerked between four
   * frozen positions over 1.2 s. Chaining on the event keeps the two in step by construction, at
   * either duration. `misc.ts` makes this explicit: `RM1` collapses to 1 ms and not to 0 exactly
   * so `transitionend` still fires.
   *
   * The updater is functional so a stale closure cannot resurrect a bar that has already been
   * disarmed — at phase 0 a late event is a no-op rather than a jump back to 2.
   */
  const advance = useCallback((event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'transform') return;
    setPhase((current) => (current === 1 ? 2 : current === 2 ? 3 : current));
  }, []);

  return (
    <>
      {/*
       * `fixed`, so it is out of flow and cannot shift a single pixel of the page — the audit's
       * "must not shift layout" is a property of the positioning, not something to verify later.
       *
       * `z-toast` and not `z-app-chrome`: the sticky header IS `z-app-chrome` (measured at 200 in
       * the browser), so sharing the layer would put the bar underneath it. `toast` is the honest
       * name for a transient, global status mark, it clears the drawer's `sheet` layer so the bar
       * still shows for a link tapped inside the mobile nav, and it stays below `skip-link`, which
       * `AX2` requires to be visible over everything.
       *
       * `aria-hidden` because the announcement is the live region below. A `progressbar` role here
       * would publish a value that is elapsed time wearing a percentage's clothes.
       */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-toast h-inset-2xs"
      >
        {/*
         * `origin-left` + `scaleX` — `MO4` allows transform and opacity only, and `MO1` wants the
         * motion to carry a direction: it grows from the edge the reading starts at. Animating
         * `width` would do the same thing on the layout thread and against the rule.
         *
         * No opacity anywhere. At `scale-x-0` the element is zero pixels wide, so idle is already
         * invisible and a second fading channel would only add a way for the two to disagree.
         *
         * `duration-instant` (0 ms) at rest is load-bearing rather than tidy: the same
         * `transition-transform` that carries the bar out would carry it BACK, so on arrival the
         * bar would visibly retract right-to-left across the new page. At rest the property snaps.
         */}
        <div
          onTransitionEnd={advance}
          className={`h-full w-full origin-left bg-brand-solid transition-transform ease-enter ${
            EXTENT[phase]
          } ${phase === 0 ? 'duration-instant' : 'duration-deliberate'}`}
        />
      </div>

      {/*
       * `AX8` — never paint alone. The container is rendered on every page and stays empty, which
       * is what makes it work: a live region has to be in the accessibility tree BEFORE its
       * content changes, or the first change is the mount and nothing is announced.
       *
       * It is filled only from phase 1, so the announcement inherits `SHOW_DELAY_MS` for free and
       * a fast navigation is silent as well as invisible. `polite` and not `assertive`: this is a
       * status, and it must not interrupt the route announcement Next makes on arrival.
       */}
      <div role="status" aria-live="polite" className="sr-only">
        {phase === 0 ? '' : t('web.chrome.navPending')}
      </div>
    </>
  );
}
