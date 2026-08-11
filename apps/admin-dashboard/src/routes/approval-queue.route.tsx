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

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
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
import { AgeCell, SlaChip } from './sla-chip.tsx';

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
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin', 'gyms', 'all'],
    queryFn: () => platformGyms(),
    refetchInterval: 30_000,
  });

  /** Which column orders the queue. `age` by default — §6.2's `submitted_at:asc`. */
  const [sortKey, setSortKey] = useState('age');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const rows = useMemo(() => {
    const admitted = TABS.find((entry) => entry.id === tab)?.statuses ?? AWAITING_STATUSES;
    return (
      (query.data?.gyms ?? [])
        .filter((gym) => admitted.includes(gym.status))
        // `submitted_at:asc` is 6.2's default and "oldest first is the queue's whole point": a
        // queue sorted newest-first starves its own tail, because the application waiting nineteen
        // days sinks further every time somebody else applies and nobody ever decides to ignore it.
        //
        // Sorted on `age_hours` rather than `waiting_days` so two applications that arrived on the
        // same day still order correctly — whole days tie for everything inside a 24-hour window,
        // which on a 72-hour SLA is a third of it.
        .sort((a, b) => {
          const flip = sortDirection === 'desc' ? 1 : -1;
          if (sortKey === 'gym') {
            return (
              flip * (b.trading_name ?? b.legal_name).localeCompare(a.trading_name ?? a.legal_name)
            );
          }
          if (sortKey === 'status') return flip * b.status.localeCompare(a.status);
          // `age` — and the default. Whole hours, not whole days: days tie for everything inside a
          // 24-hour window, which on a 72-hour SLA is a third of it.
          return flip * ((b.age_hours ?? 0) - (a.age_hours ?? 0));
        })
    );
  }, [query.data, tab, sortKey, sortDirection]);

  /**
   * The queue summary — 6.2 region 1, computed over the FILTERED set as the spec requires.
   *
   * Over the filtered set because that is what the officer is looking at: a breach count for the
   * whole platform sitting above a list narrowed to one city answers a question nobody asked.
   *
   * `unassigned` and the workload strip (region 2) are absent rather than faked: an assignee exists
   * only once the applications table does, and inventing a distribution over the one field the
   * spec computes differently from everything else would be the least honest thing on the screen.
   */
  const summary = useMemo(() => {
    const withSla = rows.filter((gym) => (gym.sla ?? null) !== null);
    return {
      open: rows.length,
      breached: withSla.filter((gym) => gym.sla?.state === 'BREACHED').length,
      approaching: withSla.filter((gym) => gym.sla?.state === 'APPROACHING').length,
      paused: withSla.filter((gym) => gym.sla?.state === 'PAUSED').length,
      // `age_hours`, not `hours_remaining`: 6.2's figure is "oldest open hours", which is an age.
      oldestHours: rows.reduce((oldest, gym) => Math.max(oldest, gym.age_hours ?? 0), 0),
    };
  }, [rows]);

  const counts = useMemo(() => {
    const gyms = query.data?.gyms ?? [];
    return Object.fromEntries(
      TABS.map((entry) => [
        entry.id,
        gyms.filter((gym) => entry.statuses.includes(gym.status)).length,
      ]),
    );
  }, [query.data]);

  /**
   * The keyboard model — 6.2: "`/` focuses search · `j`/`k` move the focused row · `Enter` opens".
   *
   * +- WHY THIS IS NOT A NICETY ----------------------------------------------------------------+
   * | `AdminDashboard.md` 1.1: Anita "opens this first and returns to it 30-60 times a day". At   |
   * | that frequency the mouse trip to each row is the job. `AX2` makes the console keyboard-      |
   * | first for exactly this screen.                                                             |
   * +-------------------------------------------------------------------------------------------+
   *
   * The listener is on the TABLE region rather than the window, so `j` typed into a search box is
   * the letter j. A global handler that has to guess whether the user is typing is the bug every
   * hand-rolled keyboard model ships with.
   */
  const [focused, setFocused] = useState(0);
  const tableRegion = useRef<HTMLDivElement>(null);

  // Clamped when the row count shrinks, so changing a filter cannot leave the cursor past the end.
  useEffect(() => {
    setFocused((current) => Math.min(current, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const state = toSurfaceState(query, {
    // Emptiness is judged on the FILTERED rows, not on the response. A tab with no matches is
    // empty even though the request succeeded and returned twenty-three gyms.
    isEmpty: () => rows.length === 0,
    emptyReason: () => (tab === 'all' ? 'no-records' : 'filtered-out'),
    toProblem,
  });

  const columns: readonly Column<GymRow>[] = [
    // 6.2's column order, and it is deliberate: the SLA is the first thing read because it decides
    // which row is opened. Putting the name first would make this a directory rather than a queue.
    {
      key: 'sla',
      header: t('adm.sla.header'),
      cell: (gym) => <SlaChip gym={gym} />,
    },
    {
      key: 'age',
      header: t('adm.queue.col.age'),
      align: 'right',
      sortKey: 'age',
      cell: (gym) => <AgeCell gym={gym} />,
    },
    {
      key: 'gym',
      flexible: true,
      header: t('adm.queue.col.applicant'),
      sortKey: 'gym',
      cell: (gym) => (
        <div className="flex min-w-0 items-center gap-inline-sm">
          {/* Initials, coloured from the name. Not decoration: down thirty rows a mark that keeps
              its colour per gym is what lets the eye recognise a row it has already looked at,
              which is the whole difficulty of a queue you return to sixty times a day. */}
          <span
            aria-hidden="true"
            className={`grid h-[2rem] w-[2rem] shrink-0 place-items-center rounded-full text-xs font-semibold ${initialsTone(
              gym.id,
            )}`}
          >
            {gymInitials(gym.trading_name ?? gym.legal_name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-content">
              {gym.trading_name ?? gym.legal_name}
            </span>
            <span className="block truncate text-xs text-content-muted">
              {[gym.city, gym.state].filter(Boolean).join(', ') || gym.legal_name}
            </span>
          </span>
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
        // The date is what an officer QUOTES when they follow an application up; the age is what
        // they triage on and it has its own column now.
        <span className="text-xs">{new Date(gym.created_at).toLocaleDateString('en-IN')}</span>
      ),
    },
    {
      key: 'status',
      header: t('adm.gyms.col.status'),
      sortKey: 'status',
      cell: (gym) => <Badge tone={statusTone(gym.status)}>{GYM_STATUS_LABEL[gym.status]}</Badge>,
    },
    {
      key: 'actions',
      header: t('adm.queue.col.actions'),
      align: 'right',
      cell: (gym) => (
        // Live now: `SCR-ADM-003` exists, and 6.2 is explicit that "opening an application does not
        // change its status" — so this navigates and nothing else. The DECISION is still M-036, and
        // the review screen's action bar says so where the decision would be made.
        <Link
          to={`/approvals/${gym.id}`}
          // The same shape as `Button variant="outline-brand"`, as a link — because it NAVIGATES.
          // A `<button>` that changes the URL breaks middle-click, ctrl-click and "open in new tab",
          // which on a queue an officer works through is the interaction they use most.
          className="gm-hit-target inline-flex items-center rounded-full border border-brand-subtle bg-surface px-inset-md py-inset-2xs text-xs font-medium text-content-brand transition-colors duration-fast ease-standard hover:border-brand hover:bg-surface-brand-subtle"
        >
          {t('adm.queue.review')}
        </Link>
      ),
    },
  ];

  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title={t('adm.queue.title')}
        subtitle={t('adm.queue.subtitle')}
        meta={<p className="text-xs text-content-muted">{t('adm.queue.kbd')}</p>}
      />

      <QueueSummary summary={summary} pending={query.isPending} />

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
              {/* `tabIndex` so the region can hold focus and receive the keys; the hint in the
                  header tells an operator the region is there before they hunt for it. */}
              <div
                ref={tableRegion}
                tabIndex={-1}
                onKeyDown={(event) => {
                  if (event.key === 'j' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    setFocused((current) => Math.min(current + 1, paged.length - 1));
                  } else if (event.key === 'k' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    setFocused((current) => Math.max(current - 1, 0));
                  } else if (event.key === 'Enter') {
                    const gym = paged[focused];
                    // 6.2: "Opening an application does not change its status." This navigates and
                    // nothing else — assignment and UNDER_REVIEW are different facts.
                    if (gym !== undefined) navigate(`/approvals/${gym.id}`);
                  }
                }}
                className="outline-none"
              >
                <DataTable
                  columns={columns}
                  rows={paged}
                  rowKey={(gym) => gym.id}
                  caption={t('adm.queue.subtitle')}
                  minWidth="56rem"
                  // The sort is REPORTED, not performed by the table — see `Column.sortKey`. The
                  // route holds the order because it holds the whole result set; a table that
                  // sorted its ten visible rows would put the largest of ten arbitrary rows on top.
                  sort={{
                    key: sortKey,
                    direction: sortDirection,
                    label: t('adm.queue.sortBy'),
                    onSort: (key) => {
                      if (key === sortKey) {
                        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
                      } else {
                        setSortKey(key);
                        setSortDirection('desc');
                      }
                      setPage(1);
                    },
                  }}
                />
              </div>
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

/**
 * `§6.2` region 1 — the summary, as labelled cells rather than a sentence.
 *
 * ┌─ IT WAS A RUN-ON LINE, AND A QUEUE SUMMARY IS SCANNED, NOT READ ────────────────────────────┐
 * │ "OPEN 30 BREACHED 26 APPROACHING 1 PAUSED 2 OLDEST 5668h" put five label-number pairs on one │
 * │ baseline in the same size, so finding the breach count meant reading the whole line. Anita     │
 * │ opens this screen 30–60 times a day and looks at one figure first.                            │
 * │                                                                                              │
 * │ Now each is a cell: a small label above a large figure, the figure carrying the severity ink. │
 * │ The tint is redundant to the label, so nothing depends on it being perceived (`AX9`).          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
function QueueSummary({
  summary,
  pending,
}: {
  readonly summary: {
    readonly open: number;
    readonly breached: number;
    readonly approaching: number;
    readonly paused: number;
    readonly oldestHours: number;
  };
  readonly pending: boolean;
}) {
  const cells: ReadonlyArray<{
    key: string;
    label: string;
    value: string;
    ink: string;
    tone: string;
  }> = [
    {
      key: 'open',
      label: t('adm.queue.summary.open'),
      value: String(summary.open),
      ink: 'text-content',
      tone: 'bg-surface-subtle text-content-secondary',
    },
    {
      key: 'breached',
      label: t('adm.queue.summary.breached'),
      value: String(summary.breached),
      // Only INK the figure when it is non-zero. A permanent red 0 is how a strip stops being read.
      ink: summary.breached > 0 ? 'text-content-danger' : 'text-content-muted',
      tone: 'bg-surface-danger-subtle text-content-danger',
    },
    {
      key: 'approaching',
      label: t('adm.queue.summary.approaching'),
      value: String(summary.approaching),
      ink: summary.approaching > 0 ? 'text-content-warning' : 'text-content-muted',
      tone: 'bg-surface-warning-subtle text-content-warning',
    },
    {
      key: 'paused',
      label: t('adm.queue.summary.paused'),
      value: String(summary.paused),
      ink: summary.paused > 0 ? 'text-content-info' : 'text-content-muted',
      tone: 'bg-surface-info-subtle text-content-info',
    },
    {
      key: 'oldest',
      label: t('adm.queue.summary.oldest'),
      value: `${String(summary.oldestHours)}${t('adm.queue.summary.hours')}`,
      ink: 'text-content-secondary',
      tone: 'bg-surface-subtle text-content-secondary',
    },
  ];

  return (
    <section
      aria-label={t('adm.queue.summary.region')}
      className="mt-stack-md rounded-card border border-subtle bg-surface p-inset-md shadow-sm dark:bg-surface-raised dark:shadow-none"
    >
      <div className="grid gap-inline-md sm:grid-cols-3 xl:grid-cols-6">
        {cells.map((cell) => (
          <div key={cell.key} className="flex items-center justify-between gap-inline-sm">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wider text-content-muted">
                {cell.label}
              </p>
              <p className={`mt-stack-2xs text-2xl font-bold tabular-nums ${cell.ink}`}>
                {pending ? '\u2014' : cell.value}
              </p>
            </div>
            <span
              aria-hidden="true"
              className={`grid h-[2rem] w-[2rem] shrink-0 place-items-center rounded-control ${cell.tone}`}
            >
              <span className="h-[0.5rem] w-[0.5rem] rounded-full bg-current" />
            </span>
          </div>
        ))}

        {/* Region 2 of §6.2, named rather than faked — an assignee exists only once the
            applications table does. It shares the grid so the strip has one rhythm. */}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-content-muted">
            {t('adm.queue.summary.workload')}
          </p>
          <p className="mt-stack-2xs text-xs text-content-muted">
            {t('adm.queue.workloadPending')}
          </p>
        </div>
      </div>
    </section>
  );
}

/** Up to two initials from a gym's name. `Iron Fitness Bengaluru` -> `IF`. */
function gymInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '');

  if (words.length >= 2) return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * A stable tint per gym, derived from its id.
 *
 * ┌─ THE COLOUR MEANS NOTHING, AND THAT IS DELIBERATE ─────────────────────────────────────────┐
 * │ It is an identity aid, not a status: the same gym is the same colour every time, and no      │
 * │ colour here implies anything about the application. Which is why the palette avoids the      │
 * │ status families — a red avatar beside an amber SLA chip would read as a second severity.     │
 * │                                                                                            │
 * │ Derived from the id rather than the name so a rename does not recolour a row an officer has  │
 * │ learned to recognise.                                                                       │
 * └────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const AVATAR_TONES = [
  'bg-surface-brand-subtle text-content-brand',
  'bg-surface-info-subtle text-content-info',
  'bg-surface-subtle text-content-secondary',
] as const;

function initialsTone(id: string): string {
  let hash = 0;
  for (const character of id) hash = (hash + character.charCodeAt(0)) % 997;
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? AVATAR_TONES[0];
}

export const PAGE_LABELS = {
  showing: t('adm.page.showing'),
  to: t('adm.page.to'),
  of: t('adm.page.of'),
  results: t('adm.page.results'),
  previous: t('adm.page.previous'),
  next: t('adm.page.next'),
};
