/**
 * The account screens — memberships, check-in, attendance, receipts, reviews.
 *
 * All Server Components. Nothing here holds state, because nothing here is a decision: the
 * account area REPORTS what the server knows. The one screen that will need a client island is
 * the QR, whose token refreshes every sixty seconds — and it needs the server to issue that
 * token first, which is exactly why the panel below is empty rather than faked.
 */

import Link from 'next/link';

import type { MessageKey } from '../../shared/i18n/index.ts';
import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { formatMinorExact } from '../discovery/search.ts';
import { AccountShell, StatusBadge } from './account-shell.tsx';
import { formatDate, formatDateTime, machineDate } from './format.ts';
import {
  DEMO_MEMBER,
  activeMembership,
  findMembership,
  reviewableGyms,
  type Membership,
} from './fixtures/member.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Overview
// ─────────────────────────────────────────────────────────────────────────────

export function AccountOverview() {
  const active = activeMembership(DEMO_MEMBER);
  const recent = DEMO_MEMBER.visits.slice(0, 3);

  return (
    <AccountShell current="/account" title="web.account.title">
      <section>
        <h2 className="text-xl font-semibold text-content">{t('web.account.overview.active')}</h2>

        {active === null ? (
          <div className="mt-stack-md rounded-card border border-subtle bg-surface-sunken p-inset-lg">
            <p className="max-w-prose text-base text-content-secondary">
              {t('web.account.overview.none')}
            </p>
            <Link
              href="/search"
              className="gm-hit-target mt-stack-md inline-block text-base font-medium text-content-link hover:underline"
            >
              {t('web.account.overview.findGym')}
            </Link>
          </div>
        ) : (
          <div className="mt-stack-md">
            <MembershipCard membership={active} />
          </div>
        )}
      </section>

      <section className="mt-stack-xl">
        <div className="flex flex-wrap items-baseline justify-between gap-inline-md">
          <h2 className="text-xl font-semibold text-content">
            {t('web.account.overview.recentVisits')}
          </h2>
          <Link
            href="/account/attendance"
            className="text-base font-medium text-content-link hover:underline"
          >
            {t('web.account.nav.attendance')}
          </Link>
        </div>
        <VisitList visits={recent} />
      </section>
    </AccountShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Memberships
// ─────────────────────────────────────────────────────────────────────────────

export function Memberships() {
  return (
    <AccountShell current="/account/memberships" title="web.account.memberships.title">
      <ul className="grid gap-stack-md xl:grid-cols-2">
        {DEMO_MEMBER.memberships.map((membership) => (
          <li key={membership.id}>
            <MembershipCard membership={membership} />
          </li>
        ))}
      </ul>
    </AccountShell>
  );
}

function MembershipCard({ membership }: { readonly membership: Membership }) {
  const Place = icon.place;

  return (
    <article className="rounded-card border border-subtle bg-surface-raised p-inset-lg shadow-xs dark:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-inline-md">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-content">
            <Link
              href={`/gyms/${membership.gymCitySlug}/${membership.gymSlug}`}
              className="rounded-control hover:underline"
            >
              {membership.gymName}
            </Link>
          </h3>
          <p className="mt-stack-2xs flex items-center gap-inline-2xs text-sm text-content-secondary">
            <Place aria-hidden="true" className="h-[1rem] w-[1rem] shrink-0" />
            {membership.gymLocality}
          </p>
        </div>
        <StatusBadge status={membership.status} />
      </div>

      <dl className="mt-stack-md grid gap-stack-xs sm:grid-cols-2">
        <div>
          <dt className="text-sm text-content-muted">{t('web.account.memberships.plan')}</dt>
          <dd className="mt-stack-2xs text-base font-medium text-content">{membership.planName}</dd>
        </div>
        <div>
          <dt className="text-sm text-content-muted">{t('web.account.memberships.validity')}</dt>
          <dd className="mt-stack-2xs text-base font-medium text-content">
            <time dateTime={machineDate(membership.startsOn)}>
              {formatDate(membership.startsOn)}
            </time>{' '}
            {t('web.account.memberships.to')}{' '}
            <time dateTime={machineDate(membership.endsOn)}>{formatDate(membership.endsOn)}</time>
          </dd>
        </div>
      </dl>

      {/*
       * The state's own sentence. `PENDING` is not an error and must not read like one — it is
       * the correct behaviour of a system whose activation comes from the payment provider.
       */}
      {membership.status === 'PENDING' && (
        <p className="mt-stack-md rounded-card bg-surface-info-subtle p-inset-md text-sm text-content-info">
          {t('web.account.status.pendingNote')}
        </p>
      )}
      {membership.status === 'EXPIRED' && (
        <p className="mt-stack-md text-sm text-content-secondary">
          {t('web.account.status.expiredNote')}
        </p>
      )}

      <p className="mt-stack-md text-sm tabular-nums text-content-muted">
        {String(membership.visitCount)} {t('web.account.memberships.visits')}
      </p>

      <Link
        href={`/account/memberships/${membership.id}`}
        data-on-solid={membership.status === 'ACTIVE' ? 'true' : undefined}
        className={`gm-hit-target mt-stack-lg inline-block rounded-control px-inset-lg py-inset-sm text-base font-semibold transition-colors duration-fast ease-standard ${
          membership.status === 'ACTIVE'
            ? 'bg-brand-solid text-content-on-brand hover:bg-brand-solid-hover'
            : 'border border-subtle text-content-secondary hover:border-strong hover:text-content'
        }`}
      >
        {t('web.account.overview.checkIn')}
      </Link>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The check-in credential
// ─────────────────────────────────────────────────────────────────────────────

export function CheckInScreen({ membershipId }: { readonly membershipId: string }) {
  const membership = findMembership(DEMO_MEMBER, membershipId);

  return (
    <AccountShell current="/account/memberships" title="web.account.qr.title">
      {membership === null ? (
        <p className="max-w-prose text-base text-content-secondary">
          {t('web.checkout.notFound.body')}
        </p>
      ) : (
        <div className="grid gap-inline-xl lg:grid-cols-[24rem_minmax(0,1fr)]">
          <div className="rounded-card border border-subtle bg-surface-raised p-inset-lg text-center">
            {/*
             * ┌─ THE PANEL IS EMPTY, AND THAT IS THE FEATURE ───────────────────────────────────┐
             * │ `FR-CHK-02` / `BR-CHK-02`: the token is SERVER-SIGNED and expires in 60 seconds. │
             * │ A page cannot mint one, so any code drawn here would encode nothing and fail at  │
             * │ the desk — a demo QR is worse than no QR, because somebody would try it.          │
             * │                                                                                  │
             * │ The 60-second life is also what makes a screenshot worthless, which is the whole │
             * │ reason the credential rotates. Saying so is more useful to a reader of this      │
             * │ screen than a square of noise would be.                                           │
             * └──────────────────────────────────────────────────────────────────────────────────┘
             */}
            <div className="mx-auto flex aspect-square w-full max-w-[16rem] items-center justify-center rounded-card border border-dashed border-strong bg-surface-sunken p-inset-lg">
              <p className="text-sm text-content-muted">{t('web.account.qr.placeholder')}</p>
            </div>

            <p className="mt-stack-md text-base font-semibold text-content">{membership.gymName}</p>
            <div className="mt-stack-2xs">
              <StatusBadge status={membership.status} />
            </div>
          </div>

          <div className="min-w-0">
            <p className="max-w-prose text-base text-content-secondary">
              {membership.status === 'ACTIVE'
                ? t('web.account.qr.howTo')
                : membership.status === 'PENDING'
                  ? t('web.account.qr.pending')
                  : t('web.account.qr.expired')}
            </p>

            <p className="mt-stack-lg max-w-prose rounded-card bg-surface-sunken p-inset-md text-sm text-content-secondary">
              {t('web.account.qr.serverIssued')}
            </p>

            <Link
              href="/account/attendance"
              className="gm-hit-target mt-stack-lg inline-block text-base font-medium text-content-link hover:underline"
            >
              {t('web.account.nav.attendance')}
            </Link>
          </div>
        </div>
      )}
    </AccountShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Attendance
// ─────────────────────────────────────────────────────────────────────────────

export function Attendance() {
  return (
    <AccountShell current="/account/attendance" title="web.account.attendance.title">
      <p className="text-base tabular-nums text-content-secondary">
        {String(DEMO_MEMBER.visits.length)} {t('web.account.attendance.count')}
      </p>
      <VisitList visits={DEMO_MEMBER.visits} />
    </AccountShell>
  );
}

function VisitList({
  visits,
}: {
  readonly visits: readonly { id: string; gymName: string; checkedInAt: string }[];
}) {
  if (visits.length === 0) {
    return (
      <p className="mt-stack-md max-w-prose text-base text-content-secondary">
        {t('web.account.attendance.none')}
      </p>
    );
  }

  return (
    <ul className="mt-stack-md flex flex-col">
      {visits.map((visit) => (
        <li
          key={visit.id}
          className="flex flex-wrap items-baseline justify-between gap-inline-md border-b border-subtle py-inset-sm"
        >
          <span className="text-base font-medium text-content">{visit.gymName}</span>
          {/*
           * `Asia/Kolkata`, named explicitly in `format.ts`. A 05:12 IST check-in is 23:42 the
           * previous day in UTC, and gyms in this market open at 05:00 — so a formatter that
           * uses the process's zone reports every early visit on the wrong date.
           */}
          <time
            dateTime={machineDate(visit.checkedInAt)}
            className="text-sm tabular-nums text-content-secondary"
          >
            {formatDateTime(visit.checkedInAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipts
// ─────────────────────────────────────────────────────────────────────────────

export function Orders() {
  return (
    <AccountShell current="/account/orders" title="web.account.orders.title">
      <p className="max-w-prose text-sm text-content-muted">{t('web.account.orders.persisted')}</p>

      {DEMO_MEMBER.orders.length === 0 ? (
        <p className="mt-stack-md text-base text-content-secondary">
          {t('web.account.orders.none')}
        </p>
      ) : (
        <ul className="mt-stack-lg flex flex-col gap-stack-lg">
          {DEMO_MEMBER.orders.map((order) => (
            <li
              key={order.id}
              className="rounded-card border border-subtle bg-surface-raised p-inset-lg"
            >
              <div className="flex flex-wrap items-start justify-between gap-inline-md">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-content">{order.gymName}</h2>
                  <p className="mt-stack-2xs text-base text-content-secondary">{order.planName}</p>
                  <p className="mt-stack-2xs text-sm text-content-muted">
                    {t('web.account.orders.reference')} {order.reference} ·{' '}
                    {t('web.account.orders.placed')}{' '}
                    <time dateTime={machineDate(order.placedAt)}>{formatDate(order.placedAt)}</time>
                  </p>
                </div>
                <span
                  className={`inline-block rounded-control px-inset-xs py-inset-2xs text-xs font-medium ${
                    order.status === 'PAID'
                      ? 'bg-surface-success-subtle text-content-success'
                      : 'bg-surface-info-subtle text-content-info'
                  }`}
                >
                  {t(`web.account.orders.status.${order.status}` as MessageKey)}
                </span>
              </div>

              {/*
               * Rendered from the order's OWN stored figures. `§A6.3`: a figure on a statement is
               * never recomputed at display time — a receipt that re-quotes changes when the tax
               * rate does, for a purchase made under the old one.
               */}
              <dl className="mt-stack-md max-w-form text-base">
                <ReceiptLine
                  term={t('web.account.orders.subtotal')}
                  value={formatMinorExact(order.netMinor)}
                />
                {order.taxLines.map((line) => (
                  <ReceiptLine
                    key={line.label}
                    term={line.label}
                    value={formatMinorExact(line.amountMinor)}
                  />
                ))}
                <div className="mt-stack-xs flex items-baseline justify-between gap-inline-md border-t border-strong pt-inset-sm">
                  <dt className="font-semibold text-content">{t('web.account.orders.total')}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-content">
                    {formatMinorExact(order.totalMinor)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}

function ReceiptLine({ term, value }: { readonly term: string; readonly value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-inline-md py-inset-2xs">
      <dt className="text-content-secondary">{term}</dt>
      <dd className="tabular-nums text-content">{value}</dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────────────────────

export function Reviews() {
  const eligible = reviewableGyms(DEMO_MEMBER);
  const Verified = icon.verified;

  return (
    <AccountShell current="/account/reviews" title="web.account.reviews.title">
      <p className="max-w-prose text-base text-content-secondary">
        {t('web.account.reviews.rule')}
      </p>

      <h2 className="mt-stack-xl text-xl font-semibold text-content">
        {t('web.account.reviews.eligible')}
      </h2>

      {eligible.length === 0 ? (
        <p className="mt-stack-md max-w-prose text-base text-content-secondary">
          {t('web.account.reviews.none')}
        </p>
      ) : (
        <ul className="mt-stack-md grid gap-stack-md sm:grid-cols-2">
          {eligible.map((gymName) => (
            <li
              key={gymName}
              className="flex flex-wrap items-center justify-between gap-inline-md rounded-card border border-subtle bg-surface-raised p-inset-lg"
            >
              <span className="flex items-center gap-inline-sm text-base font-medium text-content">
                <Verified
                  aria-hidden="true"
                  className="h-[1.125rem] w-[1.125rem] shrink-0 text-content-success"
                  weight="fill"
                />
                {gymName}
              </span>
              {/*
               * Marked rather than linked, same rule as the nav: writing reviews arrives with the
               * reviews module, and a button that opens nothing is worse than a stated "not yet".
               */}
              <span aria-disabled="true" className="text-sm text-content-disabled">
                {t('web.account.reviews.write')}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-stack-lg text-sm text-content-muted">{t('web.account.reviews.soon')}</p>
    </AccountShell>
  );
}
