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
  BulkBar,
  Button,
  ConfirmDialog,
  DataTable,
  Dropdown,
  FilterTabs,
  Pagination,
  PageHeader,
  Panel,
  ToastStack,
  useToasts,
  StateBoundary,
  TableSkeleton,
  toSurfaceState,
  type Column,
} from '@gymmap/ui';

import { t } from '../shared/i18n/index.ts';
import { formatBps, platformGyms, type GymRow, type GymStatus } from '../shared/api/admin.ts';
import { toProblem } from '../shared/api/client.ts';
import { GYM_STATUS_LABEL, statusTone } from './status-pill.tsx';
import { REASON_FLOOR } from '../shared/reason/reason.ts';
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
  const toasts = useToasts();

  /**
   * The selection, held HERE and not in the table.
   *
   * It survives paging and filtering by design: an operator narrows to Bengaluru, ticks four gyms,
   * clears the filter, ticks two more. A selection reset by the parent's re-render - which a
   * 60-second refetch causes - is a selection nobody rebuilds.
   */
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  /** The gym awaiting a suspend confirmation, or `null`. */
  const [suspending, setSuspending] = useState<GymRow | null>(null);

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

          {/* +- THE MENU LISTS ALL EIGHT ACTIONS AND DISABLES SEVEN -----------------------------+
              | 6.4 enumerates the eight administrative actions of `FR-ADMN-01`. None of their     |
              | endpoints exists yet (`M-114`), so every item names its milestone in the hint      |
              | rather than being hidden.                                                        |
              |                                                                                |
              | Hiding them would make the menu look complete and lead an operator to conclude    |
              | the platform cannot suspend a gym at all. Showing them disabled with the reason    |
              | answers the question in place - and the enumeration itself is useful: it is the    |
              | list of what an administrator will be able to do.                                 |
              |                                                                                |
              | Suspend is the exception. It OPENS its dialog, because the dialog is where `DC3`'s |
              | name-typing and the `DC2` consequence line live, and those are the parts worth     |
              | getting right before the endpoint arrives. The dialog says what it cannot do yet.  |
              +---------------------------------------------------------------------------------+ */}
          <Dropdown
            label={t('adm.gyms.moreActions')}
            items={[
              {
                id: 'reinstate',
                label: t('adm.gyms.action.reinstate'),
                disabled: true,
                hint: 'M-114',
                onSelect: () => undefined,
              },
              {
                id: 'tier',
                label: t('adm.gyms.action.tier'),
                disabled: true,
                hint: 'M-114',
                onSelect: () => undefined,
              },
              {
                id: 'commission',
                label: t('adm.gyms.action.commission'),
                disabled: true,
                // Blocked on a decision, not only on code: KL-006 leaves whether tier deltas apply
                // to the renewal rate unanswered, and a commission screen has to take a side.
                hint: 'KL-006',
                onSelect: () => undefined,
              },
              {
                id: 'reverify',
                label: t('adm.gyms.action.reverify'),
                disabled: true,
                hint: 'M-114',
                onSelect: () => undefined,
              },
              // The two destructive actions come LAST, below the divider the menu draws above the
              // first of them. A Suspend sitting at the top of a menu an operator opens sixty times
              // a day is a mis-click waiting for a busy afternoon; convention puts it out of the
              // path of the reach for "Change tier".
              {
                id: 'suspend',
                label: t('adm.gyms.action.suspend'),
                destructive: true,
                // Only for a gym that is actually listed. Suspending a rejected application is not
                // a thing, and offering it invites the question of what it would mean.
                ...(gym.status === 'APPROVED'
                  ? {}
                  : { disabled: true, hint: t('adm.gyms.action.notListed') }),
                onSelect: () => {
                  setSuspending(gym);
                },
              },
              {
                id: 'close',
                label: t('adm.gyms.action.close'),
                destructive: true,
                disabled: true,
                hint: 'M-114',
                onSelect: () => undefined,
              },
            ]}
          />
        </div>
      ),
    },
  ];

  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title={t('adm.gyms.title')}
        subtitle={t('adm.gyms.subtitle')}
        actions={
          <>

        {/* Both inert, and both present. Filters beyond status need the query parameters the
            register endpoint does not take yet; Export needs a generated file, an audit row for
            who exported the platform's commercial terms, and a decision about what a CSV of every
            gym's GSTIN is allowed to contain (BR-DAT-06). Neither is a button away. */}
            <Button size="sm" disabled>
              {t('adm.gyms.filters')}
            </Button>
            <Button size="sm" disabled>
              {t('adm.gyms.export')}
            </Button>
          </>
        }
      />

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
                // Required once selection is on: a checkbox announced as "Select row" thirty times
                // tells a screen-reader user which of the thirty they ticked, which is none of them.
                rowLabel={(gym) => gym.trading_name ?? gym.legal_name}
                caption={t('adm.gyms.subtitle')}
                selection={{
                  selected,
                  onChange: setSelected,
                  labels: {
                    selectAll: t('adm.gyms.selectAll'),
                    selectRow: t('adm.gyms.selectRow'),
                  },
                }}
              />
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                rowCount={rows.length}
                onPage={setPage}
                labels={PAGE_LABELS}
              />

              {/* +- WHY THERE IS NO BULK APPROVE HERE, AND NEVER WILL BE ----------------------+
                  | `BR-GYM-01` requires a HUMAN to approve each gym before it is listed, and    |
                  | `OBJ-03` is the promise that rests on it. A bulk approve is the one bulk     |
                  | action that would let thirty gyms be listed by one click on a checkbox        |
                  | column - which is precisely the verification this platform sells, skipped.   |
                  |                                                                            |
                  | So the bulk actions here are the ones that do not decide anything: export,   |
                  | and assignment once there is somebody to assign to.                          |
                  +---------------------------------------------------------------------------+ */}
              <BulkBar
                count={selected.size}
                onClear={() => {
                  setSelected(new Set());
                }}
                labels={{
                  selected: t('adm.gyms.bulkSelected'),
                  clear: t('adm.gyms.bulkClear'),
                  region: t('adm.gyms.bulkRegion'),
                }}
              >
                <Button size="sm" disabled>
                  {t('adm.gyms.bulkExport')}
                </Button>
                <Button size="sm" disabled>
                  {t('adm.gyms.bulkAssign')}
                </Button>
              </BulkBar>
            </>
          )}
        </StateBoundary>
      </Panel>

      {/* +- DESTRUCTIVE ACTION 3 OF THE ELEVEN, WITH DC3's NAME-TYPING ---------------------+
          | 5.2 requires the consequence line to state the active member count, the unsettled  |
          | balance, that members KEEP gym access and that the listing hides. Two of those      |
          | four figures do not exist yet (`M-114`), and `DC1` forbids counting them in the     |
          | client - so the dialog states the two facts that are certain and says plainly that  |
          | the figures are missing. A consequence line with an invented member count would be  |
          | worse than one that admits the gap: an operator would act on the number.            |
          +---------------------------------------------------------------------------------+ */}
      <ConfirmDialog
        open={suspending !== null}
        onClose={() => {
          setSuspending(null);
        }}
        onConfirm={() => {
          const gym = suspending;
          setSuspending(null);
          if (gym === null) return;
          // No mutation to call. `danger` rather than `info` because nothing happened and the
          // operator believed something would - and a danger toast does not expire.
          toasts.push('danger', t('adm.gyms.suspendUnavailable'));
        }}
        title={t('adm.gyms.suspendTitle').replace('{g}', suspending?.legal_name ?? '')}
        description={t('adm.gyms.suspendBody')}
        // DC5: reversible, and the reverse is named. 6.4's Reinstate row says the listing
        // republishes and payouts resume, so this states that rather than "you can undo it".
        reversibility={{ kind: 'REVERSIBLE', text: t('adm.gyms.suspendReversible') }}
        reason={{
          label: t('adm.reason.label'),
          hint: t('adm.reason.hint'),
          minLength: REASON_FLOOR.general,
        }}
        // DC3. The LEGAL name, not the trading name: it is the one on the contract, and it is the
        // string that differs between two gyms with similar shopfronts.
        typeToConfirm={{
          expected: suspending?.legal_name ?? '',
          label: t('adm.gyms.suspendTypeName'),
        }}
        labels={{
          confirm: t('adm.gyms.action.suspend'),
          cancel: t('adm.action.cancel'),
          close: t('adm.action.close'),
          charactersShort: t('adm.reason.short'),
        }}
      />

      <ToastStack
        messages={toasts.messages}
        onDismiss={toasts.dismiss}
        dismissLabel={t('adm.action.dismiss')}
      />
    </>
  );
}
