/**
 * `SCR-WEB-004` — the compare screen: what is being compared, what went wrong, and what can be
 * added. `FR-CMP-01` … `FR-CMP-04`.
 *
 * A Server Component with no client state anywhere. The picker is a real GET `<form>` whose
 * checkboxes are named `gym`, so submitting it produces exactly the URL `parseCompare` reads —
 * no handler, no store, and it works before hydration.
 */

import Link from 'next/link';

import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { formatMinor } from '../discovery/search.ts';
import { FixtureNotice } from '../discovery/search-results.tsx';
import { addableGyms, compareKey, MAX_COMPARE, type CompareSelection } from './compare.ts';
import { CompareTable } from './compare-table.tsx';
/*
 * Same two bands the hub pages take, for the same reason and from the same place. See the note in
 * `landing-views.tsx`: they are the site's trust spine and its call to action, not home-page
 * decoration, and a second copy of the four rules is a second place for them to drift.
 */
import { ClosingBand, Promises } from '../home/chalk.tsx';

export function ComparePage({ selection }: { readonly selection: CompareSelection }) {
  const { gyms, unresolved, truncated } = selection;
  const full = gyms.length >= MAX_COMPARE;

  return (
    /*
     * ┌─ THE EMPTY STATE IS THE ONE A SHARED LINK USUALLY ARRIVES AT ──────────────────────────────┐
     * │ Measured at 1,370px against the home page's 11,251 - a heading, a sentence, a picker and    │
     * │ the footer. It is not a dead end: the picker is right there and every gym is one tap away.  │
     * │ It just read as a page that had not finished loading, and this is the page a member reaches │
     * │ from a link somebody sent them, before they have decided anything.                          │
     * │                                                                                             │
     * │ It gets the same spine the two hubs got - the four rules, then the call to action - and     │
     * │ nothing invented for it. The comparison itself, when there is one, still leads.             │
     * └─────────────────────────────────────────────────────────────────────────────────────────────┘
     */
    <>
      <div className="gm-wrap gm-sec gm-sec-tight">
        <FixtureNotice />

        <h1 className="gm-h2">{t('web.compare.title')}</h1>

        {/*
         * Both notices are `role="status"`, not `alert`. Nothing here is urgent and nothing is the
         * member's fault — a delisted gym in a shared link is the platform's news to deliver
         * politely, and an alert interrupts whatever a screen reader was reading to deliver it.
         */}
        {unresolved.length > 0 && (
          <p
            role="status"
            className="mt-stack-md max-w-prose rounded-card border border-warning bg-surface-warning-subtle px-inset-md py-inset-sm text-base text-content-warning"
          >
            {/*
             * Capped at four, because the rest of this string is attacker-supplied.
             *
             * `unresolved` is whatever did not match, straight from the query string, and a link with
             * forty `gym=` parameters put forty of them into a warning panel. React escapes the text,
             * so this is not an injection - it is the panel becoming a mirror for anything a sender
             * chooses to put in a link they share. Four names the problem; a tally covers the rest.
             */}
            {t('web.compare.unresolved').replace(
              '{keys}',
              unresolved.length <= 4
                ? unresolved.join(', ')
                : `${unresolved.slice(0, 4).join(', ')} ${t('web.compare.unresolvedMore').replace(
                    '{count}',
                    String(unresolved.length - 4),
                  )}`,
            )}
          </p>
        )}
        {truncated && (
          <p
            role="status"
            className="mt-stack-md max-w-prose rounded-card border border-info bg-surface-info-subtle px-inset-md py-inset-sm text-base text-content-info"
          >
            {t('web.compare.truncated')}
          </p>
        )}

        {gyms.length === 0 ? (
          <div className="mt-stack-lg max-w-prose">
            <h2 className="text-lg font-semibold text-content">{t('web.compare.empty.title')}</h2>
            <p className="mt-stack-2xs text-base text-content-secondary">
              {t('web.compare.empty.body')}
            </p>
          </div>
        ) : (
          <CompareTable gyms={gyms} />
        )}

        <Picker selection={selection} full={full} />

        <p className="mt-stack-lg">
          <Link href="/search" className="gm-card-add text-base font-semibold">
            {t('web.search.heading.any')}
          </Link>
        </p>
      </div>

      <Promises />
      <ClosingBand />
    </>
  );
}

/**
 * A GET form of checkboxes, pre-ticked with what is already being compared.
 *
 * The alternative — one "add" link per gym, each carrying the whole current set — works and
 * produces a page of eight nearly identical URLs that differ by one parameter. A crawler indexes
 * all of them. A form submits once, to one URL, and a member can add three gyms in three taps
 * instead of three page loads.
 */
function Picker({
  selection,
  full,
}: {
  readonly selection: CompareSelection;
  readonly full: boolean;
}) {
  const chosen = new Set(selection.gyms.map(compareKey));
  const rest = addableGyms(selection.gyms);
  const Place = icon.place;

  return (
    <section className="mt-region-sm border-t border-subtle pt-stack-xl">
      <h2 className="gm-h2">{t('web.compare.pick.title')}</h2>

      {full && (
        <p className="mt-stack-xs max-w-prose text-base text-content-secondary">
          {t('web.compare.pick.full')}
        </p>
      )}

      <form action="/compare" method="get" className="mt-stack-md">
        {/*
         * The already-chosen gyms ride along as ticked boxes rather than hidden fields, so the
         * form is also how a gym is REMOVED. One control, both directions — and unticking is the
         * gesture a member already expects from a list of checkboxes.
         */}
        <ul className="grid gap-stack-xs sm:grid-cols-2 lg:grid-cols-3">
          {[...selection.gyms, ...rest].map((gym) => {
            const key = compareKey(gym);
            const isChosen = chosen.has(key);
            return (
              <li key={gym.id}>
                <label className="gm-card gm-hit-target flex cursor-pointer items-start gap-inline-sm rounded-card p-inset-md has-[:checked]:border-brand has-[:checked]:gm-glyph-ring">
                  <input
                    type="checkbox"
                    name="gym"
                    value={key}
                    defaultChecked={isChosen}
                    // Not `disabled` when the set is full: a disabled checkbox cannot be
                    // submitted, so the browser would silently drop it and the "four is the
                    // limit" sentence above would be the only sign anything happened. The parser
                    // caps the set and the page says it did.
                    className="mt-px h-[1.125rem] w-[1.125rem] shrink-0 accent-[var(--gm-color-brand-solid)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-base font-medium text-content">{gym.name}</span>
                    <span className="mt-stack-2xs flex items-center gap-inline-2xs text-sm text-content-secondary">
                      <Place aria-hidden="true" className="h-[0.875rem] w-[0.875rem] shrink-0" />
                      {gym.locality}, {gym.city}
                    </span>
                    <span className="mt-stack-2xs block text-sm tabular-nums text-content-muted">
                      {formatMinor(gym.fromPriceMinor)} ·{' '}
                      {t('web.gym.distanceFromCentre').replace('{km}', gym.distanceKm.toFixed(1))}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <button
          type="submit"
          data-on-solid="true"
          className="gm-hit-target mt-stack-lg rounded-control bg-brand-solid px-inset-lg py-inset-sm text-md font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover"
        >
          {t('web.compare.pick.action')}
        </button>
      </form>
    </section>
  );
}
