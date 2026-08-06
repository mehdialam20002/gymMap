/**
 * `Clock` — constitution §9.5 D4.
 *
 * `Date.now()` is forbidden in layers 1 and 2. Not for purity: a membership that expires on the
 * 31st, a freeze window, a token TTL and India's 18:30-UTC financial-year boundary are all
 * decisions about time that must be TESTABLE at a chosen instant. Code that calls `Date.now()`
 * directly can only be tested by waiting, or by mocking a global — and mocking a global leaks
 * across the test file it was mocked in.
 */
export interface Clock {
  /** The current instant, always UTC. */
  now(): Date;
  /** Milliseconds since the epoch, for durations and TTLs. */
  nowMs(): number;
}

export const CLOCK = Symbol('Clock');
