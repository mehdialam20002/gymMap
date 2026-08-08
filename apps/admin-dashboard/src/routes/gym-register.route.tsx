/**
 * `SCR-ADM-004` — the gym register. Every gym business on the platform.
 *
 * ┌─ TABULAR NUMERALS ON EVERY FIGURE IN A COLUMN — `DesignSystem.md` §1.1 ─────────────────────┐
 * │ Proportional digits make a column of numbers ragged, and a ragged column cannot be scanned  │
 * │ for an outlier — which is the only reason to put numbers in a column at all.                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The commission arrives as integer basis points and is divided in exactly one place
 * (`formatBps`). Same discipline as integer paise, same reason: a rate held as a float is a
 * rounding difference between what the gym agreed and what the ledger applies.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  DataTable,
  FilterTabs,
  Pagination,
  Panel,
  StateBoundary,
  TableSkeleton,
  toSurfaceState,
  type Column,
} from '@gymmap/ui';

import { t } from '../shared/i18n/index.ts';
import { formatBps, platformGyms, type GymRow, type GymStatus } from '../shared/api/admin.ts';
import { toProblem } from '../shared/api/client.ts';
import { GYM_STATUS_LABEL, statusTone } from './status-pill.tsx';
import { PAGE_LABELS } from './approval-queue.route.tsx';

const PAGE_SIZE = 10;

/**
 * The register's tabs, in the order an operator thinks about them.
 *
 * Not the eight raw enum values. `Active` folds APPROVED, and the three in-flight states live on
 * the approval queue where the work is — a register is for looking things up, not for triage.
 */
const TABS: ReadonlyArray<{ id: string; label: string; statuses: readonly GymStatus[] | null }> = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'active', label: 'Active', statuses: ['APPROVED'] },
  { id: 'pending', label: 'In review', statuses: ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED'] },
  { id: 'suspended', label: 'Suspended', statuses: ['SUSPENDED'] },
  { id: 'rejected', label: 'Rejected', statuses: ['REJECTED'] },
  { id: 'draft', label: 'Draft', statuses: ['DRAFT', 'CLOSED'] },
];

