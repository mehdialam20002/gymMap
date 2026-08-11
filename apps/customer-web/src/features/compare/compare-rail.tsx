/**
 * `FR-CMP-01` — the compare rail, the design's signature interaction.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A DRAWER WITH NO STATE, NO STORE AND NO HYDRATION
 *
 * The reference builds this as a client component: a `useState` array of selected gyms, a
 * `localStorage` mirror so it survives a reload, and a drawer that animates open. Three copies of
 * one fact, and the two that live in the browser disagree with the URL the moment anybody shares
 * a link.
 *
 * Here the selection IS the URL. Every chip and every "Add to compare" is an `<a href>` that names
 * the next selection, so:
 *
 *   - it works before hydration and with JavaScript switched off;
 *   - the back button removes the last gym, because each change is a history entry;
 *   - a shared link opens with the same four gyms;
 *   - every page that mounts it stays a Server Component, which `FR-SRCH-13` asks for.
 *
 * ┌─ FIVE MOUNTS, AND STILL NOT THE ROOT LAYOUT — ADR-0050 ────────────────────────────────────┐
 * │ `/`, `/search`, `/gyms/[citySlug]`, `/explore/[activitySlug]` and a gym's own page. Those    │
 * │ are the surfaces that render a gym with an "Add to compare" on it, and the rail is the only  │
 * │ thing that reports what those clicks did.                                                    │
 * │                                                                                              │
 * │ It is deliberately NOT in `app/layout.tsx`, which would have been one line instead of five.  │
 * │ A rail on `/how-it-works`, `/legal/privacy` or the checkout review screen is chrome          │
 * │ advertising a feature nobody on those pages asked for, and on checkout it would sit over the │
 * │ one control that matters. Five explicit mounts is the version where adding a sixth is a      │
 * │ decision somebody makes.                                                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ A COST THIS WAS SAID TO HAVE, AND DOES NOT ───────────────────────────────────────────────┐
 * │ The note here used to read "reading `searchParams` opts `/` out of static rendering", and    │
 * │ the commit that added the rail said the same. It is wrong, and it was wrong when written.    │
 * │                                                                                             │
 * │ `app/layout.tsx` calls `headers()` to read the per-response CSP nonce, and `headers()` in a  │
 * │ layout opts the WHOLE APPLICATION out of static rendering. `pnpm build` confirms it: every   │
 * │ route in the manifest is `ƒ (Dynamic)`, including `/how-it-works` and the account pages,     │
 * │ which read no search parameters at all. That has been true since long before this rail.      │
 * │                                                                                             │
 * │ So the rail costs nothing here, and it matters that this is recorded: somebody hunting for   │
 * │ static rendering would otherwise remove a working feature and get none of it back. The nonce │
 * │ is the thing to weigh, and `NFR-SEC-12` has already weighed it.                               │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import Link from 'next/link';

import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import type { GymDetail } from '../discovery/fixtures/catalogue.ts';
import {
  MAX_COMPARE,
  compareKey,
  toCompareParams,
  toggleHref,
  type CompareBase,
} from './compare.ts';

/**
 * The rail's own `id`, and the anchor its remove links point at — ADR-0050 §3.2.
 *
 * ┌─ REMOVING A CHIP MUST NOT DROP THE READER AT THE TOP OF THE PAGE ───────────────────────────┐
 * │ A chip's remove link navigates, and the chip it lived in is then gone. Next resets the       │
 * │ document's focus on a client navigation, so the reader who has just removed the second of    │
 * │ four gyms resumes tabbing from the site header - past the whole page - to reach the third.   │
 * │                                                                                              │
 * │ The fix is the one this repository already uses for its skip link: an anchor at a target     │
 * │ that carries `tabIndex={-1}`, so the browser focuses the element rather than merely scrolling │
 * │ to it. `shell.spec.ts` asserts the same pair on `<main id="main" tabIndex={-1}>` and states  │
 * │ the same reason. Nothing here is client state - it is an `href` and an `id`.                  │
 * │                                                                                              │
 * │ This is NOT the rail stealing focus. §3.2 forbids the bar grabbing focus when a card adds a  │
 * │ gym, which is what makes ticking a third impossible; returning the reader to the control     │
 * │ they just used is the opposite move.                                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const RAIL_ID = 'compare-rail';

/**
 * The link that adds this gym to the comparison, or takes it out again.
 *
 * Exported so the card and the rail cannot drift: both build the next URL through one function,
 * and `MAX_COMPARE` is enforced in `toCompareParams` rather than remembered in two places.
 *
 * `base` is required and no longer defaults to `'/'`. ADR-0050: the toggle keeps the reader on
 * the page they are on, and a default is exactly how the results page came to send them home.
 */
export function railToggleHref(
  selected: readonly GymDetail[],
  gym: GymDetail,
  base: CompareBase,
): string {
  return toggleHref(selected, gym, base);
}

