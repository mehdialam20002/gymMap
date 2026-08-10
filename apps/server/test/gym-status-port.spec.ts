/**
 * `M-031` · `GYM_STATUS_PORT`'s one rule — `BR-GYM-01`, `catalog/README.md` edge 15.
 *
 * A port is an interface and cannot be tested. Its predicate can, and this one decides whether a
 * gym may take money, so it gets a suite of its own.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isBlockedForOrdering } from '../dist/catalog/application/ports/gym-status.port.js';
import { GYM_STATUSES } from '../dist/catalog/types/catalog.types.js';

test('APPROVED is the only status that may take an order', () => {
  /*
   * `BR-GYM-01` is *verification before visibility*, and this is the money-side half of it: an
   * order against a gym nobody approved must fail BEFORE payment, not be refunded after.
   */
  for (const status of GYM_STATUSES) {
    assert.equal(
      isBlockedForOrdering(status),
      status !== 'APPROVED',
      `${status} is on the wrong side of the ordering gate`,
    );
  }
});

test('a status added tomorrow is blocked by default, not permitted by default', () => {
  /*
   * The reason the rule is `!== 'APPROVED'` and not `=== 'SUSPENDED'`.
   *
   * With an equality check, a sixth `gym_status_enum` value would sell memberships from the day it
   * shipped, silently, because nobody would remember a comparison in `ordering/` existed. Written
   * as an allow-list of one, the same value is refused until somebody names it here — in the file
   * whose subject is that decision.
   *
   * Simulated with a cast, because the whole point is a value the union does not yet contain.
   */
  const future = 'PROVISIONALLY_LISTED' as (typeof GYM_STATUSES)[number];
  assert.equal(isBlockedForOrdering(future), true, 'an unknown status was allowed to sell');
});

test('the four blocked states are blocked for four different reasons, and all four count', () => {
  // Named individually rather than as "not APPROVED", because each is a real state a gym sits in
  // and a reader should be able to see that none of them was overlooked.
  for (const status of ['DRAFT', 'PENDING_REVIEW', 'SUSPENDED', 'CLOSED'] as const) {
    assert.equal(isBlockedForOrdering(status), true, `${status} can take an order`);
  }
});
