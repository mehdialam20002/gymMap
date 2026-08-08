/**
 * The composed, domain-free patterns — `Components.md` §2, layer "pattern".
 *
 * ┌─ WHY THESE MOVED OUT OF THE ADMIN APP ──────────────────────────────────────────────────────┐
 * │ The approval queue, the gym register and the account list are three tables with the same     │
 * │ head, the same filter tabs, the same pagination and the same status pill. Written in the app │
 * │ they were three copies, and the fourth screen would have made four — at which point they     │
 * │ drift, and a status renders amber on one screen and grey on the next.                        │
 * │                                                                                              │
 * │ `A-04` already says the shared layer lives here. `§1.3`'s no-reach-past rule only means      │
 * │ something once there is something to reach past.                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ DOMAIN-FREE, AND THAT IS ENFORCED BY WHAT IS ABSENT ───────────────────────────────────────┐
 * │ No `GymRow`, no `tenant_status_enum`, no money formatting (`R3` — `@gymmap/utils` is not     │
 * │ importable here, and a second Indian-grouping implementation would diverge from the PDF      │
 * │ renderer, which `LAUNCH_MARKET_INDIA` §2 calls a trust defect). `Money` RECEIVES a string.    │
 * │ Tone is an abstract word — `success`, `warning` — not a status name.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { ReactNode } from 'react';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

/** The subtle fill and its matching ink, per tone. One map — `Badge` had grown a second copy. */
const TONE_SUBTLE: Record<Tone, string> = {
  neutral: 'bg-surface-subtle text-content-secondary',
  brand: 'bg-surface-brand-subtle text-content-brand',
  success: 'bg-surface-success-subtle text-content-success',
  warning: 'bg-surface-warning-subtle text-content-warning',
  danger: 'bg-surface-danger-subtle text-content-danger',
  info: 'bg-surface-info-subtle text-content-info',
};

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function Panel({
  title,
  children,
  action,
  tag,
  className = '',
}: {
  readonly title?: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
  /** A short marker beside the title — "Sample", "Beta". Rendered in warning tone. */
  readonly tag?: string;
  readonly className?: string;
}) {
  return (
    <section
      className={`rounded-card border border-subtle bg-surface shadow-sm dark:bg-surface-raised dark:shadow-none p-inset-md shadow-xs dark:shadow-none ${className}`}
    >
      {(title !== undefined || action !== undefined) && (
        <div className="flex flex-wrap items-center justify-between gap-inline-sm">
          <div className="flex min-w-0 items-center gap-inline-xs">
            {title !== undefined && (
              <h2 className="truncate text-sm font-semibold text-content">{title}</h2>
            )}
            {tag !== undefined && (
              <span className="shrink-0 rounded-control border border-warning px-inset-2xs text-xs font-medium text-content-warning">
                {tag}
              </span>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={title === undefined ? '' : 'mt-stack-sm'}>{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

/**
 * A status marker. Always carries its WORD — colour is a second channel, never the only one.
 *
 * `AX8`, and the practical reason: roughly one man in twelve cannot separate the red from the
 * green, and "approved" versus "rejected" is not a distinction to leave to hue on a screen that
 * adjudicates a business.
 */
export function Badge({
  children,
  tone = 'neutral',
  dot = true,
}: {
  readonly children: ReactNode;
  readonly tone?: Tone;
  /**
   * The leading dot. On by default.
   *
   * ┌─ A DOT IS NOT DECORATION HERE ────────────────────────────────────────────────────────────┐
   * │ `AX8` forbids colour as the sole carrier of meaning, and the WORD already satisfies that.  │
   * │ What the dot buys is scanning: down a column of thirty rows the eye finds a coloured mark  │
   * │ at a fixed x-position far faster than it reads thirty words, and the word is still there   │
   * │ for the row it stops on. Turn it off where the badge is already alone on its line.          │
   * └───────────────────────────────────────────────────────────────────────────────────────────┘
   */
  readonly dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-inline-2xs whitespace-nowrap rounded-full px-inset-sm py-inset-2xs text-xs font-medium ${TONE_SUBTLE[tone]}`}
    >
      {dot && (
        <span aria-hidden="true" className="h-[0.375rem] w-[0.375rem] shrink-0 rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

export function Button({
  children,
  onClick,
  variant = 'secondary',
  type = 'button',
  disabled = false,
  size = 'md',
  icon,
}: {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  /**
   * `outline-brand` and `outline-danger` are the row-action variants.
   *
   * ┌─ WHY A ROW ACTION IS OUTLINED AND NOT FILLED ─────────────────────────────────────────────┐
   * │ A table with ten filled buttons down its right edge has ten primary actions, which is the  │
   * │ same as none: the eye cannot find the one that matters and the colour stops meaning        │
   * │ "do this". An outlined pill reads as available without competing with the row's content,   │
   * │ and it still carries the tone — so a destructive row action looks destructive.              │
   * └───────────────────────────────────────────────────────────────────────────────────────────┘
   */
  readonly variant?:
    | 'primary'
    | 'secondary'
    | 'ghost'
    | 'danger'
    | 'outline-brand'
    | 'outline-danger';
  readonly type?: 'button' | 'submit';
  readonly disabled?: boolean;
  readonly size?: 'sm' | 'md';
  /** A leading glyph. Decorative — the label always carries the meaning. */
  readonly icon?: ReactNode;
}) {
  const VARIANT = {
    primary: 'bg-brand-solid text-content-on-brand hover:bg-brand-solid-hover',
    secondary:
      'border border-subtle bg-surface text-content-secondary hover:border-strong hover:text-content',
    ghost: 'text-content-secondary hover:text-content',
    danger: 'border border-danger text-content-danger hover:bg-surface-danger-subtle',
    'outline-brand':
      'border border-brand-subtle bg-surface text-content-brand hover:border-brand hover:bg-surface-brand-subtle',
    'outline-danger':
      'border border-danger-subtle bg-surface text-content-danger hover:border-danger hover:bg-surface-danger-subtle',
  } as const;

  const SIZE = {
    sm: 'px-inset-sm py-inset-2xs text-xs',
    md: 'px-inset-md py-inset-xs text-sm',
  } as const;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      {...(variant === 'primary' ? { 'data-on-solid': 'true' } : {})}
      // `rounded-full`. Every control in the reference is a pill, and a pill is also the shape
      // that reads as "button" at 24px tall where a 12px radius reads as a tag.
      className={`gm-hit-target inline-flex items-center justify-center gap-inline-2xs whitespace-nowrap rounded-full font-medium transition-colors duration-fast ease-standard disabled:cursor-not-allowed disabled:border-subtle disabled:bg-surface-disabled disabled:text-content-disabled ${VARIANT[variant]} ${SIZE[size]}`}
    >
      {icon !== undefined && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// FilterTabs
// ---------------------------------------------------------------------------

export interface FilterTab {
  readonly id: string;
  readonly label: string;
  /** Omit where the count is unknown. A tab shows a real number or none — never a `0` placeholder. */
  readonly count?: number;
}

/**
 * Tabs over a list, with counts.
 *
 * Buttons rather than a `<select>`: every option is visible and one keystroke away, which is what
 * `AX2`'s keyboard-first requirement is asking for. A select needs three interactions to change
 * one filter and hides the counts until it is opened.
 */
export function FilterTabs({
  tabs,
  activeId,
  onSelect,
  label,
}: {
  readonly tabs: readonly FilterTab[];
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
  readonly label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-inline-2xs">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              onSelect(tab.id);
            }}
            // `aria-pressed`, not colour alone. A tab whose only "on" signal is a tint is
            // invisible to a screen reader and to anyone who cannot separate the two shades.
            aria-pressed={active}
            // A soft FILL for the active tab, not a coloured outline. Six outlined pills in a row
            // all compete; one filled pill among five quiet ones is unambiguous at a glance.
            className={`gm-hit-target flex items-center gap-inline-2xs rounded-full border px-inset-md py-inset-2xs text-xs transition-colors duration-fast ease-standard ${
              active
                ? 'border-brand-subtle bg-surface-brand-subtle font-semibold text-content-brand'
                : 'border-subtle bg-surface text-content-secondary hover:border-strong hover:text-content'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              // The count in its own chip, so "Approved 193" reads as a label and a number rather
              // than as the phrase "Approved 193".
              <span
                className={`rounded-full px-inset-2xs tabular-nums ${
                  active ? 'bg-surface text-content-brand' : 'bg-surface-subtle text-content-muted'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export interface Column<T> {
  readonly key: string;
  readonly header: string;
  readonly align?: 'right';
  readonly cell: (row: T) => ReactNode;
  /** Hidden below `lg`. For columns that are useful but not load-bearing on a narrow screen. */
  readonly secondary?: boolean;
  /**
   * The column that absorbs leftover width and truncates. At most one per table.
   *
   * A `<td>` sizes to its content by default, so `truncate` inside one does nothing — the cell
   * simply grows and pushes the table wider than its container. `w-full max-w-[0]` is the
   * standard fix: the cell claims the remaining space and is then allowed to be narrower than its
   * text, which is what lets the overflow actually clip.
   *
   * The ARBITRARY value is required. `theme.maxWidth` here is `{prose, form, ui, container, full}`
   * — there is no `0` step, so bare `max-w-0` resolves to nothing and Tailwind's JIT errors on it
   * rather than dropping it quietly, which took the whole dev server down.
   *
   * Without it a long legal name adds a few pixels, the table overflows by that much, and a
   * horizontal scrollbar appears under a table that visibly has room.
   */
  readonly flexible?: boolean;
  /**
   * The key to report when this header is clicked. Omit for a column that cannot be sorted.
   *
   * ┌─ THE TABLE DOES NOT SORT. IT REPORTS THAT A HEADER WAS CLICKED ────────────────────────────┐
   * │ Sorting a page of ten rows in the browser sorts THE PAGE, not the result set — so the top   │
   * │ row after a click is the largest of ten arbitrary rows, which is a wrong answer that looks  │
   * │ like a right one. Every list in this console is server-ordered, and the server is the only  │
   * │ thing that can honour a sort across 263 rows.                                               │
   * │                                                                                           │
   * │ So the caller owns the sort and this component owns the affordance.                          │
   * └───────────────────────────────────────────────────────────────────────────────────────────┘
   */
  readonly sortKey?: string;
}

export interface TableSort {
  readonly key: string;
  readonly direction: 'asc' | 'desc';
  readonly onSort: (key: string) => void;
  /** `{c}` is replaced with the column header, for the button's accessible name. */
  readonly label: string;
}

/**
 * A table. Scrolls inside its own container rather than widening the page.
 *
 * `minWidth` is required and deliberate: without it a six-column table squeezes every cell until
 * the content wraps to three lines each, which is less readable than a horizontal scroll and much
 * harder to notice going wrong.
 */
export interface TableSelection {
  /** The selected row keys. The CALLER owns this state, because it survives pagination. */
  readonly selected: ReadonlySet<string>;
  readonly onChange: (selected: ReadonlySet<string>) => void;
  readonly labels: {
    readonly selectAll: string;
    /** `{n}` is replaced with the row's own name, so each checkbox announces what it selects. */
    readonly selectRow: string;
  };
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowLabel,
  caption,
  minWidth = '52rem',
  selection,
  sort,
}: {
  readonly columns: readonly Column<T>[];
  readonly rows: readonly T[];
  readonly rowKey: (row: T) => string;
  /**
   * A human name for the row. Required WHEN `selection` is passed, because a checkbox whose
   * accessible name is "Select row" thirty times over tells a screen-reader user which of the
   * thirty they have just ticked: none of them.
   */
  readonly rowLabel?: (row: T) => string;
  readonly caption: string;
  readonly minWidth?: string;
  /**
   * Omit for a read-only table.
   *
   * ┌─ SELECTION IS THE CALLER'S STATE, DELIBERATELY ────────────────────────────────────────┐
   * │ Holding it here would reset it on every re-render the parent causes — a poll landing, a │
   * │ filter tab changing, a page turning. An operator who ticks eight rows and loses them    │
   * │ because a 30-second refetch fired will not tick them again.                              │
   * └────────────────────────────────────────────────────────────────────────────────────────┘
   */
  readonly selection?: TableSelection;
  /** Omit for an unsorted table. See `Column.sortKey`. */
  readonly sort?: TableSort;
}) {
  const keys = rows.map(rowKey);
  // "All" means all rows ON THIS PAGE. A header checkbox that silently selected 263 gyms across 27
  // pages when the operator could see ten of them is how a bulk action hits rows nobody looked at.
  const allOnPage = keys.length > 0 && keys.every((key) => selection?.selected.has(key) === true);

  const toggle = (key: string) => {
    if (selection === undefined) return;
    const next = new Set(selection.selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selection.onChange(next);
  };

  const toggleAll = () => {
    if (selection === undefined) return;
    const next = new Set(selection.selected);
    // Adds or removes only this page's keys, leaving a selection made on another page intact.
    for (const key of keys) {
      if (allOnPage) next.delete(key);
      else next.add(key);
    }
    selection.onChange(next);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <caption className="gm-visually-hidden">{caption}</caption>
        <thead>
          <tr className="border-b border-subtle text-left">
            {selection !== undefined && (
              <th scope="col" className="w-[2.5rem] px-inset-sm py-inset-xs">
                <input
                  type="checkbox"
                  checked={allOnPage}
                  onChange={toggleAll}
                  aria-label={selection.labels.selectAll}
                  className="gm-hit-target h-[1rem] w-[1rem] accent-[--gm-color-brand-solid]"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                {...(sort !== undefined && sort.key === column.sortKey
                  ? { 'aria-sort': sort.direction === 'asc' ? ('ascending' as const) : ('descending' as const) }
                  : {})}
                className={`px-inset-sm py-inset-sm text-xs font-medium uppercase tracking-wider text-content-muted ${
                  column.align === 'right' ? 'text-right' : ''
                } ${column.secondary === true ? 'hidden lg:table-cell' : ''} ${
                  column.flexible === true ? 'w-full' : ''
                }`}
              >
                {sort === undefined || column.sortKey === undefined ? (
                  column.header
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      sort.onSort(column.sortKey ?? '');
                    }}
                    aria-label={sort.label.replace('{c}', column.header)}
                    className={`gm-hit-target inline-flex items-center gap-inline-2xs uppercase tracking-wider transition-colors duration-fast ease-standard hover:text-content ${
                      sort.key === column.sortKey ? 'text-content' : ''
                    }`}
                  >
                    {column.header}
                    {/* The caret shows direction only on the ACTIVE column. A permanent
                        double-arrow on every header is noise that says "sortable" thirty times
                        and "sorted by this" never. */}
                    <span aria-hidden="true" className="text-[0.625rem]">
                      {sort.key === column.sortKey
                        ? sort.direction === 'asc'
                          ? '\u25B2'
                          : '\u25BC'
                        : '\u21C5'}
                    </span>
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const checked = selection?.selected.has(key) === true;

            return (
            <tr
              key={key}
              // The selected row is TINTED, not merely ticked. A checkbox two hundred pixels away
              // from the name it belongs to is not a usable answer to "which rows did I pick".
              className={`border-b border-subtle last:border-0 transition-colors duration-fast ease-standard ${
                checked ? 'bg-surface-brand-subtle' : 'hover:bg-surface-subtle'
              }`}
            >
              {selection !== undefined && (
                <td className="px-inset-sm py-inset-xs align-middle">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      toggle(key);
                    }}
                    aria-label={selection.labels.selectRow.replace(
                      '{n}',
                      rowLabel?.(row) ?? key,
                    )}
                    className="gm-hit-target h-[1rem] w-[1rem] accent-[--gm-color-brand-solid]"
                  />
                </td>
              )}
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-inset-sm py-inset-sm align-middle text-content-secondary ${
                    column.align === 'right' ? 'text-right' : ''
                  } ${column.secondary === true ? 'hidden lg:table-cell' : ''} ${
                    column.flexible === true ? 'w-full max-w-[0]' : ''
                  }`}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/**
 * Page controls, with the range spelled out.
 *
 * "Showing 1 to 10 of 2,456" rather than page numbers alone. An operator filtering a register
 * needs to know how much they are looking at, and a bare "1 2 3 … 246" answers a different
 * question than the one they have.
 */
/**
 * A window of page numbers around the current page, with the ends always present.
 *
 * ┌─ WHY NOT JUST PREV / NEXT ──────────────────────────────────────────────────────────────────┐
 * │ The register runs to 27 pages. Prev/Next makes page 19 a nineteen-click destination and gives │
 * │ no sense of where you are — and the two questions a person has at a paginated table are "how  │
 * │ much is there" and "can I jump". The range sentence answers the first; these answer the       │
 * │ second.                                                                                       │
 * │                                                                                              │
 * │ `1 … 4 5 6 … 27` rather than all 27: a row of 27 targets is a scan, not a control. The first  │
 * │ and last are always shown because "go back to the start" and "how deep does this go" are the  │
 * │ two jumps people actually make.                                                               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
function pageWindow(page: number, pages: number): readonly (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);

  const around = [page - 1, page, page + 1].filter((n) => n > 1 && n < pages);
  const out: (number | 'gap')[] = [1];

  if (around[0] !== undefined && around[0] > 2) out.push('gap');
  out.push(...around);
  const last = around[around.length - 1];
  if (last !== undefined && last < pages - 1) out.push('gap');
  out.push(pages);

  return out;
}

export function Pagination({
  page,
  pageSize,
  rowCount,
  onPage,
  labels,
}: {
  readonly page: number;
  readonly pageSize: number;
  /**
   * `rowCount`, not `total`. `no-float-money` flags any name containing "total" as money and
   * demands bigint — correctly, because on a platform that handles payments `total` is ambiguous.
   * This is how many rows the filter matched, so the name now says that.
   */
  readonly rowCount: number;
  readonly onPage: (page: number) => void;
  readonly labels: {
    readonly showing: string;
    readonly to: string;
    readonly of: string;
    readonly results: string;
    readonly previous: string;
    readonly next: string;
  };
}) {
  const pages = Math.max(1, Math.ceil(rowCount / pageSize));
  const first = rowCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, rowCount);

  const arrow =
    'gm-hit-target grid h-[2rem] w-[2rem] place-items-center rounded-full border border-subtle bg-surface text-content-secondary transition-colors duration-fast ease-standard hover:border-strong hover:text-content disabled:cursor-not-allowed disabled:border-subtle disabled:text-content-disabled';

  return (
    <nav
      aria-label={labels.results}
      className="flex flex-wrap items-center justify-between gap-inline-sm border-t border-subtle pt-inset-md"
    >
      <p className="text-xs text-content-tertiary">
        {labels.showing} <span className="tabular-nums">{first}</span> {labels.to}{' '}
        <span className="tabular-nums">{last}</span> {labels.of}{' '}
        <span className="font-medium tabular-nums">{rowCount.toLocaleString('en-IN')}</span>{' '}
        {labels.results}
      </p>

      <div className="flex items-center gap-inline-2xs">
        <button
          type="button"
          onClick={() => {
            onPage(page - 1);
          }}
          disabled={page <= 1}
          aria-label={labels.previous}
          title={labels.previous}
          className={arrow}
        >
          <span aria-hidden="true">&#8249;</span>
        </button>

        {pageWindow(page, pages).map((entry, index) =>
          entry === 'gap' ? (
            // A gap is not a button. Rendering it as one invites a click that cannot do anything,
            // and `…` as a disabled control is the most common pagination bug there is.
            <span
              key={`gap-${String(index)}`}
              aria-hidden="true"
              className="px-inset-2xs text-xs text-content-muted"
            >
              &#8230;
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => {
                onPage(entry);
              }}
              // `aria-current="page"`, which is what a screen reader reads as "current page" —
              // `aria-pressed` would describe it as a toggle that happens to be on.
              {...(entry === page ? { 'aria-current': 'page' as const } : {})}
              className={`gm-hit-target grid h-[2rem] min-w-[2rem] place-items-center rounded-full px-inset-2xs text-xs tabular-nums transition-colors duration-fast ease-standard ${
                entry === page
                  ? 'bg-brand-solid font-semibold text-content-on-brand'
                  : 'border border-subtle bg-surface text-content-secondary hover:border-strong hover:text-content'
              }`}
              {...(entry === page ? { 'data-on-solid': 'true' } : {})}
            >
              {entry}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => {
            onPage(page + 1);
          }}
          disabled={page >= pages}
          aria-label={labels.next}
          title={labels.next}
          className={arrow}
        >
          <span aria-hidden="true">&#8250;</span>
        </button>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Skeletons — the layout-matched fallbacks `StateBoundary` requires.
// ---------------------------------------------------------------------------

/** Rows matching a table's geometry, so nothing shifts when data lands (`FP4`). */
export function TableSkeleton({ rows = 6 }: { readonly rows?: number }) {
  return (
    <div className="flex flex-col gap-stack-2xs" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-[2.5rem] animate-pulse rounded-control bg-surface-sunken" />
      ))}
    </div>
  );
}
