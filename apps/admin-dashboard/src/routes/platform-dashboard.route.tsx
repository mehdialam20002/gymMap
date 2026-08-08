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
import type { ReactNode } from 'react';

import { t, type MessageKey } from '../shared/i18n/index.ts';
import {
  AWAITING_STATUSES,
  platformGyms,
  platformOverview,
  type GymStatus,
} from '../shared/api/admin.ts';
import {
  HEADLINES,
  RECENT_ORDERS,
  REGISTRATIONS,
  REGISTRATION_LABELS,
  REVENUE_BREAKDOWN,
  REVENUE_SERIES,
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
} from '../shared/api/demo-figures.ts';
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
          <h1 className="text-xl font-semibold text-content">{t('adm.dashboard.greeting')}</h1>
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
            <Panel title={t('adm.sample.revenueOverview')} sample>
              <p className="text-xl font-semibold tabular-nums text-content">
                {formatMinor(REVENUE_SERIES[REVENUE_SERIES.length - 1]?.valueMinor ?? 0n)}
              </p>
              <div className="mt-stack-sm">
                <AreaChart
                  // ┌─ `Number()` HERE, AND ONLY HERE ────────────────────────────────────────┐
                  // │ A chart plots pixels, and a pixel is a float — so the geometry takes     │
                  // │ `number`. The FIGURE beside it stays `bigint` all the way to             │
                  // │ `formatMinor`, which is the half that a reader reconciles against an     │
                  // │ invoice. Converting at the plotting boundary loses nothing; converting    │
                  // │ upstream would put every displayed amount through IEEE754.                │
                  // └─────────────────────────────────────────────────────────────────────────┘
                  values={REVENUE_SERIES.map((point) => Number(point.valueMinor))}
                  labels={REVENUE_SERIES.map((point) => point.label)}
                  slot={1}
                />
              </div>
            </Panel>

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

const TONE_ACCENT = {
  brand: 'bg-surface-brand-subtle text-content-brand',
  success: 'bg-surface-success-subtle text-content-success',
  warning: 'bg-surface-warning-subtle text-content-warning',
  danger: 'bg-surface-danger-subtle text-content-danger',
  info: 'bg-surface-info-subtle text-content-info',
} as const;

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

function LiveTile({
  label,
  value,
  tone,
  icon,
  to,
}: {
  label: string;
  value: number | undefined;
  tone: keyof typeof TONE_ACCENT;
  icon: TileIcon;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="gm-hit-target block rounded-card border border-subtle bg-surface p-inset-md shadow-xs transition-colors duration-fast ease-standard hover:border-strong dark:shadow-none"
    >
      <div className="flex items-start justify-between gap-inline-sm">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-content-muted">{label}</p>
          <p className="mt-stack-2xs text-xs font-semibold text-content-success">
            {t('adm.dashboard.live')}
          </p>
        </div>
        <span
          className={`grid h-[2.25rem] w-[2.25rem] shrink-0 place-items-center rounded-control ${TONE_ACCENT[tone]}`}
        >
          <TileGlyph icon={icon} />
        </span>
      </div>
      {/* `undefined` renders the loading word, never a `0`. */}
      <p className="mt-stack-2xs text-2xl font-semibold tabular-nums text-content">
        {value ?? (
          <span className="text-sm font-normal text-content-muted">{t('adm.state.loading')}</span>
        )}
      </p>
    </Link>
  );
}

function SampleTile({ figure }: { figure: (typeof HEADLINES)[number] }) {
  const rising = figure.deltaBps >= 0;

  return (
    <div className="rounded-card border border-subtle bg-surface p-inset-md">
      <div className="flex items-start justify-between gap-inline-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-content-muted">
          {t(figure.key as MessageKey)}
        </p>
        <span
          className={`grid h-[2.25rem] w-[2.25rem] shrink-0 place-items-center rounded-control ${TONE_ACCENT[figure.tone]}`}
        >
          <TileGlyph icon={SAMPLE_ICON[figure.key] ?? 'revenue'} />
        </span>
      </div>

      <p className="mt-stack-2xs text-2xl font-semibold tabular-nums text-content">
        {figure.amountMinor === null
          ? (figure.count ?? 0).toLocaleString('en-IN')
          : formatMinor(figure.amountMinor)}
      </p>

      {/* The arrow shows DIRECTION and is not coloured good/bad. Fewer refund requests and less
          revenue carry the same sign and opposite news, and a green arrow on one of them would
          be the screen making a judgement the data does not support. */}
      <div className="mt-stack-2xs">
        <Sparkline values={SPARKLINES[figure.key] ?? []} rising={rising} />
      </div>

      <p className="mt-stack-2xs text-xs text-content-muted">
        <span aria-hidden="true">{rising ? '▲' : '▼'}</span> {formatDeltaBps(figure.deltaBps)}{' '}
        {t(
          figure.comparison === 'YESTERDAY' ? 'adm.sample.vsYesterday' : 'adm.sample.vsThirtyDays',
        )}
      </p>
    </div>
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
