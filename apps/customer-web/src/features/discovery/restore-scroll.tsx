'use client';

/**
 * Back returns you to your place in the results — `FR-SRCH-13`, `NFR-USE-05`.
 *
 * ┌─ WHAT WAS MEASURED, AND WHY THE OBVIOUS READING IS WRONG ───────────────────────────────────┐
 * │ On `/search?city=bengaluru` at 1440x900: scrolled to 1,276, clicked the first card, pressed  │
 * │ Back. `scrollY` came back as 379, and stayed 379 at 200ms, 600ms, 1.5s and 3s. From 2,600 -  │
 * │ also 379. From 600 - correctly 600.                                                          │
 * │                                                                                              │
 * │ 379 is not arbitrary and it is not a clamp to the document: the document is 2,176px both     │
 * │ before and after. 379 is the height of everything ABOVE the results grid - the notice band,  │
 * │ the eyebrow, the heading, the count, the search field. In other words, at the moment the     │
 * │ browser restored, the results list was not there.                                            │
 * │                                                                                              │
 * │ That is `app/search/loading.tsx` doing its job. The segment has a Suspense boundary, so a    │
 * │ back navigation re-suspends it, and the browser restores scroll against the fallback. The    │
 * │ fallback is shorter than eight cards, the position is clamped to what exists, and the real   │
 * │ content then grows the page underneath a reader who is now near the top.                     │
 * │                                                                                              │
 * │ So the two things are in genuine tension, and BOTH are worth keeping: the boundary is what   │
 * │ covers the 381ms (4x CPU) / 1,005ms (6x) forward transition into this route, and it is the   │
 * │ only legally placed one on the site (`soft-404.spec.ts` pins that `/search` never calls      │
 * │ `notFound()`, which is what makes a boundary safe here and unsafe on the gym-detail chain).  │
 * │ Deleting it to fix Back would trade a defect for a defect.                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY THIS IS A CLIENT COMPONENT, AND WHY IT IS THE SMALLEST ONE POSSIBLE ───────────────────┐
 * │ `history.scrollRestoration` has exactly two settings and neither is "wait for the content".  │
 * │ `auto` is what produced the 379. `manual` means nothing restores unless something restores   │
 * │ it. There is no declarative third option, and no approved dependency does this - so the      │
 * │ smallest honest amount of JavaScript is a component that remembers a number and puts it back │
 * │ once the page is tall enough to hold it.                                                     │
 * │                                                                                              │
 * │ It renders NOTHING. It is mounted by `/search` alone rather than by the root layout, because │
 * │ every other route on this site restores correctly today and a page that scrolls itself is a  │
 * │ page that can scroll itself WRONG.                                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { useEffect } from 'react';

/** One key per address. Two visits to the same query share a position, which is the right answer. */
const keyFor = () => `gm-scroll:${location.pathname}${location.search}`;

/**
 * How long to keep waiting for the results to commit before giving up.
 *
 * Measured: the content is present within ~120ms unthrottled and ~1,005ms at 6x CPU with a
 * 400ms round trip. 2,000ms covers that with room and then stops - a restore that lands after
 * the reader has started scrolling themselves is worse than no restore at all, which is why this
 * also aborts the moment it sees a scroll it did not cause.
 */
const GIVE_UP_AFTER_MS = 2_000;

