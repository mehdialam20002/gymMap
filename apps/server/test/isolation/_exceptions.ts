/**
 * M-015 · The declared exception list — `§5.5`, acceptance criterion 11.
 *
 * ┌─ THIS LIST'S LENGTH IS REPORTED IN THE CI SUMMARY, AND IT SHOULD SHRINK ────────────────────┐
 * │ An exception that is merely absent from the suite is invisible. An exception that is        │
 * │ WRITTEN DOWN, with an owner and an alternative control, is a number somebody can be asked   │
 * │ about — and job 13 prints it, so "how many routes are exempt from the isolation suite" has  │
 * │ an answer that appears on every pull request rather than in nobody's head.                  │
 * │                                                                                              │
 * │ There is no `skip` in the generated suite. A route is covered, or it is here with a reason. │
 * │ There is no third option, which is `CLAUDE.md` §9.6 applied to test coverage.                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

export interface IsolationException {
  readonly method: string;
  readonly path: string;
  /** Why the standard case group cannot apply. Not "it is hard to test". */
  readonly reason: string;
  /** What protects the route INSTEAD. An exception with no alternative control is a hole. */
  readonly alternativeControl: string;
  /** A role, not a person — people leave and the exception outlives them. */
  readonly owner: string;
  /** When this should be revisited. A permanent exception is a decision, not a deferral. */
  readonly reviewAt: string;
}

/**
 * Empty, and that is the correct state today.
 *
 * Both tenant-scoped routes that exist (`GET /v1/tenant/ping` and its `{tenantRef}` form) are
 * fully covered. The list is declared now rather than when it is first needed, so that adding an
 * exception is an edit to a reviewed file rather than the invention of a mechanism under
 * pressure — which is when exceptions get made.
 */
export const ISOLATION_EXCEPTIONS: readonly IsolationException[] = [];

/** The key the coverage gate and the suite agree on. */
export function exceptionKey(route: { method: string; path: string }): string {
  return `${route.method} ${route.path}`;
}

export const EXCEPTED_ROUTES = new Set(ISOLATION_EXCEPTIONS.map(exceptionKey));
