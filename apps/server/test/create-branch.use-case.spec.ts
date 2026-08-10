/**
 * `M-031` · `CreateBranchUseCase` — `Gym.md` §12.2, `FR-GYM-07`, `FR-GYM-09`.
 *
 * ┌─ ONE RULE, AND EVERYTHING ELSE IS TRANSCRIPTION ─────────────────────────────────────────────┐
 * │ *"The first branch of a gym is `is_primary` regardless of the request."* That is the only     │
 * │ decision the use case makes, so it is what most of this file is about. The rest asserts the   │
 * │ two things transcription gets wrong: an optional field arriving as `undefined` where the      │
 * │ column needs `null`, and a lookup order that leaks.                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CreateBranchUseCase } from '../dist/catalog/application/create-branch.use-case.js';

const GYM = '0192de00-7000-7000-8000-0000000000a1';
const EXISTING = '0192de00-7000-7000-8000-0000000000b1';

/** A minimal valid request. Individual tests override one field at a time. */
const REQUEST = {
  gym_id: GYM,
  name: 'Andheri',
  address_line1: '1 Link Road',
  city_id: '0192de00-7000-7000-8000-0000000000c1',
  state: 'Maharashtra',
  state_code: '27',
  postal_code: '400053',
  country_code: 'IN' as const,
  location: { lat: 19.076, lng: 72.877 },
};

function build(options: {
  gymKnown?: boolean;
  existingBranches?: { id: string; isPrimary: boolean }[];
}) {
  const calls: string[] = [];
  const written: Record<string, unknown>[] = [];
  const { gymKnown = true, existingBranches = [] } = options;

  const useCase = new CreateBranchUseCase(
    {
      statusOf: (id: string) => {
        calls.push(`statusOf:${id}`);
        return Promise.resolve(
          gymKnown
            ? ({ ok: true, status: 'APPROVED' } as const)
            : ({ ok: false, reason: 'UNKNOWN_GYM' } as const),
        );
      },
    } as never,
    {
      activeInGym: (id: string) => {
        calls.push(`activeInGym:${id}`);
        return Promise.resolve(existingBranches);
      },
    } as never,
    {
      create: (branch: Record<string, unknown>) => {
        calls.push('create');
        written.push(branch);
        return Promise.resolve({ id: 'written', ...branch });
      },
    } as never,
  );

  return { useCase, calls, written };
}

// ═══════════════════════════════════════════════════════════════════════════
// §12.2's one rule
// ═══════════════════════════════════════════════════════════════════════════

test('the FIRST branch of a gym is primary even when the request says otherwise', () => {
  return (async () => {
    const { useCase, written } = build({ existingBranches: [] });
    await useCase.execute({ ...REQUEST, is_primary: false });

    assert.equal(written[0]?.isPrimary, true, 'a first branch was written as non-primary');
  })();
});

test('the override is reported, not silent', async () => {
  /*
   * An owner who sent `is_primary: false` and receives `true` with no explanation reasonably reads
   * it as a bug. `primaryForced` is what lets the controller say so.
   */
  const { useCase } = build({ existingBranches: [] });
  const outcome = await useCase.execute({ ...REQUEST, is_primary: false });

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.primaryForced, true);
});

test('a first branch that did not ask either way is primary, and nothing was overridden', async () => {
  // The ordinary case. `primaryForced` is false because the client expressed no preference — there
  // is nothing to explain, and a UI showing "we changed your setting" would be noise.
  const { useCase, written } = build({ existingBranches: [] });
  const outcome = await useCase.execute(REQUEST);

  assert.equal(written[0]?.isPrimary, true);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.primaryForced, false);
});

test('a SECOND branch is written exactly as requested — the rule is about the first', async () => {
  const existing = [{ id: EXISTING, isPrimary: true }];

  const nonPrimary = build({ existingBranches: existing });
  await nonPrimary.useCase.execute({ ...REQUEST, is_primary: false });
  assert.equal(nonPrimary.written[0]?.isPrimary, false);

  const omitted = build({ existingBranches: existing });
  await omitted.useCase.execute(REQUEST);
  assert.equal(omitted.written[0]?.isPrimary, false, 'an omitted flag must not default to primary');
});

test('a second branch asking to be primary is PASSED THROUGH for the index to refuse', async () => {
  /*
   * The alternative is demoting the current primary here, which §12.2 does not ask for: it
   * describes promotion on DEACTIVATION and says nothing about a create silently taking the flag
   * from another branch.
   *
   * So `uq_branches__one_primary_per_gym` raises, the request fails, and the owner is told —
   * which is the correct outcome for an operation nobody specified. Asserted so that a future
   * "helpful" demotion has to delete this test first.
   */
  const { useCase, written } = build({ existingBranches: [{ id: EXISTING, isPrimary: true }] });
  await useCase.execute({ ...REQUEST, is_primary: true });

  assert.equal(written[0]?.isPrimary, true, 'the use case quietly demoted the request');
});

