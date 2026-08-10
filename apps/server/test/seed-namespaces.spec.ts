/**
 * The two seed uuid namespaces, pinned to the literals their specifications fix.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS FILE EXISTS BECAUSE ONE OF THEM WAS WRONG FROM THE DAY IT WAS WRITTEN
 *
 * `SEED_NAMESPACE` held `6b1d5c2e-9f34-4a7d-8c15-2e0a7b3f6d81`, a value that appears in no
 * document. Two binding rank-3 specifications fix it, agree with each other, and both say it is
 * never changed:
 *
 *   `SeedStrategy.md` §5.1    `const NS_SEED = '6f2b7c1e-0000-5000-a000-000000000000';`
 *                             — "the §C8.2 seed namespace — NEVER changed"
 *   `TestingStrategy.md` §6.1 the same literal — "the GymMap seed namespace, never changed"
 *
 * Nothing caught it, because a namespace has no wrong ANSWER — every value produces well-formed,
 * stable, deterministic uuids. It is wrong only against a document, so only a test that reads the
 * document can find it. `SD-2` proves a refactor changed nothing by comparing checksums; a
 * checksum comparison cannot tell you the checksum was computed over the wrong namespace all along.
 *
 * `DT2` and §7.2 say changing a namespace is "a coordinated migration of every committed
 * expectation in the repository". That is the cost this test exists to stop anyone paying twice.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  REFERENCE_NAMESPACE,
  SEED_NAMESPACE,
  referenceUuid,
  seedUuid,
} from '../prisma/seed/roles.ts';

const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * The specification text, read rather than restated — the whole point of the file.
 *
 * `resolve()` from the process cwd, not `import.meta.url`: this package builds to CommonJS, where
 * `import.meta` is a compile error (TS1470). Every spec here runs with cwd at `apps/server`, which
 * is the convention `address-normaliser.spec.ts` already relies on for its fixture.
 */
function docContains(path: string, needle: string): boolean {
  return readFileSync(resolve('../..', path), 'utf8').includes(needle);
}

test('NS_SEED is the literal SeedStrategy.md §5.1 and TestingStrategy.md §6.1 both fix', () => {
  assert.equal(SEED_NAMESPACE, '6f2b7c1e-0000-5000-a000-000000000000');

  // Read from the documents, not asserted against a copy of them. A restated expectation drifts
  // with the code it is meant to police; a document read does not.
  assert.ok(
    docContains('docs/database/SeedStrategy.md', SEED_NAMESPACE),
    'SeedStrategy.md no longer contains this namespace — the document moved, or the code did',
  );
  assert.ok(
    docContains('docs/engineering/TestingStrategy.md', SEED_NAMESPACE),
    'TestingStrategy.md no longer contains this namespace',
  );
});

test('NS_REFERENCE is the literal RD2 fixes, and it is NOT the seed namespace (DT2a)', () => {
  assert.equal(REFERENCE_NAMESPACE, '3f8a2d10-0000-5000-b000-000000000000');
  assert.ok(docContains('docs/database/SeedStrategy.md', REFERENCE_NAMESPACE));

  /*
   * `DT2a` is the assertion that matters here, not the literal.
   *
   * If the two namespaces were ever collapsed into one, a fixture id and a reference id could
   * collide — and `SEP9`'s drift check, which is a set comparison over reference uuids, would
   * start counting a test tenant's row as reference data that had appeared from nowhere.
   */
  assert.notEqual(SEED_NAMESPACE, REFERENCE_NAMESPACE, 'DT2a: the two namespaces must differ');
});

test('both derive well-formed UUIDv5 — version and variant bits, not just a hash', () => {
  // A `uuid` column accepts a malformed value from a text literal and then sorts and indexes it
  // strangely, which is a defect that surfaces as a slow query rather than as an error.
  assert.match(seedUuid('role', 'GYM_OWNER'), UUID_V5);
  assert.match(referenceUuid('amenities', 'SWIMMING_POOL'), UUID_V5);
});

test('the same input always gives the same uuid, and a different one never does', () => {
  assert.equal(seedUuid('role', 'GYM_OWNER'), seedUuid('role', 'GYM_OWNER'));
  assert.notEqual(seedUuid('role', 'GYM_OWNER'), seedUuid('role', 'RECEPTIONIST'));

  // The kind is part of the name, so a role and a permission sharing a key stay distinct.
  assert.notEqual(seedUuid('role', 'X'), seedUuid('permission', 'X'));
});

test('a reference uuid and a seed uuid for the same string are different values', () => {
  // The concrete form of DT2a. Same name, two namespaces, two ids — which is what lets a SELECT
  // tell a reference row from a fixture row by regenerating the id.
  assert.notEqual(
    seedUuid('amenities', 'SWIMMING_POOL'),
    referenceUuid('amenities', 'SWIMMING_POOL'),
  );
});