export function GymRegisterRoute() {
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin', 'gyms', 'all'],
    queryFn: () => platformGyms(),
    refetchInterval: 60_000,
  });

  const all = query.data?.gyms ?? [];

  const rows = useMemo(() => {
    const admitted = TABS.find((entry) => entry.id === tab)?.statuses;
    return admitted === null || admitted === undefined
      ? all
      : all.filter((gym) => admitted.includes(gym.status));
  }, [all, tab]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((entry) => [
          entry.id,
          entry.statuses === null
            ? all.length
            : all.filter((gym) => entry.statuses?.includes(gym.status) === true).length,
        ]),
      ),
    [all],
  );

  const state = toSurfaceState(query, {
    isEmpty: () => rows.length === 0,
    emptyReason: () => (tab === 'all' ? 'no-records' : 'filtered-out'),
    toProblem,
  });

  const columns: readonly Column<GymRow>[] = [
    {
      key: 'gym',
      flexible: true,
      header: t('adm.gyms.col.gym'),
      cell: (gym) => (
        <div className="min-w-0">
          <Link
            to={`/gyms/${gym.id}`}
            className="truncate font-medium text-content hover:underline"
          >
            {gym.trading_name ?? gym.legal_name}
          </Link>
          {/* The legal name is what appears on an invoice and in a dispute, so it is shown too
              when it differs — not collapsed into the trading name. */}
          {gym.trading_name !== null && gym.trading_name !== gym.legal_name && (
            <p className="truncate text-xs text-content-muted">{gym.legal_name}</p>
          )}
        </div>
      ),
    },
    {
      key: 'location',
      header: t('adm.gyms.col.location'),
      cell: (gym) => (
        <span className="text-xs">{[gym.city, gym.state].filter(Boolean).join(', ') || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: t('adm.gyms.col.status'),
      cell: (gym) => <Badge tone={statusTone(gym.status)}>{GYM_STATUS_LABEL[gym.status]}</Badge>,
    },
    {
      key: 'subscription',
      header: t('adm.gyms.col.subscription'),
      secondary: true,
      cell: (gym) => (
        <span className="text-xs capitalize">
          {gym.subscription_status.toLowerCase().replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'commission',
      header: t('adm.gyms.col.commission'),
      align: 'right',
      cell: (gym) => <span className="tabular-nums">{formatBps(gym.commission_rate_bps)}</span>,
    },
    {
      key: 'gstin',
      header: t('adm.gyms.col.gstin'),
      secondary: true,
      cell: (gym) =>
        gym.gstin === null ? (
          // Not an error, and not every gym has one — below the turnover threshold registration
          // is not required. An empty cell would read as missing data.
          <span className="text-xs text-content-muted">{t('adm.gyms.notRegistered')}</span>
        ) : (
          <span className="font-mono text-xs tabular-nums">{gym.gstin}</span>
        ),
    },
    {
      key: 'actions',
      header: t('adm.queue.col.actions'),
      align: 'right',
      cell: (gym) => (
        <div className="flex items-center justify-end gap-inline-2xs">
          <Link
            to={`/gyms/${gym.id}`}
            className="gm-hit-target rounded-control px-inset-xs py-inset-2xs text-xs font-medium text-content-brand hover:underline"
          >
            {t('adm.gyms.view')}
          </Link>
          {/* The overflow menu is where suspend, reinstate and edit will live. Every one of them
              is an audited mutation on a tenant (M-114), so the trigger is inert rather than
              opening a menu of things that cannot be done. */}
          <button
            type="button"
            disabled
            aria-label={t('adm.gyms.moreActions')}
            title={t('adm.gyms.moreActions')}
            className="gm-hit-target rounded-control px-inset-xs text-sm text-content-disabled"
          >
            &#8943;
          </button>
        </div>
      ),
    },
  ];

  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-inline-md">
        <div>
          <h1 className="text-xl font-semibold text-content">{t('adm.gyms.title')}</h1>
          <p className="mt-stack-2xs text-sm text-content-secondary">{t('adm.gyms.subtitle')}</p>
        </div>

        {/* Both inert, and both present. Filters beyond status need the query parameters the
            register endpoint does not take yet; Export needs a generated file, an audit row for
            who exported the platform's commercial terms, and a decision about what a CSV of every
            gym's GSTIN is allowed to contain (BR-DAT-06). Neither is a button away. */}
        <div className="flex items-center gap-inline-2xs">
          <Button size="sm" disabled>
            {t('adm.gyms.filters')}
          </Button>
          <Button size="sm" disabled>
            {t('adm.gyms.export')}
          </Button>
        </div>
      </div>

      <div className="mt-stack-md">
        <FilterTabs
          label={t('adm.gyms.col.status')}
          activeId={tab}
          onSelect={(next) => {
            setTab(next);
            setPage(1);
          }}
          tabs={TABS.map((entry) => {
            const count = counts[entry.id];
            return {
              id: entry.id,
              label: entry.id === 'all' ? t('adm.gyms.filterAll') : entry.label,
              ...(count === undefined ? {} : { count }),
            };
          })}
        />
      </div>

      <Panel className="mt-stack-sm">
        <StateBoundary
          state={state}
          regionLabelText={t('adm.gyms.title')}
          loadingFallback={<TableSkeleton rows={8} />}
          onRetry={() => {
            void query.refetch();
          }}
          emptyState={(reason) => ({
            title: reason === 'filtered-out' ? t('adm.gyms.empty') : t('adm.gyms.emptyAll'),
            bodyText:
              reason === 'filtered-out' ? t('adm.gyms.emptyBody') : t('adm.gyms.emptyAllBody'),
            primaryAction: {
              label: t('adm.gyms.filterAll'),
              onAction: () => {
                setTab('all');
                setPage(1);
              },
            },
          })}
        >
          {() => (
            <>
              <DataTable
                columns={columns}
                rows={paged}
                rowKey={(gym) => gym.id}
                caption={t('adm.gyms.subtitle')}
              />
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                rowCount={rows.length}
                onPage={setPage}
                labels={PAGE_LABELS}
              />
            </>
          )}
        </StateBoundary>
      </Panel>
    </>
  );
}