export function RestoreScroll() {
  useEffect(() => {
    /*
     * `manual`, and the previous value is put back on unmount. Leaving the browser on `manual`
     * after leaving `/search` would silently disable restoration for every other route, which is
     * a much larger defect than the one being fixed here.
     */
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';

    /*
     * ┌─ READ THE TARGET FIRST, AND DO NOT LET THE BROWSER'S OWN RESTORE ERASE IT ───────────────┐
     * │ The first version of this attached the scroll listener and then read the saved position,  │
     * │ and it restored nothing: measured, Back still landed at 379 from 1,276.                   │
     * │                                                                                          │
     * │ `scrollRestoration = 'manual'` is set in an effect, so it is set on the OUTGOING page and │
     * │ put back to `auto` when this unmounts. By the time the component mounts again on Back the │
     * │ browser has already done its own restore - to 379, against the skeleton - and that motion │
     * │ fires a `scroll` event. The listener then wrote 379 over the 1,276 it was supposed to be  │
     * │ putting back. The component was faithfully remembering the wrong number, very fast.       │
     * │                                                                                          │
     * │ So the target is read into a local before anything can listen, and nothing is written     │
     * │ until the restore has either happened or been abandoned.                                  │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    const target = Number(sessionStorage.getItem(keyFor()) ?? '');
    let writable = false;

    /*
     * ┌─ THE WRITE IS DEBOUNCED, AND THE DELAY IS THE FIX RATHER THAN A TUNING ──────────────────┐
     * │ This was a `requestAnimationFrame`, which flushes in about 16ms, and the position was     │
     * │ still lost. Instrumented: `sessionStorage` held the correct 1,276 while the reader was on │
     * │ `/search`, and read 379 by the time the gym page had rendered. The overwrite happened on   │
     * │ the way OUT - tearing down this route scrolls the document, that fires a `scroll`, and a   │
     * │ 16ms write landed before React ran the cleanup that would have stopped it. The component   │
     * │ was recording the act of leaving.                                                          │
     * │                                                                                           │
     * │ A 120ms debounce cannot outrun an unmount: the pending write is cancelled below, so a      │
     * │ teardown scroll never reaches storage. What it costs is up to 120ms of the reader's last   │
     * │ scroll before they clicked, which is a few pixels of a position that only has to be close. │
     * └───────────────────────────────────────────────────────────────────────────────────────────┘
     */
    let pending = 0;
    const remember = () => {
      if (!writable) return;
      clearTimeout(pending);
      pending = window.setTimeout(() => {
        sessionStorage.setItem(keyFor(), String(Math.round(scrollY)));
      }, 120);
    };
    addEventListener('scroll', remember, { passive: true });

    /*
     * The restore itself. Not `scrollTo` on the next tick - that is the same race the browser
     * just lost. It polls the document's own height until the saved position is reachable, which
     * is the only condition that actually matters, and stops at the first sign the reader has
     * taken over.
     */
    const restore = (saved: number) => {
      if (!Number.isFinite(saved) || saved <= 0) {
        writable = true;
        return;
      }
      const startedAt = performance.now();
      let lastSetByUs = Math.round(scrollY);
      const step = () => {
        /*
         * The reader moved first. Their scroll wins; ours would be a hijack, and `SC 2.2.2` is
         * about content that moves under somebody who did not ask it to.
         */
        if (Math.abs(Math.round(scrollY) - lastSetByUs) > 2) {
          writable = true;
          return;
        }
        if (document.documentElement.scrollHeight - innerHeight >= saved) {
          scrollTo(0, saved);
          lastSetByUs = saved;
          writable = true;
          return;
        }
        if (performance.now() - startedAt < GIVE_UP_AFTER_MS) {
          requestAnimationFrame(step);
          return;
        }
        // The content never grew enough. Stop, and start remembering again from wherever we are.
        writable = true;
      };
      requestAnimationFrame(step);
    };

    /*
     * `popstate` is Back and Forward and nothing else. A forward navigation into `/search` must
     * still land at the top, and Next's own router handles that - this listener never sees it.
     */
    const onPop = () => {
      writable = false;
      restore(Number(sessionStorage.getItem(keyFor()) ?? ''));
    };
    addEventListener('popstate', onPop);

    /*
     * And once on mount with the value read BEFORE any listener could overwrite it, because a
     * client transition into this route commits before this component mounts - so on Back,
     * `popstate` has already fired and this is the only chance to act on it.
     */
    restore(target);

    return () => {
      removeEventListener('scroll', remember);
      removeEventListener('popstate', onPop);
      // Cancelling the pending write is what stops a teardown scroll from becoming the position.
      clearTimeout(pending);
      history.scrollRestoration = previous;
    };
  }, []);

  return null;
}
