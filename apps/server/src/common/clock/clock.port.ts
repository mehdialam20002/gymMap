/**
 * The `Clock` port — `AC-FND-13.3`, `TR-21`.
 *
 * ┌─ NO DOMAIN CODE CALLS `new Date()`. THE LINT RULE IS THE ENFORCEMENT. ──────────────────────┐
 * │ Time read from the ambient environment is untestable and non-deterministic. A membership    │
 * │ that expires "in 30 days" cannot be tested without either waiting thirty days or            │
 * │ monkey-patching a global — and the monkey-patch leaks between tests, so one suite's frozen  │
 * │ clock changes another's result depending on the order they ran in.                           │
 * │                                                                                              │
 * │ An injected clock makes time an argument. `FixedClock` freezes it per test, with no global  │
 * │ state and no ordering dependency.                                                            │
 * │                                                                                              │
 * │ `no-bare-date` fails the build on `new Date()` or `Date.now()` in domain code, because a    │
 * │ convention that is merely documented is a convention that survives until the first hurry.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

export const CLOCK = Symbol('Clock');

export interface Clock {
  /**
   * The current instant, UTC.
   *
   * Returns a `Date` and not an epoch number, so a caller cannot casually do arithmetic on it in
   * milliseconds and land in the timezone trap `TR-24` describes — converting to a business day
   * has to go through `@gymmap/utils`, which requires an explicit zone.
   */
  now(): Date;
}

export const ID_GENERATOR = Symbol('IdGenerator');

/**
 * `IdGenerator` — the same argument as `Clock`, for the same reason. `AC-FND-13.3`.
 *
 * A `randomUUID()` call inside a use case makes its output unpredictable, so a test can assert
 * that an id EXISTS but never that the right one was used. Injecting the generator lets a test
 * supply a known id and assert it reached the ledger entry, the outbox row and the audit record
 * — which is the property that actually matters, and is unassertable otherwise.
 */
export interface IdGenerator {
  /** A UUID. `Schema.md` §2.2 wants v7 for index locality — see the adapter for where that stands. */
  uuid(): string;
}