export function CompareRail({
  selected,
  base,
}: {
  readonly selected: readonly GymDetail[];
  /**
   * The page the rail is mounted on, with its filters intact. Required: a rail that guesses its
   * own base is a rail that throws away a search on every chip.
   */
  readonly base: CompareBase;
}) {
  // Nothing chosen, nothing to show. An empty rail parked at the bottom of every visit is a
  // permanent 64px of chrome advertising a feature the reader has not asked for.
  if (selected.length === 0) return null;

  const Close = icon.close;
  const full = selected.length >= MAX_COMPARE;

  /*
   * Where a chip's remove link lands, and it is not the same answer at one gym as at two.
   *
   * Above one, the rail survives the removal, so the anchor names the rail and the reader keeps
   * their place among the chips. At exactly one, removing it unmounts the rail: `#compare-rail`
   * would then name nothing in the new document, the browser leaves focus at the top, and a hash
   * that resolves to no element is also a URL somebody can bookmark and re-open pointing at
   * nowhere. So the last chip falls back to the page's own anchor, which is `#gyms` on the home
   * page and absent everywhere else.
   */
  const afterRemove: CompareBase =
    selected.length > 1 ? { path: base.path, fragment: `#${RAIL_ID}` } : base;

  return (
    /*
     * A labelled region, not a dialog. It does not trap focus, it does not need dismissing, and
     * `role="dialog"` would tell a screen reader to expect both. It sits at the end of the
     * document in reading order, which is also where it sits on screen.
     */
    <aside
      id={RAIL_ID}
      /*
       * Focusable only as an anchor target, never in the tab sequence - see `RAIL_ID` above.
       * `-1` is what makes the browser move focus HERE on a same-page fragment navigation instead
       * of scrolling to it and leaving focus at the top of the document.
       */
      tabIndex={-1}
      className="gm-rail"
      aria-label={t('web.compare.rail.label')}
    >
      <div className="gm-rail-in">
        <p className="gm-rail-count">
          <b>{String(selected.length)}</b>
          <span>{t('web.compare.rail.count').replace('{max}', String(MAX_COMPARE))}</span>
        </p>

        <ul className="gm-rail-set">
          {selected.map((gym) => (
            <li key={compareKey(gym)} className="gm-rail-chip">
              <span className="gm-truncate">{gym.name}</span>
              {/*
               * The accessible name carries the gym, because "Remove" four times over is four
               * identical controls to anybody navigating by link. `aria-label` rather than
               * visible text: the name is already on the chip, and repeating it would read twice.
               */}
              <Link
                href={railToggleHref(selected, gym, afterRemove)}
                aria-label={t('web.compare.rail.remove').replace('{gym}', gym.name)}
                /*
                 * `gm-hit-target` removed. It grows an `::after` outward, and `.gm-rail-set` is a
                 * scroll container (`overflow-x: auto` forces `overflow-y: auto`), which clips at
                 * its padding box - so the 44px this class claimed was 36px in fact. `.gm-rail-x`
                 * now has 44px of its own, and the row has the padding to hold it.
                 */
                className="gm-rail-x"
              >
                <Close aria-hidden="true" className="h-[0.75rem] w-[0.75rem]" />
              </Link>
            </li>
          ))}

          {/*
           * The remaining slots, drawn. It answers "how many more can I add" without a sentence,
           * and it is the reason the rail does not resize as gyms go in - a bar that grows under
           * the reader's thumb is how a fixed control loses its position.
           */}
          {Array.from({ length: MAX_COMPARE - selected.length }, (_, i) => (
            <li key={`slot-${String(i)}`} aria-hidden="true" className="gm-rail-slot" />
          ))}
        </ul>

        <p className="gm-rail-act">
          {/*
           * `gm-hit-target` here and NOT in the footer's link list: this one sits in a horizontal
           * row with a 14px gap to the Compare button, so a 44px target has room to grow into.
           * Stacked 16px links do not, which is why the footer uses real row height instead.
           */}
          <Link href={toCompareParams([], base)} className="gm-hit-target gm-rail-clear">
            {t('web.compare.rail.clear')}
          </Link>
          {/*
           * Enabled from one gym, not two. A comparison of one is a page that shows one column,
           * which is a legitimate thing to arrive at - and a control that refuses without saying
           * why is worse than a page that is briefly thin.
           */}
          <Link
            href={toCompareParams(selected.map(compareKey))}
            className="gm-btn gm-btn-amber gm-btn-sm"
          >
            {t('web.compare.rail.cta')} <i aria-hidden="true">→</i>
          </Link>
        </p>
      </div>

      {full ? (
        <p className="gm-rail-note">
          {t('web.compare.rail.full').replace('{max}', String(MAX_COMPARE))}
        </p>
      ) : null}
    </aside>
  );
}
