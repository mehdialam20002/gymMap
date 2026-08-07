/**
 * `@gymmap/utils` — pure, dependency-free, 100% unit-tested.
 *
 * Every export is a TOTAL FUNCTION of its arguments: no clock, no environment, no I/O. That is
 * what lets `money/` reach 100% line and branch coverage without a mock, and what makes a
 * property test over 10,000 random splits meaningful rather than a slow way to exercise a stub.
 *
 * `packages/ui` may NOT import this (constitution §7.1.1 R3, enforced by `no-ui-to-utils`). A UI
 * primitive receives a pre-formatted string; the formatting happens here, once, so the React
 * surfaces and the non-React PDF renderer cannot diverge.
 */

export * from './money/round-half-even.js';
export * from './money/minor-units.js';
export * from './money/allocate.js';
export * from './money/basis-points.js';
export * from './money/format-indian-grouping.js';
export * from './money/format-currency.js';

export * from './time/local-midnight-utc.js';
export * from './time/gym-timezone.js';
export * from './time/validity-window.js';
export * from './time/financial-year.js';
