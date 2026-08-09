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
    <div className="mx-auto max-w-container px-inset-md py-region-sm">
      <p className="rounded-card border border-warning bg-surface-warning-subtle px-inset-md py-inset-sm text-base text-content-warning">
        {t('web.account.demoNotice')}
      </p>

      <header className="mt-stack-lg flex flex-wrap items-baseline justify-between gap-inline-md">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-content">{t(title)}</h1>
          <p className="mt-stack-2xs text-base text-content-secondary">
            {DEMO_MEMBER.name} · {t('web.account.memberSince')}{' '}
            <time dateTime={machineDate(DEMO_MEMBER.memberSince)}>
              {formatDate(DEMO_MEMBER.memberSince)}
            </time>
          </p>
        </div>
      </header>

      {/* `BP2` — five entries wrap awkwardly on a phone, so the row scrolls inside itself. */}
      <nav aria-label={t('web.account.nav.label')} className="mt-stack-lg">
        <ul className="gm-scroll-row -mx-inset-md flex gap-inline-xs overflow-x-auto border-b border-subtle px-inset-md pb-inset-sm sm:mx-0 sm:px-0">
          {ACCOUNT_NAV.map((item) => {
            const active = item.href === current;
            return (
              <li key={item.href} className="shrink-0">
                {active ? (
                  /* The current screen is marked and NOT a link — a nav item that navigates to
                     the page you are on is a control that does nothing. */
                  <span
                    aria-current="page"
                    className="gm-hit-target block rounded-control bg-surface-brand-subtle px-inset-sm py-inset-2xs text-base font-semibold text-content-brand"
                  >
                    {t(item.label)}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="gm-hit-target block rounded-control px-inset-sm py-inset-2xs text-base text-content-secondary transition-colors duration-fast ease-standard hover:bg-surface-sunken hover:text-content"
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

const STATUS_TONE = {
  ACTIVE: 'bg-surface-success-subtle text-content-success',
  PENDING: 'bg-surface-info-subtle text-content-info',
  EXPIRED: 'bg-surface-sunken text-content-secondary',
  CANCELLED: 'bg-surface-sunken text-content-secondary',
} as const;
