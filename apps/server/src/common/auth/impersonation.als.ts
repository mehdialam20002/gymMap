/**
 * `M-025` · Who is really acting — `FR-AUTH-12`, `BR-DAT-01`, `AC-7`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * `AC-7` SAYS **EVERY** WRITE, AND THAT WORD IS THE DESIGN
 *
 * *"Every write under the token carries `impersonated_by` in its audit row"* — not only the start
 * event. The obvious implementation is a parameter: add `impersonatedBy` to each `append()` call.
 * `AuditEntry` already has the field, and today exactly one caller sets it, to `null`.
 *
 * That is the shape the requirement rules out. A field every call site must remember is a field
 * most call sites will not, and the omission is invisible: the row is written, the report runs, and
 * the actions taken under a borrowed identity are the ones missing the borrower. Precisely the rows
 * an investigation is looking for, silently indistinguishable from ordinary activity.
 *
 * So the impersonator rides in `AsyncLocalStorage` and the audit REPOSITORY reads it — one choke
 * point that every write already passes through, including the use cases that bypass the
 * `@Audited()` interceptor entirely.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ IN `common/`, NOT IN `iam/` ───────────────────────────────────────────────────────────────┐
 * │ `audit/` must read this and `audit/` may not import a feature module. Same placement, and the │
 * │ same reason, as `correlation.als.ts` — a fact about the current request that several modules  │
 * │ read and none owns.                                                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface ImpersonationContext {
  /** The AGENT — the real human. Written to `audit_log.impersonated_by`. */
  readonly impersonatorId: string;
  /** The user being acted as. Already the `actorId`; carried here so the two can be compared. */
  readonly subjectUserId: string;
  /** When the session began. `AC-3`'s cap is re-checked against this, never against `exp` alone. */
  readonly startedAt: Date;
}

const storage = new AsyncLocalStorage<ImpersonationContext>();

/** The current impersonation, or `null` when this is an ordinary session. */
export function currentImpersonation(): ImpersonationContext | null {
  return storage.getStore() ?? null;
}

/**
 * Runs `fn` with an impersonation in scope.
 *
 * ┌─ NESTING IS REFUSED, NOT MERGED ────────────────────────────────────────────────────────────┐
 * │ There is no legitimate way to impersonate from inside an impersonation: the token type is    │
 * │ checked before one can be minted, and `IMPERSONATION` cannot mint another. Reaching here     │
 * │ twice therefore means a frame leaked across an async boundary or a middleware ran twice, and │
 * │ silently taking the inner one would attribute a whole request to the wrong agent.            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function runAsImpersonator<T>(context: ImpersonationContext, fn: () => T): T {
  const existing = storage.getStore();
  if (existing !== undefined) {
    throw new Error(
      `An impersonation by ${existing.impersonatorId} is already in scope; ` +
        `${context.impersonatorId} cannot nest inside it.`,
    );
  }
  return storage.run(context, fn);
}

/**
 * The value for `audit_log.impersonated_by`, or `null`.
 *
 * A function rather than the caller reaching for `currentImpersonation()?.impersonatorId` at each
 * site: the shape of the column is one decision, and it is made here.
 */
export function currentImpersonatorId(): string | null {
  return storage.getStore()?.impersonatorId ?? null;
}
