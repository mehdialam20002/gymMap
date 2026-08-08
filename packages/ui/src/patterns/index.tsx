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

const TONE_SUBTLE: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-content-secondary',
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
      className={`rounded-card border border-subtle bg-surface p-inset-md shadow-xs dark:shadow-none ${className}`}
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
}: {
  readonly children: ReactNode;
  readonly tone?: Tone;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-control px-inset-xs py-inset-2xs text-xs font-medium ${TONE_SUBTLE[tone]}`}
    >
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
}: {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  readonly type?: 'button' | 'submit';
  readonly disabled?: boolean;
  readonly size?: 'sm' | 'md';
}) {
  const VARIANT = {
    primary: 'bg-brand-solid text-content-on-brand hover:bg-brand-solid-hover',
    secondary: 'border border-subtle text-content-secondary hover:border-strong hover:text-content',
    ghost: 'text-content-secondary hover:text-content',
    danger: 'border border-danger text-content-danger hover:bg-surface-danger-subtle',
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
      className={`gm-hit-target rounded-control font-medium transition-colors duration-fast ease-standard disabled:cursor-not-allowed disabled:border-subtle disabled:bg-surface-disabled disabled:text-content-disabled ${VARIANT[variant]} ${SIZE[size]}`}
    >
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
            className={`gm-hit-target flex items-center gap-inline-2xs rounded-control border px-inset-sm py-inset-2xs text-xs transition-colors duration-fast ease-standard ${
              active
                ? 'border-brand bg-surface-brand-subtle font-semibold text-content-brand'
                : 'border-subtle text-content-secondary hover:text-content'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`tabular-nums ${active ? 'text-content-brand' : 'text-content-muted'}`}
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
                className={`px-inset-sm py-inset-xs text-xs font-semibold uppercase tracking-wide text-content-muted ${
                  column.align === 'right' ? 'text-right' : ''
                } ${column.secondary === true ? 'hidden lg:table-cell' : ''} ${
                  column.flexible === true ? 'w-full' : ''
                }`}
              >
                {column.header}
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
              className={`border-b border-subtle last:border-0 ${
                checked ? 'bg-surface-brand-subtle' : 'hover:bg-surface-sunken'
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
                  className={`px-inset-sm py-inset-xs align-middle text-content-secondary ${
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

  return (
    <div className="flex flex-wrap items-center justify-between gap-inline-sm pt-inset-sm">
      <p className="text-xs text-content-muted">
        {labels.showing} <span className="tabular-nums">{first}</span> {labels.to}{' '}
        <span className="tabular-nums">{last}</span> {labels.of}{' '}
        <span className="tabular-nums">{rowCount.toLocaleString('en-IN')}</span> {labels.results}
      </p>

      <div className="flex items-center gap-inline-2xs">
        <Button
          size="sm"
          onClick={() => {
            onPage(page - 1);
          }}
          disabled={page <= 1}
        >
          {labels.previous}
        </Button>
        <span className="px-inset-xs text-xs tabular-nums text-content-secondary">
          {page} / {pages}
        </span>
        <Button
          size="sm"
          onClick={() => {
            onPage(page + 1);
          }}
          disabled={page >= pages}
        >
          {labels.next}
        </Button>
      </div>
    </div>
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
