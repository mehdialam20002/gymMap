/**
 * M-010 · Tenancy errors — §13.1, Security.md P3.
 *
 * ┌─ BOTH OF THESE ARE 500, NOT 403. THAT IS THE DESIGN. ───────────────────────────────────────┐
 * │ A 403 is a statement about the CALLER: "you are not allowed". Neither of these is about the │
 * │ caller — both mean the SERVER reached a database operation without knowing whose data it    │
 * │ was about. That is our defect, and no caller can provoke it by sending anything.            │
 * │                                                                                             │
 * │ Returning 403 would be worse than cosmetic. A 403 is an expected, monitored, ignorable      │
 * │ status: dashboards are full of them, alerts are tuned to tolerate them, and a support agent │
 * │ tells the user to log in again. A 500 pages someone. Security.md P3 (alert 8, S1) depends   │
 * │ on the distinction, and AC-FND-02.2 states it outright.                                     │
 * │                                                                                             │
 * │ The status is not set here — it comes from the registry row for each code, which is where   │
 * │ §13.2 says the mapping lives. Both codes are registered as 500 with class `System`.         │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { DomainException } from '../../common/errors/domain-exception.js';

/**
 * `BR-TEN-01-N3`, `BR2`, `PX-4`, `AC-FND-02.2`.
 *
 * Thrown when a tenant-scoped operation is attempted with no tenant in `AsyncLocalStorage`.
 *
 * The alternative — running the query unfiltered — is the failure this module exists to prevent.
 * The alternative to THAT, running it and returning nothing, is worse still: an empty result set
 * is indistinguishable from a correct answer, so nobody investigates, and the fix someone
 * eventually applies is to widen the RLS policy.
 */
export class MissingTenantContextError extends DomainException {
  constructor(model: string, operation: string) {
    super(
      'TENANT_CONTEXT_MISSING',
      `A tenant-scoped operation (${model}.${operation}) was attempted with no tenant context. ` +
        `The query was NOT executed.`,
      [
        {
          field: 'operation',
          model,
          operation,
          // Written for whoever reads it at 3am.
          diagnosis:
            'Either the route is missing TenantContextMiddleware, or a background job ran ' +
            'outside runWithTenant(), or an async boundary lost the AsyncLocalStorage frame — ' +
            'a setTimeout or an un-awaited promise started before the context was entered.',
        },
      ],
    );
  }
}

/**
 * `BR-TEN-02-N1`, `AC-EP01-10`.
 *
 * Thrown when a request that already has a tenant context enters a DIFFERENT one.
 *
 * Re-entering the SAME tenant is harmless and permitted — nested service calls do it constantly.
 * Entering a different one means one unit of work spans two tenants, and either resolution is
 * wrong: the transaction carries a single `app.tenant_id`, so half the work would silently
 * execute under the other tenant's scope.
 *
 * This is the guard that stops an impersonation or admin path quietly becoming a cross-tenant
 * write.
 */
export class TenantContextAlreadySetError extends DomainException {
  constructor(current: string, attempted: string) {
    super(
      'TENANT_CONTEXT_ALREADY_SET',
      'A second, different tenant context was entered within one request. One unit of work ' +
        'belongs to exactly one tenant.',
      [
        {
          field: 'tenantContext',
          // The ids ARE included, unlike most error details. A tenant id identifies an
          // organisation, not a person, so BR-DAT-06 does not cover it — and without both ids
          // the error is unactionable, because the entire question is "which two".
          current,
          attempted,
          diagnosis:
            "A use case called into another tenant's scope. If this is an admin or support " +
            'path it must use runElevated() (M-014), which is audited and read-only — not a ' +
            'second tenant context.',
        },
      ],
    );
  }
}

/**
 * `AC-1`, `§11.3`, `TD1` — a client tried to supply the tenant id.
 *
 * ┌─ 400, AND REJECTED RATHER THAN IGNORED ─────────────────────────────────────────────────────┐
 * │ This one IS about the caller, so unlike the two above it is a 4xx.                          │
 * │                                                                                             │
 * │ Ignoring the header is the tempting alternative and it is wrong twice. A client that        │
 * │ believes it is scoping its requests silently gets different behaviour from the one it       │
 * │ intended — and we lose the signal. Someone sending `X-Tenant-Id` is either an integrator    │
 * │ working from wrong documentation or somebody probing for exactly this, and both are worth   │
 * │ a log line.                                                                                 │
 * │                                                                                             │
 * │ The message is deliberately explicit about the remedy. Vagueness protects nothing here: the │
 * │ fact that the tenant comes from the token is published in the API contract, and an          │
 * │ integrator who understands it stops sending the header.                                     │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export class TenantHeaderNotAcceptedError extends DomainException {
  constructor(location: 'header' | 'query' | 'body', key: string) {
    super(
      'TENANT_HEADER_NOT_ACCEPTED',
      `A client-supplied tenant id was rejected: "${key}" in the ${location}.`,
      [
        {
          field: key,
          location,
          remedy:
            'The tenant is derived from the access token and is never accepted from a client ' +
            '(§C3.1, §11.3). Remove this field and authenticate as a principal of that tenant.',
        },
      ],
    );
  }
}

/**
 * `AC-FND-05.1`, `AC-AUTH-03.2`, `PE-T5`, `PE-T9` — an elevation was asked for and refused.
 *
 * Deliberately NOT `TenantContextAlreadySetError`, though the first draft reused it. That error's
 * message is fixed at "a second, different tenant context was entered", which is a true statement
 * about the mechanism and a misleading one about the cause: an operator reading it after an
 * elevation was refused during impersonation would go looking for a nested `runWithTenant`, and
 * there is none. The two are also worth alerting on differently — a refused elevation is somebody
 * deliberately reaching across the boundary, which is the interesting event; a re-entered tenant
 * context is an ordinary bug.
 *
 * The `refusal` text lands in the message because there is nothing sensitive in it — it names a
 * scope and a rule, never a person or a tenant's data (BR-DAT-06).
 */
export class ElevationRefusedError extends DomainException {
  constructor(refusal: string, scope: string) {
    super('ELEVATION_REFUSED', `Elevation to ${scope} was refused: ${refusal}`, [
      {
        field: 'elevation',
        scope,
        diagnosis:
          'runElevated() refuses rather than narrowing its scope or proceeding unaudited. An ' +
          'elevation that silently downgrades returns fewer rows than the caller expected, and ' +
          'the caller reads that as "no data" rather than "refused".',
      },
    ]);
  }
}

/**
 * `PX-6`, `P4` — exactly one interactive transaction per unit of work.
 *
 * A nested `$transaction` inside the extension's own transaction is a SAVEPOINT, not a
 * transaction: it does not get its own connection, so it inherits the outer `app.tenant_id`
 * while looking like an independent boundary. Code written against that assumption is correct
 * right up until someone changes the outer scope.
 *
 * It is also the fastest route to pool exhaustion — each interactive transaction holds a
 * connection for its whole lifetime, and nesting multiplies the hold.
 */
export class NestedTransactionError extends DomainException {
  constructor() {
    super(
      'TENANT_CONTEXT_ALREADY_SET',
      'A nested interactive transaction was opened inside a tenant-scoped transaction. ' +
        '§11.4.2 P4 allows exactly one per unit of work.',
      [
        {
          field: 'transaction',
          diagnosis:
            'Pass the existing transactional client down rather than opening a second one. A ' +
            'nested $transaction is a SAVEPOINT: it shares the outer connection and therefore ' +
            'the outer app.tenant_id, while reading like an independent boundary.',
        },
      ],
    );
  }
}
