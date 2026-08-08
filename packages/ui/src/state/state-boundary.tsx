/**
 * `StateBoundary` — the renderer for `SurfaceState`. `Components.md` §3.2.
 *
 * ┌─ `children` IS A FUNCTION, AND THAT IS THE ENTIRE SAFETY PROPERTY ──────────────────────────┐
 * │ It is called ONLY for `ready`, with `data` non-optional. A component body therefore cannot   │
 * │ dereference data that has not arrived — not "should not", cannot. Passing children as JSX    │
 * │ would put the body in scope for every state and hand the problem back to discipline.         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ `loadingFallback` IS REQUIRED AND THERE IS NO DEFAULT ─────────────────────────────────────┐
 * │ Deliberately no generic spinner in the API. `§3.4`: a spinner over a blank page is one of    │
 * │ the four things this contract exists to make impossible, and a default would be the path of  │
 * │ least resistance on every screen. The caller supplies a skeleton matching the eventual       │
 * │ layout — same box count, same heights — so nothing shifts when data lands (`FP4`).            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ ONE `aria-busy` AND ONE LIVE REGION PER BOUNDARY ──────────────────────────────────────────┐
 * │ Scoped, not global. A screen with six boundaries makes six scoped announcements — "approval  │
 * │ queue updated" rather than a page-level "loading" that says nothing about what changed.       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { ReactNode } from 'react';

import type { ApiProblem, EmptyReason, EmptyStateProps, SurfaceState } from './surface-state.ts';

export interface StateBoundaryProps<T> {
  readonly state: SurfaceState<T>;
  /** Called ONLY for `ready`. See the header. */
  readonly children: (data: T, meta: { readonly isFetching: boolean }) => ReactNode;
  /** Layout-matched skeleton. Required; no default is offered. */
  readonly loadingFallback: ReactNode;
  readonly emptyState: EmptyStateProps | ((reason: EmptyReason) => EmptyStateProps);
  readonly errorState?: (error: ApiProblem, retry: (() => void) | undefined) => ReactNode;
  readonly permissionDeniedState?: ReactNode;
  /** Names the region for `aria-busy` and for the announcement when the state changes. */
  readonly regionLabelText: string;
  readonly onRetry?: () => void;
}

export function StateBoundary<T>({
  state,
  children,
  loadingFallback,
  emptyState,
  errorState,
  permissionDeniedState,
  regionLabelText,
  onRetry,
}: StateBoundaryProps<T>) {
  const busy = state.kind === 'loading' || (state.kind === 'ready' && state.isFetching);

  return (
    <div aria-busy={busy} aria-label={regionLabelText} role="region">
      {/* Polite, and scoped to this region. An assertive announcement interrupts whatever the
          person is reading, which for a background refetch is never warranted. */}
      <span className="gm-visually-hidden" aria-live="polite">
        {state.kind === 'loading' ? `${regionLabelText}: loading` : ''}
      </span>

      {state.kind === 'loading' && loadingFallback}

      {state.kind === 'permission-denied' &&
        (permissionDeniedState ?? <PermissionDeniedState state={state} />)}

      {state.kind === 'error' &&
        (errorState?.(state.error, state.canRetry ? onRetry : undefined) ?? (
          <ErrorState
            error={state.error}
            retry={state.canRetry ? onRetry : undefined}
            /* `lastGoodData` is rendered BEHIND the error where the caller has it, rather than
               replaced by it. A transient failure must not erase what was already on screen. */
            hasLastGood={state.lastGoodData !== undefined}
          />
        ))}

      {state.kind === 'empty' && (
        <EmptyState
          {...(typeof emptyState === 'function' ? emptyState(state.reason) : emptyState)}
        />
      )}

      {state.kind === 'ready' && children(state.data, { isFetching: state.isFetching })}
    </div>
  );
}

/** Both `bodyText` and `primaryAction` are required by the type — see `surface-state.ts`. */
export function EmptyState({ title, bodyText, primaryAction }: EmptyStateProps) {
  return (
    <div className="rounded-card border border-subtle bg-surface-sunken p-inset-lg text-center">
      <p className="text-base font-semibold text-content">{title}</p>
      <p className="mx-auto mt-stack-2xs max-w-prose text-sm text-content-secondary">{bodyText}</p>

      <div className="mt-stack-md">
        {'href' in primaryAction ? (
          <a
            href={primaryAction.href}
            className="gm-hit-target inline-block rounded-control border border-subtle px-inset-md py-inset-xs text-sm font-medium text-content-secondary hover:text-content"
          >
            {primaryAction.label}
          </a>
        ) : (
          <button
            type="button"
            onClick={primaryAction.onAction}
            className="gm-hit-target rounded-control border border-subtle px-inset-md py-inset-xs text-sm font-medium text-content-secondary hover:text-content"
          >
            {primaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

function ErrorState({
  error,
  retry,
  hasLastGood,
}: {
  error: ApiProblem;
  retry: (() => void) | undefined;
  hasLastGood: boolean;
}) {
  return (
    <div
      role="alert"
      className="rounded-card border border-danger bg-surface-danger-subtle p-inset-md"
    >
      {/* `error.message` is already operator-safe: EV3/EV7 shape it before it leaves the server,
          so it is rendered as received rather than replaced with a generic apology. */}
      <p className="text-sm font-medium text-content-danger">{error.message}</p>

      {hasLastGood && (
        <p className="mt-stack-2xs text-xs text-content-danger">
          Showing the last results that loaded.
        </p>
      )}

      <div className="mt-stack-sm flex flex-wrap items-center gap-inline-sm">
        {retry !== undefined && (
          <button
            type="button"
            onClick={retry}
            className="gm-hit-target rounded-control border border-danger px-inset-sm py-inset-xs text-xs font-medium text-content-danger"
          >
            Try again
          </button>
        )}

        {/* The correlation id, on server failures only. It is what support needs and what a
            member has no use for on a validation error. */}
        {error.correlationId !== undefined && (error.status ?? 0) >= 500 && (
          <span className="font-mono text-xs text-content-danger">{error.correlationId}</span>
        )}
      </div>
    </div>
  );
}

function PermissionDeniedState({
  state,
}: {
  state: Extract<SurfaceState<unknown>, { kind: 'permission-denied' }>;
}) {
  return (
    <div className="rounded-card border border-warning bg-surface-warning-subtle p-inset-md">
      <p className="text-sm font-medium text-content-warning">
        You do not have permission to view this.
      </p>
      <p className="mt-stack-2xs text-xs text-content-warning">
        Ask a platform administrator if you need access.
      </p>

      {/* The raw permission string is a SUPPORT detail, disclosed rather than announced. Putting
          `admin.gym_register.read` in the headline tells the person nothing and reads as a crash. */}
      <details className="mt-stack-sm">
        <summary className="cursor-pointer text-xs text-content-warning">Details</summary>
        <p className="mt-stack-2xs font-mono text-xs text-content-warning">
          {state.missingPermission}
        </p>
      </details>
    </div>
  );
}
