/**
 * `FixedClock` — time as an argument. `AC-FND-13.3`.
 *
 * ┌─ THIS IS WHY THE PORT EXISTS ───────────────────────────────────────────────────────────────┐
 * │ The alternative is a global monkey-patch — `Date.now = () => …` — which leaks between       │
 * │ tests. One suite's frozen clock then changes another suite's result depending on the order  │
 * │ they ran in, and the failure is intermittent, order-dependent, and blamed on the wrong test.│
 * │                                                                                              │
 * │ A `FixedClock` instance is local to the test that made it. No global state, no teardown to  │
 * │ forget.                                                                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Lives in `src/` rather than `test/` deliberately: `no-test-harness-in-src` forbids application
 * code importing from `test/`, and an integration test that builds the real DI container needs
 * to provide this as `CLOCK`. It is inert — it cannot read the system clock at all.
 */

import type { Clock, IdGenerator } from './clock.port.js';

export class FixedClock implements Clock {
  private current: Date;

  constructor(instant: Date | string) {
    this.current = new Date(instant);
    if (Number.isNaN(this.current.getTime())) {
      throw new TypeError(`FixedClock: "${String(instant)}" is not a valid instant.`);
    }
  }

  now(): Date {
    // A COPY. Returning the internal Date would let a caller mutate the clock through
    // `setHours`, and a test that silently moved time forward would be very hard to read.
    return new Date(this.current.getTime());
  }

  /** Moves the clock. For a test that spans a boundary — an expiry, a financial-year rollover. */
  advanceBy(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }

  set(instant: Date | string): void {
    const next = new Date(instant);
    if (Number.isNaN(next.getTime())) {
      throw new TypeError(`FixedClock.set: "${String(instant)}" is not a valid instant.`);
    }
    this.current = next;
  }
}

/**
 * A deterministic `IdGenerator`.
 *
 * Sequential rather than random, so a test can assert the EXACT id that reached the ledger
 * entry, the outbox row and the audit record. Asserting only that "an id exists" leaves the
 * question the test was written to answer — did all three get the SAME one — unanswered.
 */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;
  private readonly prefix: string;

  constructor(prefix = '00000000-0000-7000-8000') {
    this.prefix = prefix;
  }

  uuid(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter.toString(16).padStart(12, '0')}`;
  }
}
