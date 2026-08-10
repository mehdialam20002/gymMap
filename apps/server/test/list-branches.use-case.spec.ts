/**
 * `M-031` · `toListQuery()` — `Gym.md` §12.1's contract, applied to whatever arrived on the URL.
 *
 * ┌─ THE NORMALISER IS THE WHOLE SURFACE ────────────────────────────────────────────────────────┐
 * │ `ListBranchesUseCase.execute` delegates to a port in one line; testing it would prove a       │
 * │ function can call a function. What is worth asserting is `toListQuery`, because everything it │
 * │ gets wrong is a defaulting decision that comes from a DOCUMENT — the limit of 50, the sort of │
 * │ `name:asc`, the repeatable `gym_id` — and every one of them silently degrades rather than     │
 * │ failing when it drifts.                                                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BRANCH_LIST_DEFAULT_LIMIT,
  isBranchSort,
  isBranchStatus,
  toListQuery,
} from '../dist/catalog/application/list-branches.use-case.js';
import { BRANCH_SORTS } from '../dist/catalog/application/ports/branch-list.port.js';
import { MAX_PAGE_LIMIT } from '@gymmap/types';

// ═══════════════════════════════════════════════════════════════════════════
// The defaults, which are Gym.md's and not this code's
// ═══════════════════════════════════════════════════════════════════════════

test('the default limit is 50 — §12.1 names it, and DEFAULT_PAGE_LIMIT (20) does not apply', () => {
  /*
   * `MASTER_PRD.md` §C3.1 is the whole pagination rule and states NO number: *"Cursor-based:
   * `?limit=&cursor=`; response includes `next_cursor`"*. `DEFAULT_PAGE_LIMIT = 20` was chosen in
   * `packages/types` and its comment used to attribute it to §C3.1, which is the `TD-048` shape.
   *
   * So a rank-3 API document naming its own default outranks a rank-5 constant, and there is no
   * conflict to resolve — only a precedence to apply.
   */
  assert.equal(BRANCH_LIST_DEFAULT_LIMIT, 50);
  assert.equal(toListQuery({}).limit, 50);
});

test('the default sort is name:asc — §12.1 marks it "(default)"', () => {
  assert.equal(toListQuery({}).sort, 'name:asc');
});

test('an empty query filters by nothing at all', () => {
  const query = toListQuery({});

  assert.deepEqual(query.gymIds, []);
  // Absent, not `undefined`. `exactOptionalPropertyTypes` makes those different types, and the
  // repository's `?? null` should never be the only thing standing between a typo and no filter.
  assert.ok(!('status' in query));
  assert.ok(!('cityId' in query));
  assert.ok(!('cursor' in query));
});

// ═══════════════════════════════════════════════════════════════════════════
// gym_id is REPEATABLE
// ═══════════════════════════════════════════════════════════════════════════

test('gym_id accepts one value or many — §12.1 says "(uuid, repeated)"', () => {
  const one = toListQuery({ gym_id: 'a' });
  const many = toListQuery({ gym_id: ['a', 'b', 'c'] });

  // Express gives a bare string for one occurrence and an array for two or more. A handler that
  // assumed an array would filter by the CHARACTERS of a single id.
  assert.deepEqual(one.gymIds, ['a']);
  assert.deepEqual(many.gymIds, ['a', 'b', 'c']);
});

test('no gym_id means every gym in the tenant, not zero gyms', () => {
  /*
   * The repository writes `cardinality($1) = 0 OR gym_id = ANY($1)` for exactly this: an empty
   * array with a plain `= ANY` is false for every row, so an unfiltered list would silently
   * return nothing and look like an empty estate.
   */
  assert.deepEqual(toListQuery({}).gymIds, []);
});

// ═══════════════════════════════════════════════════════════════════════════
// The sort allowlist
// ═══════════════════════════════════════════════════════════════════════════

test('the allowlist is exactly §12.1’s three, and created_at:asc is NOT one', () => {
  assert.deepEqual([...BRANCH_SORTS], ['name:asc', 'name:desc', 'created_at:desc']);
  // The document does not list it, and "obviously it should work too" is how an allowlist becomes
  // a suggestion. The value chooses which prepared statement runs.
  assert.equal(isBranchSort('created_at:asc'), false);
});

test('an unrecognised sort falls back to the default rather than reaching ORDER BY', () => {
  for (const attempt of ['name', 'name:sideways', 'id:asc', 'name:asc; DROP TABLE branches', '']) {
    assert.equal(toListQuery({ sort: attempt }).sort, 'name:asc', `"${attempt}" was not rejected`);
  }
});

test('each allowed sort survives the round trip', () => {
  for (const sort of BRANCH_SORTS) {
    assert.equal(toListQuery({ sort }).sort, sort);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// status, and why an unknown one is dropped rather than refused
// ═══════════════════════════════════════════════════════════════════════════

test('a status filter is applied when it is one of the two real values', () => {
  assert.equal(toListQuery({ status: 'ACTIVE' }).status, 'ACTIVE');
  assert.equal(toListQuery({ status: 'INACTIVE' }).status, 'INACTIVE');
  assert.equal(isBranchStatus('DELETED'), false);
});

test('an unrecognised status filters by NOTHING — a filter is a narrowing', () => {
  /*
   * Dropped rather than 400'd, and the safe behaviour of a broken filter is to show everything
   * rather than nothing: a stale bookmark should render a useful list, not an empty screen the
   * owner reads as "I have no branches".
   */
  const query = toListQuery({ status: 'PENDING' });
  assert.ok(!('status' in query));
});

// ═══════════════════════════════════════════════════════════════════════════
// limit, which is a denial-of-service control
// ═══════════════════════════════════════════════════════════════════════════

test('the ceiling holds however the limit is asked for', () => {
  assert.equal(toListQuery({ limit: '1000' }).limit, MAX_PAGE_LIMIT);
  assert.equal(toListQuery({ limit: '101' }).limit, MAX_PAGE_LIMIT);
  assert.equal(toListQuery({ limit: '100' }).limit, 100);
});

test('nonsense and hostile limits fall back to the default, never to zero or negative', () => {
  /*
   * `limit=0` is the interesting one: passed through it becomes `LIMIT 1` after the `+1` the
   * repository adds for `has_more`, so every page would hold nothing and `next_cursor` would
   * advance one row at a time forever.
   */
  for (const attempt of ['0', '-5', 'abc', '', 'NaN', 'Infinity', '1.5e400']) {
    assert.equal(
      toListQuery({ limit: attempt }).limit,
      BRANCH_LIST_DEFAULT_LIMIT,
      `limit=${attempt} was not clamped`,
    );
  }
});

test('a fractional limit is floored, not rounded or rejected', () => {
  assert.equal(toListQuery({ limit: '10.9' }).limit, 10);
});

test('the cursor is passed through opaquely and never parsed here', () => {
  // `packages/types`: *"the moment a client parses a cursor, the encoding is frozen and the sort
  // key can never change"*. The same applies to anything between the client and the repository.
  assert.equal(
    toListQuery({ cursor: 'eyJrIjoiQSIsImkiOiJiMSJ9' }).cursor,
    'eyJrIjoiQSIsImkiOiJiMSJ9',
  );
});
