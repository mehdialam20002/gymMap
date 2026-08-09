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
 *   - the homepage stays a Server Component, which `FR-SRCH-13` asks for.
 *
 * The cost is honest and worth naming: reading `searchParams` opts `/` out of static rendering.
 * The HTML is still produced on the server, so nothing about crawling or SEO changes - what is
 * lost is the full-page cache, which for a page whose catalogue is a fixture is not yet a cost at
 * all, and which a `revalidate` on the data layer will answer when it is.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import Link from 'next/link';

import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import type { GymDetail } from '../discovery/fixtures/catalogue.ts';
import { MAX_COMPARE, compareKey, toCompareParams, toggleHref } from './compare.ts';

/** Where the rail's own links point back to. The fragment keeps the reader on the gym row. */
export const RAIL_BASE = '/';
export const RAIL_FRAGMENT = '#gyms';

/**
 * The link that adds this gym to the comparison, or takes it out again.
 *
 * Exported so the card and the rail cannot drift: both build the next URL through one function,
 * and `MAX_COMPARE` is enforced in `toCompareParams` rather than remembered in two places.
 */
export function railToggleHref(selected: readonly GymDetail[], gym: GymDetail): string {
  return toggleHref(selected, gym, RAIL_BASE, RAIL_FRAGMENT);
}

export function CompareRail({ selected }: { readonly selected: readonly GymDetail[] }) {
  // Nothing chosen, nothing to show. An empty rail parked at the bottom of every visit is a
  // permanent 64px of chrome advertising a feature the reader has not asked for.
  if (selected.length === 0) return null;

  const Close = icon.close;
  const full = selected.length >= MAX_COMPARE;

  return (
    /*
     * A labelled region, not a dialog. It does not trap focus, it does not need dismissing, and
     * `role="dialog"` would tell a screen reader to expect both. It sits at the end of the
     * document in reading order, which is also where it sits on screen.
     */
    <aside className="gm-rail" aria-label={t('web.compare.rail.label')}>
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
                href={railToggleHref(selected, gym)}
                aria-label={t('web.compare.rail.remove').replace('{gym}', gym.name)}
                className="gm-hit-target gm-rail-x"
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
          <Link
            href={toCompareParams([], RAIL_BASE, RAIL_FRAGMENT)}
            className="gm-hit-target gm-rail-clear"
          >
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
