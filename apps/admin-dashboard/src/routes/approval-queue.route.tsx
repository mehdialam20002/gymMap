/**
 * `SCR-ADM-002` — the approval queue. `BR-GYM-01`, `C4.4`.
 *
 * ┌─ THE LIST IS REAL. THE ACTIONS ARE NOT, AND THE SCREEN SAYS SO ─────────────────────────────┐
 * │ `tenants.status` carries the whole `C4.4` state machine, so every row here is a live one     │
 * │ read through an audited cross-tenant elevation, and the tab counts are facts.                │
 * │                                                                                              │
 * │ Opening an application and acting on it is `M-036`. The Review button is therefore disabled  │
 * │ and labelled, not hidden: an operator who cannot find the action assumes the screen is       │
 * │ broken, and a live-looking button that does nothing is worse than both.                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ OLDEST FIRST, AND THE ORDER IS THE FEATURE ────────────────────────────────────────────────┐
 * │ Newest-first is the default everywhere else and would be wrong here. A queue sorted newest   │
 * │ first starves its own tail: the application waiting nineteen days sinks further every time   │
 * │ somebody else applies, and nobody ever decides to ignore it.                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  DataTable,
  FilterTabs,
  Pagination,
  PageHeader,
  Panel,
  StateBoundary,
  TableSkeleton,
  toSurfaceState,
  type Column,
} from '@gymmap/ui';

import { t } from '../shared/i18n/index.ts';
import {
  AWAITING_STATUSES,
  platformGyms,
  type GymRow,
  type GymStatus,
} from '../shared/api/admin.ts';
import { toProblem } from '../shared/api/client.ts';
import { GYM_STATUS_LABEL, statusTone } from './status-pill.tsx';

const PAGE_SIZE = 10;

/** The tabs, and the statuses each admits. `all` is the three a human owns. */
const TABS: ReadonlyArray<{ id: string; statuses: readonly GymStatus[] }> = [
  { id: 'all', statuses: AWAITING_STATUSES },
  { id: 'INFO_REQUESTED', statuses: ['INFO_REQUESTED'] },
  { id: 'UNDER_REVIEW', statuses: ['UNDER_REVIEW'] },
  { id: 'SUBMITTED', statuses: ['SUBMITTED'] },
  { id: 'APPROVED', statuses: ['APPROVED'] },
  { id: 'REJECTED', statuses: ['REJECTED'] },
];

export function ApprovalQueueRoute() {
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin', 'gyms', 'all'],
    queryFn: () => platformGyms(),
    refetchInterval: 30_000,
  });

  const rows = useMemo(() => {
    const admitted = TABS.find((entry) => entry.id === tab)?.statuses ?? AWAITING_STATUSES;
    return (query.data?.gyms ?? [])
      .filter((gym) => admitted.includes(gym.status))
      .sort((a, b) => b.waiting_days - a.waiting_days);
  }, [query.data, tab]);

  const counts = useMemo(() => {
    const gyms = query.data?.gyms ?? [];
    return Object.fromEntries(
      TABS.map((entry) => [
        entry.id,
        gyms.filter((gym) => entry.statuses.includes(gym.status)).length,
      ]),
    );
  }, [query.data]);

  const state = toSurfaceState(query, {
    // Emptiness is judged on the FILTERED rows, not on the response. A tab with no matches is
    // empty even though the request succeeded and returned twenty-three gyms.
    isEmpty: () => rows.length === 0,
    emptyReason: () => (tab === 'all' ? 'no-records' : 'filtered-out'),
    toProblem,
  });

  const columns: readonly Column<GymRow>[] = [
    {
      key: 'gym',
      flexible: true,
      header: t('adm.queue.col.applicant'),
      cell: (gym) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-content">{gym.trading_name ?? gym.legal_name}</p>
          <p className="truncate text-xs text-content-muted">
            {[gym.city, gym.state].filter(Boolean).join(', ') || gym.legal_name}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('adm.queue.col.type'),
      secondary: true,
      cell: (gym) => (
        <span className="text-xs capitalize">
          {gym.entity_type.toLowerCase().replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'applied',
      header: t('adm.queue.col.applied'),
      secondary: true,
      cell: (gym) => (
        <div>
          <p className="text-xs">{new Date(gym.created_at).toLocaleDateString('en-IN')}</p>
          {/* The age, not just the date. "19 days ago" is the number an operator triages on;
              the date is what they quote when they follow it up. */}
          <p className="text-xs text-content-muted">
            {gym.waiting_days} {t('adm.queue.daysAgo')}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('adm.gyms.col.status'),
      cell: (gym) => <Badge tone={statusTone(gym.status)}>{GYM_STATUS_LABEL[gym.status]}</Badge>,
    },
    {
      key: 'actions',
      header: t('adm.queue.col.actions'),
      align: 'right',
      cell: () => (
        // Disabled AND titled. M-036 delivers the decision surface; until then the control is
        // present so the screen reads correctly, and inert so nobody believes they acted.
        <Button size="sm" disabled>
          {t('adm.queue.review')}
        </Button>
      ),
    },
  ];

  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader title={t('adm.queue.title')} subtitle={t('adm.queue.subtitle')} />

      <div className="mt-stack-md">
        <FilterTabs
          label={t('adm.gyms.col.status')}
          activeId={tab}
          onSelect={(next) => {
            setTab(next);
            // Back to page one. Staying on page 4 of a filter that now has one page shows an
            // empty table and reads as "no results".
            setPage(1);
          }}
          tabs={TABS.map((entry) => {
            const count = counts[entry.id];
            return {
              id: entry.id,
              label:
                entry.id === 'all'
                  ? t('adm.gyms.filterAll')
                  : GYM_STATUS_LABEL[entry.statuses[0] as GymStatus],
              // Spread rather than `count: counts[...]`. `exactOptionalPropertyTypes` is on, so
              // an explicit `undefined` is NOT the same as an absent key — and the distinction is
              // the one `FilterTab` relies on to tell "no count yet" from "a count of zero".
              ...(count === undefined ? {} : { count }),
            };
          })}
        />
      </div>

      <Panel className="mt-stack-sm">
        <StateBoundary
          state={state}
          regionLabelText={t('adm.queue.title')}
          loadingFallback={<TableSkeleton rows={6} />}
          onRetry={() => {
            void query.refetch();
          }}
          emptyState={(reason) => ({
            title: reason === 'filtered-out' ? t('adm.queue.emptyFiltered') : t('adm.queue.empty'),
            bodyText:
              reason === 'filtered-out'
                ? t('adm.queue.emptyFilteredBody')
                : t('adm.queue.emptyBody'),
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
                caption={t('adm.queue.subtitle')}
                minWidth="44rem"
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

      <p className="mt-stack-lg max-w-prose rounded-card border border-dashed border-subtle bg-surface-sunken p-inset-md text-xs text-content-muted">
        {t('adm.queue.reviewNote')}
      </p>
    </>
  );
}

export const PAGE_LABELS = {
  showing: t('adm.page.showing'),
  to: t('adm.page.to'),
  of: t('adm.page.of'),
  results: t('adm.page.results'),
  previous: t('adm.page.previous'),
  next: t('adm.page.next'),
};
