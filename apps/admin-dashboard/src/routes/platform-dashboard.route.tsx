/**
 * `SCR-ADM-001` — the platform dashboard.
 *
 * Compact density and keyboard-first: Anita reviews 30–60 applications a day and Vikram needs a
 * figure he can trace to its source events (`DesignSystem.md` §1.1). The failure mode this surface
 * guards against is ambiguity about which figure is authoritative.
 *
 * ┌─ EVERY NUMBER ON THIS PAGE IS REAL, OR IT IS NOT A NUMBER ──────────────────────────────────┐
 * │ A dashboard full of `0` or `—` is worse than an empty one: an operator reads a zero as data, │
 * │ and a zero that means "not built" is indistinguishable from a zero that means "nothing to    │
 * │ approve today". One of those needs action and the other does not.                            │
 * │                                                                                              │
 * │ So a tile is one of two things. Either it is bound to a live endpoint and shows what that    │
 * │ endpoint returned, or it says which milestone delivers it and shows no figure at all.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ AND EVERY LIVE FIGURE CARRIES ITS AGE — `A-08` ────────────────────────────────────────────┐
 * │ *"A stale figure presented as live is a defect."* `refetchOnWindowFocus` is off by design    │
 * │ (see `main.tsx`), so a figure CAN be minutes old — which is fine, and only fine because the  │
 * │ page says so. The indicator is not decoration; it is the thing that makes the setting safe.  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { t } from '../shared/i18n/index.ts';
import { listSessions } from '../shared/api/client.ts';

interface ReadinessReport {
  readonly status: 'ready' | 'not_ready';
  readonly dependencies: Record<string, boolean>;
}

/** The screens with no endpoint behind them yet, and the milestone that delivers each. */
const AWAITING: ReadonlyArray<{ label: string; milestone: string }> = [
  { label: 'adm.dashboard.tile.approvals', milestone: 'M-036' },
  { label: 'adm.dashboard.tile.gyms', milestone: 'M-114' },
  { label: 'adm.dashboard.tile.settlements', milestone: 'M-097' },
  { label: 'adm.dashboard.tile.moderation', milestone: 'M-084' },
];

export function PlatformDashboardRoute() {
  const readiness = useQuery({
    queryKey: ['health', 'readyz'],
    // `/readyz` answers 503 when a dependency is down, and that IS the answer — so the failure
    // body is read rather than thrown away. A dashboard that renders "could not load" when the
    // database is down has hidden the one fact the operator needed.
    queryFn: async (): Promise<ReadinessReport> => {
      const response = await fetch('/readyz', { credentials: 'same-origin' });
      return (await response.json()) as ReadinessReport;
    },
    refetchInterval: 15_000,
  });

  const sessions = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: listSessions,
    refetchInterval: 20_000,
  });

  const dependencies = readiness.data?.dependencies ?? {};
  const healthy = Object.values(dependencies).filter(Boolean).length;
  const total = Object.keys(dependencies).length;

  return (
    <>
      <h1 className="text-2xl font-semibold text-content">{t('adm.dashboard.title')}</h1>
      <p className="mt-stack-2xs text-base text-content-secondary">{t('adm.dashboard.subtitle')}</p>

      <LastUpdated at={readiness.dataUpdatedAt} pending={readiness.isFetching} />

      {/* ── Live ────────────────────────────────────────────────────────────────────────── */}
      <div className="mt-stack-md grid gap-inline-md sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          label={t('adm.dashboard.tile.api')}
          value={readiness.data === undefined ? null : statusLabel(readiness.data.status)}
          tone={readiness.data?.status === 'ready' ? 'ok' : 'danger'}
        />
        <Tile
          label={t('adm.dashboard.tile.dependencies')}
          value={total === 0 ? null : `${String(healthy)} / ${String(total)}`}
          tone={total > 0 && healthy === total ? 'ok' : 'danger'}
          detail={Object.entries(dependencies)
            .map(([name, up]) => `${name} ${up ? '✓' : '✗'}`)
            .join(' · ')}
        />
        <Tile
          label={t('adm.dashboard.tile.yourDevices')}
          value={sessions.data === undefined ? null : String(sessions.data.sessions.length)}
          tone="neutral"
          detail={t('adm.dashboard.tile.yourDevicesDetail')}
        />
      </div>

      {/* ── Not built. Named, with the milestone, and carrying no figure. ───────────────── */}
      <h2 className="mt-stack-xl text-lg font-semibold text-content">
        {t('adm.dashboard.awaiting.title')}
      </h2>
      <p className="mt-stack-3xs max-w-ui text-sm text-content-muted">
        {t('adm.dashboard.awaiting.body')}
      </p>

      <div className="mt-stack-sm grid gap-inline-md sm:grid-cols-2 lg:grid-cols-4">
        {AWAITING.map((tile) => (
          <div
            key={tile.milestone + tile.label}
            className="rounded-card border border-dashed border-subtle bg-surface-sunken p-inset-md"
          >
            <p className="text-base font-medium text-content-secondary">{t(tile.label as never)}</p>
            <p className="mt-stack-3xs text-sm text-content-muted">
              {t('adm.dashboard.awaiting.milestone')} {tile.milestone}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function Tile({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string | null;
  tone: 'ok' | 'danger' | 'neutral';
  detail?: string;
}) {
  const TONE_CLASS = {
    ok: 'text-content-success',
    danger: 'text-content-danger',
    neutral: 'text-content',
  } as const;
  const valueTone = TONE_CLASS[tone];

  return (
    <div className="rounded-card border border-subtle bg-surface p-inset-md">
      <p className="text-sm font-medium uppercase tracking-wide text-content-muted">{label}</p>
      {/* `null` renders the loading word, never a `0`. See the header. */}
      <p className={`mt-stack-3xs text-2xl font-semibold ${valueTone}`}>
        {value ?? <span className="text-base text-content-muted">{t('adm.state.loading')}</span>}
      </p>
      {detail !== undefined && value !== null && (
        <p className="mt-stack-3xs text-sm text-content-secondary">{detail}</p>
      )}
    </div>
  );
}

function LastUpdated({ at, pending }: { at: number; pending: boolean }): ReactNode {
  if (at === 0) return null;

  return (
    <p className="mt-stack-sm text-sm text-content-muted" aria-live="polite">
      {pending
        ? t('adm.dashboard.refreshing')
        : `${t('adm.dashboard.lastUpdated')} ${new Date(at).toLocaleTimeString()}`}
    </p>
  );
}

const statusLabel = (status: ReadinessReport['status']): string =>
  status === 'ready' ? t('adm.dashboard.api.ready') : t('adm.dashboard.api.notReady');
