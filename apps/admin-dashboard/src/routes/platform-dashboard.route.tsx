/**
 * `SCR-ADM-001` — the platform dashboard.
 *
 * ┌─ EVERY NUMBER IS REAL, OR IT IS NOT A NUMBER ───────────────────────────────────────────────┐
 * │ A dashboard full of `0` is worse than an empty one: an operator reads a zero as data, and a │
 * │ zero meaning "not built" is indistinguishable from a zero meaning "nothing to approve        │
 * │ today". One of those needs somebody and the other does not.                                  │
 * │                                                                                              │
 * │ So a tile is bound to a live endpoint, or it names the milestone that will deliver it and    │
 * │ shows nothing. Revenue, orders, settlements and refunds have no tables yet, so they are in   │
 * │ the second group — the server does not even return a field for them.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE QUEUE SITS ABOVE THE CHARTS, AND THAT IS THE LAYOUT DECISION THAT MATTERS ─────────────┐
 * │ `DesignSystem.md` §1.1: Anita reviews 30-60 applications a day. A layout that fills the      │
 * │ first fold with large KPI tiles and pushes the queue below it gives the person who uses this │
 * │ screen most the least of it. Tiles are one line tall for the same reason.                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ NOTHING ON A DATA PATH ANIMATES — `MO3` ───────────────────────────────────────────────────┐
 * │ No counting-up numbers, however good they look in a mockup. *A counting animation makes a   │
 * │ stale figure look live*, and `LC5` calls that a defect. A figure that changes because a poll │
 * │ landed cross-fades; it never counts. The only motion here is hover feedback.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { t } from '../shared/i18n/index.ts';
import { platformOverview, type GymStatus } from '../shared/api/admin.ts';
import { PENDING_ROUTES } from './nav.ts';
import { GYM_STATUS_LABEL, StatusPill } from './status-pill.tsx';

interface ReadinessReport {
  readonly status: 'ready' | 'not_ready';
  readonly dependencies: Record<string, boolean>;
}

/** The order an operator thinks about the pipeline, not alphabetical. */
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
  const dependencies = readiness.data?.dependencies ?? {};
  const healthy = Object.values(dependencies).filter(Boolean).length;
  const total = Object.keys(dependencies).length;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-inline-md">
        <h1 className="text-xl font-semibold text-content">{t('adm.dashboard.title')}</h1>
        <LastUpdated
          at={overview.data?.generatedAt}
          pending={overview.isFetching}
          onRefresh={() => {
            void overview.refetch();
          }}
        />
      </div>

      {/* ── Live figures ───────────────────────────────────────────────────────────────── */}
      <div className="mt-stack-md grid gap-inline-sm sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label={t('adm.dashboard.tile.awaiting')}
          value={gyms?.awaitingReview}
          tone={gyms !== undefined && gyms.awaitingReview > 0 ? 'warning' : 'neutral'}
          to="/approvals"
        />
        <Tile label={t('adm.dashboard.tile.listed')} value={gyms?.listed} to="/gyms" />
        <Tile label={t('adm.dashboard.tile.accounts')} value={people?.total} to="/people" />
        <Tile
          label={t('adm.dashboard.tile.sessions')}
          value={people?.activeSessions}
          to="/sessions"
        />
      </div>

      {/* ── The pipeline. The whole C4.4 state machine, with real counts. ──────────────── */}
      <section className="mt-stack-lg rounded-card border border-subtle bg-surface p-inset-md">
        <h2 className="text-sm font-semibold text-content">{t('adm.dashboard.pipeline.title')}</h2>
        <p className="mt-stack-3xs text-xs text-content-muted">
          {t('adm.dashboard.pipeline.body')}
        </p>

        <ul className="mt-stack-sm flex flex-wrap gap-inline-md">
          {PIPELINE.map((status) => (
            <li key={status} className="min-w-24">
              <p className="text-xl font-semibold tabular-nums text-content">
                {gyms === undefined ? (
                  <span className="text-sm font-normal text-content-muted">
                    {t('adm.state.loading')}
                  </span>
                ) : (
                  gyms.byStatus[status]
                )}
              </p>
              <p className="mt-stack-3xs text-xs text-content-secondary">
                {GYM_STATUS_LABEL[status]}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Infrastructure. Two probes, and only two are claimed. ──────────────────────── */}
      <section className="mt-stack-lg rounded-card border border-subtle bg-surface p-inset-md">
        <div className="flex flex-wrap items-center justify-between gap-inline-md">
          <h2 className="text-sm font-semibold text-content">{t('adm.dashboard.health.title')}</h2>
          {readiness.data !== undefined && (
            <span
              className={`rounded-control px-inset-xs py-inset-3xs text-xs font-medium ${
                readiness.data.status === 'ready'
                  ? 'bg-surface-success-subtle text-content-success'
                  : 'bg-surface-danger-subtle text-content-danger'
              }`}
            >
              {readiness.data.status === 'ready'
                ? t('adm.dashboard.api.ready')
                : t('adm.dashboard.api.notReady')}
              {total > 0 && ` · ${String(healthy)}/${String(total)}`}
            </span>
          )}
        </div>

        <ul className="mt-stack-sm flex flex-wrap gap-inline-md">
          {Object.entries(dependencies).map(([name, up]) => (
            <li key={name} className="flex items-center gap-inline-2xs text-sm">
              {/* Icon AND word AND colour, never colour alone (AX8). A green dot on its own is
                  invisible to roughly one man in twelve. */}
              <span
                aria-hidden="true"
                className={up ? 'text-content-success' : 'text-content-danger'}
              >
                {up ? '●' : '○'}
              </span>
              <span className="text-content-secondary">{name}</span>
              <span className={up ? 'text-content-success' : 'text-content-danger'}>
                {up ? t('adm.dashboard.health.up') : t('adm.dashboard.health.down')}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-stack-sm text-xs text-content-muted">{t('adm.dashboard.health.note')}</p>
      </section>

      {/* ── Not built. Named, with the milestone, carrying no figure. ──────────────────── */}
      <section className="mt-stack-lg">
        <h2 className="text-sm font-semibold text-content">{t('adm.dashboard.awaiting.title')}</h2>
        <p className="mt-stack-3xs max-w-prose text-xs text-content-muted">
          {t('adm.dashboard.awaiting.body')}
        </p>

        <div className="mt-stack-sm grid gap-inline-sm sm:grid-cols-2 xl:grid-cols-4">
          {PENDING_ROUTES.map((route) => (
            <div
              key={route.path}
              className="rounded-card border border-dashed border-subtle bg-surface-sunken px-inset-md py-inset-sm"
            >
              <p className="text-sm font-medium text-content-secondary">{t(route.label)}</p>
              <p className="mt-stack-3xs text-xs text-content-muted">
                {t('adm.dashboard.awaiting.milestone')} {route.milestone}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Tile({
  label,
  value,
  tone = 'neutral',
  to,
}: {
  label: string;
  value: number | undefined;
  tone?: 'neutral' | 'warning';
  to: string;
}) {
  return (
    <Link
      to={to}
      className="gm-hit-target block rounded-card border border-subtle bg-surface px-inset-md py-inset-sm transition-colors duration-fast ease-standard hover:border-strong"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-content-muted">{label}</p>
      {/* `undefined` renders the loading word, never a `0`. See the file header. */}
      <p
        className={`mt-stack-3xs text-2xl font-semibold tabular-nums ${
          tone === 'warning' && value !== undefined && value > 0
            ? 'text-content-warning'
            : 'text-content'
        }`}
      >
        {value ?? (
          <span className="text-sm font-normal text-content-muted">{t('adm.state.loading')}</span>
        )}
      </p>
    </Link>
  );
}

/**
 * `A-08`, `LC5` — *"a stale figure presented as live is a defect."*
 *
 * `refetchOnWindowFocus` is off by design, so a figure CAN be a minute old. That is fine, and it
 * is only fine because this line says so and the refresh is one click away.
 */
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
        className="gm-hit-target rounded-control border border-subtle px-inset-sm py-inset-3xs text-xs text-content-secondary transition-colors duration-fast ease-standard hover:text-content"
      >
        {t('adm.dashboard.refresh')}
      </button>
    </div>
  );
}

export { StatusPill };
