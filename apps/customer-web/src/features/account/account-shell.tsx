/**
 * The account area's chrome — one demo notice, one sub-navigation, one heading rhythm.
 *
 * ┌─ THE DEMO NOTICE IS ON EVERY SCREEN, NOT JUST THE FIRST ────────────────────────────────────┐
 * │ A member can land on `/account/orders` from a link and never see `/account`. A caveat shown  │
 * │ once, on a page they did not visit, is a caveat that was not shown — and the records here    │
 * │ are receipts and memberships, which are exactly what somebody would screenshot.               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Link from 'next/link';

import type { MessageKey } from '../../shared/i18n/index.ts';
import { t } from '../../shared/i18n/index.ts';
import { DEMO_MEMBER } from './fixtures/member.ts';
import { formatDate, machineDate } from './format.ts';

const ACCOUNT_NAV = [
  { href: '/account', label: 'web.account.nav.overview' },
  { href: '/account/memberships', label: 'web.account.nav.memberships' },
  { href: '/account/attendance', label: 'web.account.nav.attendance' },
  { href: '/account/orders', label: 'web.account.nav.orders' },
  { href: '/account/reviews', label: 'web.account.nav.reviews' },
] as const satisfies readonly { href: string; label: MessageKey }[];

export function AccountShell({
  current,
  title,
  children,
}: {
  /** The href of the screen being rendered, so its nav entry is marked and not linked. */
  readonly current: string;
  readonly title: MessageKey;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="gm-wrap gm-sec gm-sec-tight">
      <p className="max-w-prose rounded-card border border-warning bg-surface-warning-subtle px-inset-md py-inset-sm text-base text-content-warning">
        {t('web.account.demoNotice')}
      </p>

      <header className="mt-stack-lg flex flex-wrap items-baseline justify-between gap-inline-md">
        <div>
          <h1 className="gm-h2">{t(title)}</h1>
          <p className="mt-stack-2xs text-base text-content-secondary">
            {DEMO_MEMBER.name} · {t('web.account.memberSince')}{' '}
            <time dateTime={machineDate(DEMO_MEMBER.memberSince)}>
              {formatDate(DEMO_MEMBER.memberSince)}
            </time>
          </p>
        </div>
      </header>

      {/*
       * ┌─ IT WRAPS NOW, AND SCROLLING IT SIDEWAYS WAS THE WRONG CALL ────────────────────────────┐
       * │ The note here used to read "five entries wrap awkwardly on a phone, so the row scrolls   │
       * │ inside itself". Measured, the scrolling version was worse than awkward: `scrollLeft`     │
       * │ stayed 0 on every load, so on `/account/reviews` the tab for the page you are ON sat     │
       * │ 170px past the right edge at 320 - 130 at 360, 100 at 390, 76 at 414 - and on            │
       * │ `/account/orders`, 90px. With `scrollbar-width: none` and no gradient, nothing on screen │
       * │ said the row continued. Bringing it into view needs a client component and an effect,    │
       * │ for five links whose labels are one word each.                                           │
       * │                                                                                          │
       * │ Wrapping to two lines at 320 costs one line of vertical space and removes the entire     │
       * │ class of problem: nothing is hidden, nothing needs an affordance, nothing needs JS, and  │
       * │ the clipped-pseudo trap below stops applying because the box is no longer a scroller.    │
       * └──────────────────────────────────────────────────────────────────────────────────────────┘
       *
       * ┌─ `gm-hit-target` REPORTED 44px AND DELIVERED 34 ────────────────────────────────────────┐
       * │ `gm-hit-target` reaches 44px by growing an `::after` outward, and a pseudo-element is    │
       * │ the last child of its own box: it cannot escape an ancestor's clip. This `<ul>` is       │
       * │ `overflow-x: auto`, and `overflow-x` on one axis forces `overflow-y` to compute to       │
       * │ `auto` on the other - so the row is a scroll container that clips at its PADDING box,    │
       * │ and the ul had bottom padding only. A 0.5px binary sweep put the real reachable band at  │
       * │ 34.0px.                                                                                  │
       * │                                                                                          │
       * │ This is the FOURTH time this exact trap has been found in this codebase, and the class   │
       * │ silently reported itself satisfied every time. So the height is real here: `min-h` on    │
       * │ the control itself, which no ancestor can clip away and no measurement can be wrong      │
       * │ about. `gm-hit-target` is dropped rather than kept alongside it - two mechanisms for one │
       * │ requirement is how the wrong one goes unnoticed.                                         │
       * └──────────────────────────────────────────────────────────────────────────────────────────┘
       */}
      <nav aria-label={t('web.account.nav.label')} className="mt-stack-lg">
        <ul className="flex flex-wrap gap-inline-xs border-b border-subtle">
          {ACCOUNT_NAV.map((item) => {
            const active = item.href === current;
            return (
              <li key={item.href} className="shrink-0">
                {active ? (
                  /* The current screen is marked and NOT a link — a nav item that navigates to
                     the page you are on is a control that does nothing. */
                  <span
                    aria-current="page"
                    className="gm-pick-on flex min-h-[2.75rem] items-center rounded-control px-inset-sm text-base font-semibold"
                  >
                    {t(item.label)}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="flex min-h-[2.75rem] items-center rounded-control px-inset-sm text-base text-content-secondary transition-colors duration-fast ease-standard hover:bg-surface-sunken hover:text-content"
                  >
                    {t(item.label)}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-stack-xl">{children}</div>
    </div>
  );
}

/**
 * A membership's state, said in words and never in colour alone (`AX8`).
 *
 * `PENDING` gets the longest sentence, because it is the state that exists only because
 * activation is webhook-driven — and the one a member will otherwise read as "something broke".
 */
export function StatusBadge({ status }: { readonly status: keyof typeof STATUS_TONE }) {
  return (
    <span
      className={`inline-block rounded-control px-inset-xs py-inset-2xs text-xs font-medium ${STATUS_TONE[status]}`}
    >
      {t(`web.account.status.${status}` as MessageKey)}
    </span>
  );
}

/*
 * The success role STAYS here, and that is a distinction rather than an oversight.
 *
 * The identity pass moved several green pills to amber - the "Verified" badge, the compare
 * table's marked cell - because those are FACTS the page computed, and `success` means "the thing
 * you did worked". A membership that is ACTIVE and an order that is PAID are exactly that. Green
 * is right in both, and the next person tidying green pills should stop at these two.
 */
const STATUS_TONE = {
  ACTIVE: 'bg-surface-success-subtle text-content-success',
  PENDING: 'bg-surface-info-subtle text-content-info',
  EXPIRED: 'bg-surface-sunken text-content-secondary',
  CANCELLED: 'bg-surface-sunken text-content-secondary',
} as const;