test('a gym whose only branch was CLOSED gets a primary again', async () => {
  /*
   * `activeInGym` and not a count of every row, and this is the case that separates them.
   *
   * A deactivated branch takes `deleted_at`, which drops it out of the partial unique index's
   * predicate — so the slot is free. Counting all rows instead would leave that gym permanently
   * unable to have a primary, surfacing months later as a city page with no resolvable address.
   */
  const { useCase, written } = build({ existingBranches: [] }); // the closed one is not active
  await useCase.execute(REQUEST);

  assert.equal(written[0]?.isPrimary, true);
});

// ═══════════════════════════════════════════════════════════════════════════
// The read order
// ═══════════════════════════════════════════════════════════════════════════

test('an unknown gym stops everything — no branch list, no write', async () => {
  /*
   * The gym is resolved FIRST, and not for validation. `branches.gym_id` has a foreign key, so
   * inserting against another tenant's gym fails anyway — as a constraint violation, which is a
   * 500 that tells the caller a row they cannot see exists.
   */
  const { useCase, calls } = build({ gymKnown: false });
  const outcome = await useCase.execute(REQUEST);

  assert.deepEqual(outcome, { ok: false, reason: 'UNKNOWN_GYM' });
  assert.deepEqual(calls, [`statusOf:${GYM}`], 'work happened after the gym was refused');
});

test('the gym STATUS is not a gate — §12 states no rule about which states may gain a branch', async () => {
  /*
   * An owner adding a location to a `DRAFT` or `SUSPENDED` gym is the ordinary case: a suspension
   * is about visibility, not about freezing the estate. Inventing a gate would be an unwritten
   * rule enforced in the lowest-authority place there is.
   */
  for (const status of ['DRAFT', 'PENDING_REVIEW', 'SUSPENDED', 'CLOSED', 'APPROVED'] as const) {
    const calls: string[] = [];
    const useCase = new CreateBranchUseCase(
      { statusOf: () => Promise.resolve({ ok: true, status }) } as never,
      { activeInGym: () => Promise.resolve([]) } as never,
      {
        create: (b: Record<string, unknown>) => {
          calls.push('create');
          return Promise.resolve({ id: 'x', ...b });
        },
      } as never,
    );

    const outcome = await useCase.execute(REQUEST);
    assert.equal(outcome.ok, true, `a ${status} gym was refused a branch`);
    assert.deepEqual(calls, ['create']);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Transcription — where `undefined` and `null` are not the same value
// ═══════════════════════════════════════════════════════════════════════════

test('every omitted optional reaches the repository as null, never undefined', async () => {
  /*
   * `undefined` is not a SQL value. A driver handed one either throws or, worse, binds it as the
   * string "undefined" — and `address_line2` is nullable, so the column would silently hold four
   * letters that look like an address line in every report.
   */
  const { useCase, written } = build({});
  await useCase.execute(REQUEST);

  const row = written[0]!;
  for (const column of ['addressLine2', 'localityId', 'capacity']) {
    assert.equal(row[column], null, `${column} was not normalised to null`);
  }
  assert.ok(!Object.values(row).includes(undefined), 'an undefined reached the repository');
});

test('geoToleranceMetres is null — unmeasured, and never zero (KL-114)', async () => {
  /*
   * `BR-GYM-08` needs a geocoder and none is bound. `null` is the column's own meaning. A `0`
   * would say the pin sits exactly on the address — a claim, made by something that measured
   * nothing, and the same coercion `AffectedMembershipsUnavailableAdapter` refuses.
   */
  const { useCase, written } = build({});
  await useCase.execute(REQUEST);

  assert.equal(written[0]?.geoToleranceMetres, null);
});

test('landmark and parking_notes are accepted and DROPPED — no column exists', async () => {
  // `Gym.md` §12.2 lists both as optional request fields; `Schema.md` §4 is a closed register and
  // `branches` has neither. Rejecting them would break a documented contract over a storage gap.
  const { useCase, written } = build({});
  await useCase.execute({ ...REQUEST, landmark: 'near the metro', parking_notes: 'two levels' });

  assert.ok(!('landmark' in written[0]!));
  assert.ok(!('parking_notes' in written[0]!));
});

test('the stored row is returned, not the request that was sent', async () => {
  /*
   * `location` makes a round trip through `geography(Point,4326)` and back out through
   * `ST_Y`/`ST_X`. Echoing the request would render what the client asked for; returning the row
   * renders what PostGIS holds, so a transposed coordinate is visible in the 201 body.
   */
  const useCase = new CreateBranchUseCase(
    { statusOf: () => Promise.resolve({ ok: true, status: 'APPROVED' }) } as never,
    { activeInGym: () => Promise.resolve([]) } as never,
    {
      create: () => Promise.resolve({ id: 'from-the-database', lat: 19.076, lng: 72.877 }),
    } as never,
  );

  const outcome = await useCase.execute(REQUEST);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.branch.id, 'from-the-database');
});
