/**
 * `SCR-ADM-001` — the platform dashboard.
 *
 * ┌─ THE BANNER IS THE LOAD-BEARING PART OF THIS SCREEN ────────────────────────────────────────┐
 * │ Everything ABOVE `SampleNotice` is read from `/v1/admin/platform/overview` and `/readyz`.   │
 * │ Everything BELOW it comes from `shared/api/demo-figures.ts` and is invented.                 │
 * │                                                                                              │
 * │ That line is the whole design. Revenue, orders, settlements and moderation have no tables    │
 * │ until M-096…M-115, and a console shown to people needs to look like the product rather than │
 * │ like four tiles and three empty rectangles. Sample figures make that possible; the banner is │
 * │ what makes it honest. Do not remove it for a screenshot.                                     │
 * │                                                                                              │
 * │ A panel is fed from ONE side of the line, never both, so "is this real?" always has a        │
 * │ per-panel answer. Pending approvals sits below the fold beside the sample order list and is  │
 * │ still real — it says so on the panel.                                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ NOTHING ON A DATA PATH ANIMATES — `MO3` ───────────────────────────────────────────────────┐
 * │ No counting-up numbers, however good they look in a mockup. *A counting animation makes a   │
 * │ stale figure look live*, and `LC5` calls that a defect. The only motion is hover feedback.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { t, type MessageKey } from '../shared/i18n/index.ts';
import {
  AWAITING_STATUSES,
  platformGyms,
  platformOverview,
  type GymStatus,
  type PlatformOverview,
} from '../shared/api/admin.ts';
import {
  HEADLINES,
  RECENT_ORDERS,
  REGISTRATIONS,
  REGISTRATION_LABELS,
  REVENUE_BREAKDOWN,
  MEMBERSHIP_STATS,
  RECENT_ACTIVITY,
  RENEWAL_DELTA_BPS,
  RENEWAL_RATE_BPS,
  SPARKLINES,
  SYSTEM_ALERTS,
  TOP_GYMS,
  formatAgo,
  formatDeltaBps,
  formatMinor,
  isMoneyMetric,
  revenueSeries,
  REVENUE_METRICS,
  REVENUE_RANGES,
  type RevenueMetric,
  type RevenueRange,
} from '../shared/api/demo-figures.ts';
import { useSession } from '../shared/auth/session.tsx';
import { MetricCard, type Tone } from '@gymmap/ui';

import { AreaChart, Donut, Legend, MultiLine, Sparkline } from '../shared/viz/charts.tsx';
import { SeverityGlyph, TileGlyph, type TileIcon } from '../shared/icons/index.tsx';
import { PENDING_ROUTES } from './nav.ts';
import { GYM_STATUS_LABEL, STATUS_BAR_CLASS, StatusPill } from './status-pill.tsx';

interface ReadinessReport {
  readonly status: 'ready' | 'not_ready';
  readonly dependencies: Record<string, boolean>;
}

const PIPELINE: readonly GymStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'INFO_REQUESTED',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'CLOSED',
];

export function PlatformDashboardRoute() {
  const session = useSession();
  const overview = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: platformOverview,
    refetchInterval: 30_000,
  });

  const queue = useQuery({
    queryKey: ['admin', 'gyms', 'queue'],
    queryFn: async () => {
      const { gyms } = await platformGyms();
      return gyms
        .filter((gym) => AWAITING_STATUSES.includes(gym.status))
        .sort((a, b) => b.waiting_days - a.waiting_days)
        .slice(0, 5);
    },
    refetchInterval: 30_000,
  });

  const readiness = useQuery({
    queryKey: ['health', 'readyz'],
    // `/readyz` answers 503 when a dependency is down, and that IS the answer — so the body is
    // read rather than thrown away. A dashboard that renders "could not load" when the database
    // is down has hidden the one fact the operator needed.
    queryFn: async (): Promise<ReadinessReport> => {
      const response = await fetch('/readyz', { credentials: 'same-origin' });
      return (await response.json()) as ReadinessReport;
    },
    refetchInterval: 15_000,
  });

  const gyms = overview.data?.gyms;
  const people = overview.data?.people;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-inline-md">
        <div>
          {/* The role comes from the token, so this greeting can no longer call a support agent a
              Super Admin — which is what the hardcoded string did to five of the six roles. */}
          <h1 className="text-2xl font-semibold tracking-tight text-content">
            {session.status === 'AUTHENTICATED' && session.roleLabel !== null
              ? `${t('adm.dashboard.greetingPrefix')}${session.roleLabel}`
              : t('adm.dashboard.greetingPlain')}
          </h1>
          <p className="mt-stack-2xs text-xs text-content-muted">{t('adm.dashboard.subtitle')}</p>
        </div>
        <LastUpdated
          at={overview.data?.generatedAt}
          pending={overview.isFetching}
          onRefresh={() => {
            void overview.refetch();
          }}
        />
      </div>

      {/* ══ LIVE. Read from the database on every poll. ═════════════════════════════════ */}
      <div className="mt-stack-md grid gap-inline-sm sm:grid-cols-2 xl:grid-cols-4">
        <LiveTile
          label={t('adm.dashboard.tile.awaiting')}
          value={gyms?.awaitingReview}
          tone={gyms !== undefined && gyms.awaitingReview > 0 ? 'warning' : 'brand'}
          icon="approvals"
          to="/approvals"
        />
        <LiveTile
          label={t('adm.dashboard.tile.listed')}
          value={gyms?.listed}
          tone="success"
          icon="gyms"
          to="/gyms"
        />
        <LiveTile
          label={t('adm.dashboard.tile.accounts')}
          value={people?.count}
          tone="info"
          icon="accounts"
          to="/people"
        />
        <LiveTile
          label={t('adm.dashboard.tile.sessions')}
          value={people?.activeSessions}
          tone="brand"
          icon="devices"
          to="/sessions"
        />
      </div>

      {/* ══ STILL LIVE. Every row below is derived from the two queries above. ════════= */}
      <NeedsAttention
        gyms={gyms}
        oldestWaitingDays={queue.data?.[0]?.waiting_days}
        readiness={readiness.data}
      />

      {/* ══ Everything past this line is invented, and the banner says so. ══════════════ */}
      <SampleNotice />

      <div className="mt-stack-sm grid gap-inline-sm sm:grid-cols-2 xl:grid-cols-3">
        {HEADLINES.map((figure) => (
          <SampleTile key={figure.key} figure={figure} />
        ))}
      </div>

      <div className="mt-stack-lg grid gap-inline-lg xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          {/* ── Charts. Sample series, one x-axis each, never two y-scales. ───────────── */}
          <div className="grid gap-inline-sm xl:grid-cols-2">
            <RevenueOverview />

            <Panel title={t('adm.sample.revenueBreakdown')} sample>
              <Donut
                slices={REVENUE_BREAKDOWN.map((slice) => ({
                  label: t(slice.key as MessageKey),
                  // Geometry again — the arc length. `formatted` carries the exact figure.
                  value: Number(slice.amountMinor),
                  slot: slice.slot,
                  formatted: formatMinor(slice.amountMinor),
                }))}
              />
            </Panel>
          </div>

          <Panel title={t('adm.sample.newRegistrations')} sample className="mt-stack-sm">
            {/* Three series, so a legend is mandatory — identity is never colour alone. */}
            <Legend
              items={REGISTRATIONS.map((one) => ({
                label: t(one.key as MessageKey),
                slot: one.slot,
              }))}
            />
            <div className="mt-stack-sm">
              <MultiLine
                series={REGISTRATIONS.map((one) => ({
                  label: t(one.key as MessageKey),
                  slot: one.slot,
                  points: one.points,
                }))}
                labels={[...REGISTRATION_LABELS]}
              />
            </div>
          </Panel>

          {/* ── The pipeline. REAL, and back above the line. ──────────────────────────── */}
          <Panel title={t('adm.dashboard.pipeline.title')} className="mt-stack-sm">
            <p className="text-xs text-content-muted">{t('adm.dashboard.pipeline.body')}</p>

            {/* Bars because eight named states with counts is a magnitude comparison. Not a
                stacked bar: APPROVED is thirteen of twenty-three and the states an operator acts
                on are ones and twos, which would be slivers. Colour is STATUS, and every bar
                carries its name and its number so colour is never the only channel (AX8). */}
            <dl className="mt-stack-sm flex flex-col gap-stack-2xs">
              {PIPELINE.map((status) => {
                const value = gyms?.byStatus[status];
                // Scaled against the LARGEST bucket, not the total — against the total, six of
                // eight bars would be two pixels wide and say less than the bare numbers.
                const largest =
                  gyms === undefined ? 0 : Math.max(...Object.values(gyms.byStatus), 1);
                const percent = value === undefined || largest === 0 ? 0 : (value / largest) * 100;

                return (
                  <div
                    key={status}
                    className="grid grid-cols-[8rem_minmax(0,1fr)_2.5rem] items-center gap-inline-sm"
                  >
                    <dt className="truncate text-xs text-content-secondary">
                      {GYM_STATUS_LABEL[status]}
                    </dt>
                    <div
                      aria-hidden="true"
                      className="h-[0.5rem] overflow-hidden rounded-control bg-surface-sunken"
                    >
                      <div
                        className={`h-full rounded-control ${STATUS_BAR_CLASS[status]}`}
                        style={{ width: `${String(percent)}%` }}
                      />
                    </div>
                    <dd className="text-right text-sm font-semibold tabular-nums text-content">
                      {value ?? <span className="text-xs font-normal text-content-muted">-</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Panel>

          {/* ── Orders (sample) beside approvals (real). Each panel says which it is. ─── */}
          <div className="mt-stack-sm grid gap-inline-sm xl:grid-cols-2">
            <Panel title={t('adm.sample.recentOrders')} sample>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[26rem] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-subtle text-left">
                      <Th>{t('adm.sample.col.order')}</Th>
                      <Th>{t('adm.sample.col.member')}</Th>
                      <Th align="right">{t('adm.sample.col.amount')}</Th>
                      <Th>{t('adm.sample.col.status')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_ORDERS.map((order) => (
                      <tr key={order.ref} className="border-b border-subtle last:border-0">
                        <td className="py-inset-2xs pr-inset-sm">
                          <span className="font-mono tabular-nums text-content-secondary">
                            {order.ref}
                          </span>
                          <span className="block text-content-muted">
                            {formatAgo(order.minutesAgo)}
                          </span>
                        </td>
                        <td className="py-inset-2xs pr-inset-sm">
                          <span className="text-content">{order.member}</span>
                          <span className="block truncate text-content-muted">{order.gym}</span>
                        </td>
                        <td className="py-inset-2xs pr-inset-sm text-right tabular-nums text-content">
                          {formatMinor(order.amountMinor)}
                        </td>
                        <td className="py-inset-2xs">
                          <OrderStatus status={order.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel
              title={t('adm.queue.title')}
              action={{ to: '/approvals', label: t('adm.viewAll') }}
            >
              {queue.data === undefined ? (
                <p className="text-xs text-content-muted">{t('adm.state.loading')}</p>
              ) : (
                <ul className="flex flex-col gap-stack-2xs">
                  {queue.data.map((gym) => (
                    <li
                      key={gym.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-inline-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-content">
                          {gym.trading_name ?? gym.legal_name}
                        </p>
                        <p className="truncate text-xs text-content-muted">
                          {[gym.city, gym.state].filter(Boolean).join(', ')} · {gym.waiting_days}
                          {t('adm.queue.dayShort')}
                        </p>
                      </div>
                      <StatusPill status={gym.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        {/* ══ The rail ═══════════════════════════════════════════════════════════════════ */}
        <aside className="flex min-w-0 flex-col gap-inline-sm">
          <Panel title={t('adm.rail.quickActions')}>
            <ul className="flex flex-col gap-stack-2xs">
              {(
                [
                  ['/approvals', 'adm.rail.reviewQueue'],
                  ['/gyms', 'adm.rail.gymRegister'],
                  ['/people', 'adm.rail.accounts'],
                  ['/sessions', 'adm.rail.devices'],
                ] as const
              ).map(([to, label]) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="gm-hit-target flex items-center justify-between gap-inline-sm rounded-control border border-subtle px-inset-sm py-inset-2xs text-xs text-content-secondary transition-colors duration-fast ease-standard hover:border-strong hover:text-content"
                  >
                    <span className="truncate">{t(label)}</span>
                    <span aria-hidden="true" className="shrink-0 text-content-muted">
                      &rsaquo;
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t('adm.sample.systemAlerts')} sample>
            <ul className="flex flex-col gap-stack-sm">
              {SYSTEM_ALERTS.map((alert) => (
                <li key={alert.key} className="flex gap-inline-xs">
                  {/* Icon AND colour AND the severity word in the label — never colour alone. */}
                  <SeverityGlyph
                    severity={alert.severity}
                    className={`mt-[0.125rem] shrink-0 ${SEVERITY_INK[alert.severity]}`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-content">{t(alert.key as MessageKey)}</p>
                    <p className="text-xs text-content-muted">{t(alert.detailKey as MessageKey)}</p>
                    <p className="text-xs text-content-muted">{formatAgo(alert.minutesAgo)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t('adm.dashboard.health.title')}>
            <PlatformHealth report={readiness.data} />
          </Panel>
        </aside>
      </div>

      {/* ── Feed panels. Sample, and each tagged. ─────────────────────────────────────── */}
      <div className="mt-stack-lg grid gap-inline-sm xl:grid-cols-3">
        <Panel title={t('adm.sample.recentActivity')} sample>
          <ul className="flex flex-col gap-stack-sm">
            {RECENT_ACTIVITY.map((entry) => (
              <li key={entry.id} className="flex gap-inline-xs">
                <span
                  aria-hidden="true"
                  className={`grid h-[1.75rem] w-[1.75rem] shrink-0 place-items-center rounded-control text-xs font-semibold ${ACTIVITY_ACCENT[entry.kind]}`}
                >
                  {ACTIVITY_INITIAL[entry.kind]}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-content">{entry.headline}</p>
                  <p className="text-xs text-content-muted">
                    {entry.detail} · {formatAgo(entry.minutesAgo)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t('adm.sample.topGyms')} sample>
          <ol className="flex flex-col gap-stack-2xs">
            {TOP_GYMS.map((gym) => (
              <li key={gym.rank} className="flex items-center gap-inline-xs text-xs">
                <span
                  aria-hidden="true"
                  className="grid h-[1.5rem] w-[1.5rem] shrink-0 place-items-center rounded-control bg-surface-sunken font-semibold text-content-secondary"
                >
                  {gym.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-content">{gym.name}</span>
                <span className="shrink-0 tabular-nums font-medium text-content">
                  {formatMinor(gym.revenueMinor)}
                </span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title={t('adm.sample.membershipStats')} sample>
          <dl className="flex flex-col gap-stack-2xs">
            {MEMBERSHIP_STATS.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between gap-inline-sm text-xs"
              >
                <dt className="min-w-0 truncate text-content-secondary">{stat.label}</dt>
                <dd className="flex shrink-0 items-center gap-inline-xs">
                  <span className="tabular-nums font-medium text-content">
                    {stat.value.toLocaleString('en-IN')}
                  </span>
                  <span className="tabular-nums text-content-muted">
                    <span aria-hidden="true">{stat.deltaBps >= 0 ? '▲' : '▼'}</span>{' '}
                    {formatDeltaBps(stat.deltaBps)}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-stack-sm flex items-center justify-between gap-inline-sm rounded-control bg-surface-sunken px-inset-sm py-inset-xs">
            <span className="text-xs font-medium text-content">{t('adm.sample.renewalRate')}</span>
            <span className="flex items-center gap-inline-xs text-xs">
              <span className="tabular-nums font-semibold text-content">
                {(RENEWAL_RATE_BPS / 100).toFixed(1)}%
              </span>
              <span className="tabular-nums text-content-success">
                <span aria-hidden="true">▲</span> {formatDeltaBps(RENEWAL_DELTA_BPS)}
              </span>
            </span>
          </div>
        </Panel>
      </div>

      {/* ── Not built. Named, with the milestone, carrying no figure. ─────────────────── */}
      <section className="mt-stack-lg">
        <h2 className="text-sm font-semibold text-content">{t('adm.dashboard.awaiting.title')}</h2>
        <p className="mt-stack-2xs max-w-prose text-xs text-content-muted">
          {t('adm.dashboard.awaiting.body')}
        </p>
        <div className="mt-stack-sm grid gap-inline-sm sm:grid-cols-2 xl:grid-cols-4">
          {PENDING_ROUTES.map((route) => (
            <div
              key={route.path}
              className="rounded-card border border-dashed border-subtle bg-surface-sunken px-inset-md py-inset-sm"
            >
              <p className="text-xs font-medium text-content-secondary">{t(route.label)}</p>
              <p className="mt-stack-2xs text-xs text-content-muted">
                {t('adm.dashboard.awaiting.milestone')} {route.milestone}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pieces.
// ---------------------------------------------------------------------------

const SEVERITY_INK = {
  critical: 'text-content-danger',
  serious: 'text-content-warning',
  info: 'text-content-info',
  good: 'text-content-success',
} as const;

/** Which glyph each sample headline wears. Keyed by message key, so the fixture stays data. */
const SAMPLE_ICON: Record<string, TileIcon> = {
  'adm.sample.totalRevenue': 'revenue',
  'adm.sample.todayRevenue': 'revenue',
  'adm.sample.commission': 'commission',
  'adm.sample.activeMemberships': 'memberships',
  'adm.sample.supportTickets': 'support',
  'adm.sample.refundRequests': 'refunds',
};

/** One letter per activity kind. A glyph set for five kinds would be five more decisions. */
const ACTIVITY_INITIAL = {
  GYM: 'G',
  MEMBERSHIP: 'M',
  PAYMENT: 'P',
  REFUND: 'R',
  PAYOUT: 'S',
} as const;

const ACTIVITY_ACCENT = {
  GYM: 'bg-surface-success-subtle text-content-success',
  MEMBERSHIP: 'bg-surface-brand-subtle text-content-brand',
  PAYMENT: 'bg-surface-info-subtle text-content-info',
  REFUND: 'bg-surface-warning-subtle text-content-warning',
  PAYOUT: 'bg-surface-sunken text-content-secondary',
} as const;

const METRIC_LABEL: Readonly<Record<RevenueMetric, MessageKey>> = {
  REVENUE: 'adm.sample.metric.revenue',
  GMV: 'adm.sample.metric.gmv',
  COMMISSION: 'adm.sample.metric.commission',
  MEMBERSHIPS: 'adm.sample.metric.memberships',
};

/** The line the whole screen is organised around. See the file header. */
function SampleNotice() {
  return (
    <p className="mt-stack-lg rounded-card border border-warning bg-surface-warning-subtle px-inset-md py-inset-sm text-xs text-content-warning">
      {t('adm.sample.notice')}
    </p>
  );
}

function Panel({
  title,
  children,
  sample = false,
  action,
  className = '',
}: {
  title: string;
  children: ReactNode;
  sample?: boolean;
  action?: { to: string; label: string };
  className?: string;
}) {
  return (
    <section
      className={`rounded-card border border-subtle bg-surface p-inset-md shadow-xs dark:shadow-none ${className}`}
    >
      <div className="flex items-center justify-between gap-inline-sm">
        <h2 className="text-sm font-semibold text-content">{title}</h2>
        {/* Repeated per panel, not only in the banner. A reader who scrolled past the banner,
            or who is looking at one screenshot of one card, still gets the answer. */}
        {sample && (
          <span className="shrink-0 rounded-control border border-warning px-inset-2xs text-xs font-medium text-content-warning">
            {t('adm.sample.tag')}
          </span>
        )}
        {action && (
          <Link
            to={action.to}
            className="shrink-0 text-xs font-medium text-content-brand hover:underline"
          >
            {action.label}
          </Link>
        )}
      </div>
      <div className="mt-stack-sm">{children}</div>
    </section>
  );
}

/**
 * A real figure, as a link to the screen it came from.
 *
 * `MetricCard` from `packages/ui` does the drawing — this file had its own copy of the same card
 * twice, one for live figures and one for sample ones, and the two had already diverged: the live
 * one had a hover border and the sample one did not, so half the grid felt clickable and half did
 * not on a screen where BOTH halves are.
 *
 * The `live` caption is load-bearing rather than decoration: it is half of the answer to "is this
 * number real", and the banner below the grid is the other half.
 */
function LiveTile({
  label,
  value,
  tone,
  icon,
  to,
}: {
  label: string;
  value: number | undefined;
  tone: Tone;
  icon: TileIcon;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="gm-hit-target block rounded-card transition-opacity duration-fast ease-standard hover:opacity-90"
    >
      <MetricCard
        label={label}
        // Indian grouping on a COUNT is `toLocaleString` without a currency option, which is a
        // different thing from formatting money and is not what §12 rule 14 forbids. 1,20,000
        // accounts still reads wrong to an Indian operator as 120,000.
        value={value === undefined ? undefined : value.toLocaleString('en-IN')}
        tone={tone}
        icon={<TileGlyph icon={icon} />}
        caption={t('adm.dashboard.live')}
        loadingLabel={t('adm.state.loading')}
      />
    </Link>
  );
}

/** A sample figure. Same card, so the grid is one grid — the caption is what differs. */
function SampleTile({ figure }: { figure: (typeof HEADLINES)[number] }) {
  const rising = figure.deltaBps >= 0;

  return (
    <MetricCard
      label={t(figure.key as MessageKey)}
      value={
        figure.amountMinor === null
          ? (figure.count ?? 0).toLocaleString('en-IN')
          : formatMinor(figure.amountMinor)
      }
      tone={figure.tone}
      icon={<TileGlyph icon={SAMPLE_ICON[figure.key] ?? 'revenue'} />}
      chart={<Sparkline values={SPARKLINES[figure.key] ?? []} rising={rising} />}
      // The arrow shows DIRECTION and is never coloured good/bad. Fewer refund requests and less
      // revenue carry the same sign and opposite news, and a green arrow on one of them would be
      // the screen making a judgement the data does not support.
      trend={{ text: formatDeltaBps(figure.deltaBps), rising }}
      caption={t(
        figure.comparison === 'YESTERDAY' ? 'adm.sample.vsYesterday' : 'adm.sample.vsThirtyDays',
      )}
      loadingLabel={t('adm.state.loading')}
    />
  );
}

/**
 * "Needs your attention" -- the command centre, and every row of it is REAL.
 *
 * +- THIS PANEL IS ENTIRELY ABOVE THE SAMPLE LINE, AND THAT IS THE POINT -----------------------+
 * | The reference mockup's equivalent mixes real queue counts with invented payment alerts. Here |
 * | they are two panels: this one, from `/v1/admin/platform/overview`, the approval queue and    |
 * | `/readyz`; and `System alerts` further down, which is sample and says so. A panel fed from   |
 * | BOTH sides of that line has no per-panel answer to "is this real", which is the only         |
 * | question an operator asks before acting on it.                                               |
 * +---------------------------------------------------------------------------------------------+
 *
 * +- NOTHING IS SHOWN THAT DOES NOT NEED DOING -------------------------------------------------+
 * | A row appears only when its condition holds. An attention panel that always lists six items, |
 * | four of them reading "0", trains an operator to skip it -- and then it is worse than absent,  |
 * | because the day it has something to say it looks like every other day.                        |
 * |                                                                                             |
 * | When there is genuinely nothing it says so in one line rather than disappearing: a panel that |
 * | vanishes reads as "failed to load".                                                          |
 * +---------------------------------------------------------------------------------------------+
 */
function NeedsAttention({
  gyms,
  oldestWaitingDays,
  readiness,
}: {
  gyms: PlatformOverview['gyms'] | undefined;
  oldestWaitingDays: number | undefined;
  readiness: ReadinessReport | undefined;
}) {
  if (gyms === undefined) {
    return (
      <Panel title={t('adm.attention.title')} className="mt-stack-md">
        <p className="text-sm text-content-muted">{t('adm.state.loading')}</p>
      </Panel>
    );
  }

  const down = Object.entries(readiness?.dependencies ?? {})
    .filter(([, healthy]) => !healthy)
    .map(([name]) => name);

  interface AttentionItem {
    readonly id: string;
    readonly severity: keyof typeof SEVERITY_INK;
    readonly headline: string;
    readonly detail: string;
    readonly to: string;
    readonly action: string;
  }

  const items: readonly AttentionItem[] = [
    // A dependency being down outranks everything else: the figures on this page are read THROUGH
    // it, so an operator who acts on them without knowing is acting on a stale number.
    ...(down.length > 0
      ? [
          {
            id: 'readiness',
            severity: 'critical' as const,
            headline: t('adm.attention.dependency'),
            detail: down.join(', '),
            to: '/',
            action: t('adm.attention.viewHealth'),
          },
        ]
      : []),
    ...(gyms.awaitingReview > 0
      ? [
          {
            id: 'queue',
            // Seven days is the review target. Past it the queue is not "busy", it is LATE, and
            // this says so with a different mark rather than the same mark louder.
            severity:
              oldestWaitingDays !== undefined && oldestWaitingDays > 7
                ? ('serious' as const)
                : ('info' as const),
            headline: t('adm.attention.queue').replace('{n}', String(gyms.awaitingReview)),
            detail:
              oldestWaitingDays === undefined
                ? t('adm.attention.queueDetailUnknown')
                : t('adm.attention.queueDetail').replace('{d}', String(oldestWaitingDays)),
            to: '/approvals',
            action: t('adm.attention.review'),
          },
        ]
      : []),
    ...(gyms.byStatus.SUSPENDED > 0
      ? [
          {
            id: 'suspended',
            severity: 'serious' as const,
            headline: t('adm.attention.suspended').replace('{n}', String(gyms.byStatus.SUSPENDED)),
            // Named rather than implied: a suspended gym is hidden from members AND still billed,
            // so the count is a commercial fact and not only a moderation one.
            detail: t('adm.attention.suspendedDetail'),
            to: '/gyms',
            action: t('adm.attention.openRegister'),
          },
        ]
      : []),
    ...(gyms.byStatus.INFO_REQUESTED > 0
      ? [
          {
            id: 'info',
            severity: 'info' as const,
            headline: t('adm.attention.infoRequested').replace(
              '{n}',
              String(gyms.byStatus.INFO_REQUESTED),
            ),
            detail: t('adm.attention.infoRequestedDetail'),
            to: '/approvals',
            action: t('adm.attention.review'),
          },
        ]
      : []),
  ];

  return (
    <Panel title={t('adm.attention.title')} className="mt-stack-md">
      {items.length === 0 ? (
        <p className="text-sm text-content-secondary">{t('adm.attention.clear')}</p>
      ) : (
        <ul className="flex flex-col gap-stack-2xs">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-inline-sm rounded-control border border-subtle bg-surface-sunken px-inset-sm py-inset-xs"
            >
              <span className="flex min-w-0 items-start gap-inline-xs">
                {/* Icon AND colour AND the word -- never colour alone (AX8). */}
                <span className={`mt-[0.125rem] shrink-0 ${SEVERITY_INK[item.severity]}`}>
                  <SeverityGlyph severity={item.severity} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-content">{item.headline}</span>
                  <span className="block text-xs text-content-muted">{item.detail}</span>
                </span>
              </span>
              <Link
                to={item.to}
                className="gm-hit-target shrink-0 rounded-control border border-subtle px-inset-sm py-inset-2xs text-xs font-medium text-content-brand transition-colors duration-fast ease-standard hover:border-strong"
              >
                {item.action}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * The revenue overview, with its metric and range controls.
 *
 * +- BOTH CONTROLS WORK. THEY DO NOT CALL THE SERVER, AND THE PANEL SAYS SO --------------------+
 * | `sample` puts the tag on this panel, so nothing here claims to be a query result. The tabs   |
 * | are still real controls rather than decoration: an inert tab bar is worse than none, because  |
 * | a person clicks it, nothing happens, and they conclude the console is broken rather than      |
 * | unfinished.                                                                                 |
 * |                                                                                             |
 * | Every series is derived from the headline figure it ends at (`revenueSeries`), so the number  |
 * | above the chart and the chart's last point are the same value by construction and not by      |
 * | anyone remembering to update both.                                                            |
 * +---------------------------------------------------------------------------------------------+
 *
 * +- ONE Y-AXIS, AND THE METRICS ARE TABS FOR THAT REASON --------------------------------------+
 * | Revenue and membership count share no unit, and putting both on one chart needs a second     |
 * | y-scale -- which is the most common way a chart lies, because the crossing point of the two   |
 * | lines is an artefact of the scales chosen rather than a fact about the business. Tabs show    |
 * | one measure at a time on one axis instead.                                                    |
 * +---------------------------------------------------------------------------------------------+
 */
function RevenueOverview() {
  const [metric, setMetric] = useState<RevenueMetric>('REVENUE');
  const [range, setRange] = useState<RevenueRange>('30D');

  const series = revenueSeries(metric, range);
  const latest = series[series.length - 1]?.valueMinor ?? 0n;

  return (
    <Panel title={t('adm.sample.revenueOverview')} sample>
      {/* The metric picker reads as tabs; the range picker as a segmented control. Two different
          shapes because they answer two different questions, and a person scanning the panel
          should not have to work out which of eight identical chips changes what. */}
      <div
        role="tablist"
        aria-label={t('adm.sample.metricLabel')}
        className="-mx-inset-2xs flex flex-wrap items-center gap-inline-2xs border-b border-subtle"
      >
        {REVENUE_METRICS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={candidate === metric}
            onClick={() => {
              setMetric(candidate);
            }}
            className={`gm-hit-target -mb-[1px] rounded-t-control px-inset-sm py-inset-2xs text-sm transition-colors duration-fast ease-standard ${
              candidate === metric
                ? 'border-b-2 border-brand font-semibold text-content'
                : 'text-content-muted hover:text-content'
            }`}
          >
            {t(METRIC_LABEL[candidate])}
          </button>
        ))}
      </div>

      <div className="mt-stack-sm flex flex-wrap items-end justify-between gap-inline-sm">
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-content">
          {isMoneyMetric(metric)
            ? formatMinor(latest)
            : // A count, not money: Indian grouping without a currency, which is a different
              // operation from formatting rupees and not what §12 rule 14 governs.
              Number(latest).toLocaleString('en-IN')}
        </p>

        <div
          role="group"
          aria-label={t('adm.sample.rangeLabel')}
          className="flex items-center gap-[1px] overflow-hidden rounded-control border border-subtle"
        >
          {REVENUE_RANGES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={candidate === range}
              onClick={() => {
                setRange(candidate);
              }}
              className={`gm-hit-target px-inset-sm py-inset-2xs text-xs font-medium tabular-nums transition-colors duration-fast ease-standard ${
                candidate === range
                  ? 'bg-surface-brand-subtle text-content-brand'
                  : 'text-content-muted hover:bg-surface-sunken hover:text-content'
              }`}
            >
              {candidate}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-stack-sm">
        <AreaChart
          // `Number()` at the plotting boundary only -- a pixel is a float, the figure above is not.
          values={series.map((point) => Number(point.valueMinor))}
          labels={series.map((point) => point.label)}
          slot={1}
        />
      </div>
    </Panel>
  );
}

function OrderStatus({ status }: { status: 'COMPLETED' | 'PAID' | 'PENDING' | 'REFUNDED' }) {
  const CLASS = {
    COMPLETED: 'bg-surface-success-subtle text-content-success',
    PAID: 'bg-surface-info-subtle text-content-info',
    PENDING: 'bg-surface-warning-subtle text-content-warning',
    REFUNDED: 'bg-surface-danger-subtle text-content-danger',
  } as const;

  const LABEL = {
    COMPLETED: 'Completed',
    PAID: 'Paid',
    PENDING: 'Pending',
    REFUNDED: 'Refunded',
  } as const;

  return (
    <span
      className={`whitespace-nowrap rounded-control px-inset-2xs py-inset-2xs text-xs font-medium ${CLASS[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}

function PlatformHealth({ report }: { report: ReadinessReport | undefined }) {
  const dependencies = report?.dependencies ?? {};

  return (
    <>
      {report !== undefined && (
        <span
          className={`inline-block rounded-control px-inset-2xs text-xs font-medium ${
            report.status === 'ready'
              ? 'bg-surface-success-subtle text-content-success'
              : 'bg-surface-danger-subtle text-content-danger'
          }`}
        >
          {report.status === 'ready'
            ? t('adm.dashboard.api.ready')
            : t('adm.dashboard.api.notReady')}
        </span>
      )}

      <ul className="mt-stack-sm flex flex-col gap-stack-2xs">
        {Object.entries(dependencies).map(([name, up]) => (
          <li key={name} className="flex items-center gap-inline-2xs text-xs">
            <span
              aria-hidden="true"
              className={up ? 'text-content-success' : 'text-content-danger'}
            >
              {up ? '●' : '○'}
            </span>
            <span className="flex-1 text-content-secondary">{name}</span>
            <span className={up ? 'text-content-success' : 'text-content-danger'}>
              {up ? t('adm.dashboard.health.up') : t('adm.dashboard.health.down')}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-stack-sm text-xs text-content-muted">{t('adm.dashboard.health.note')}</p>
    </>
  );
}

function Th({ children, align }: { children: ReactNode; align?: 'right' }) {
  return (
    <th
      scope="col"
      className={`pb-inset-2xs pr-inset-sm text-xs font-semibold uppercase tracking-wide text-content-muted ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  );
}

/** `A-08`, `LC5` — a stale figure presented as live is a defect. */
function LastUpdated({
  at,
  pending,
  onRefresh,
}: {
  at: string | undefined;
  pending: boolean;
  onRefresh: () => void;
}): ReactNode {
  return (
    <div className="flex items-center gap-inline-sm">
      <span className="text-xs text-content-muted" aria-live="polite">
        {pending
          ? t('adm.dashboard.refreshing')
          : at === undefined
            ? ''
            : `${t('adm.dashboard.lastUpdated')} ${new Date(at).toLocaleTimeString()}`}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        className="gm-hit-target rounded-control border border-subtle px-inset-sm py-inset-2xs text-xs text-content-secondary transition-colors duration-fast ease-standard hover:text-content"
      >
        {t('adm.dashboard.refresh')}
      </button>
    </div>
  );
}
