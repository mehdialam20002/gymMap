/**
 * M-005 · The compose file's own acceptance criteria, asserted without Docker.
 *
 * AC-1 (four services reach `healthy`) genuinely needs a Docker daemon and is verified by
 * `pnpm infra:verify` against a running stack. Everything else about the milestone is a property
 * of the FILE, and those properties are worth pinning here because each of them fails silently:
 * an unpinned tag, a fourth Redis database, a kyc bucket that is private only by default.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { REQUIRED_SERVICES, imageFor, readPinnedImages } from './harness/images.ts';

const COMPOSE = resolve('../../infra/compose/compose.yaml');
const INITDB = resolve('../../infra/compose/initdb/01-extensions.sql');

const compose = readFileSync(COMPOSE, 'utf8');
const initdb = readFileSync(INITDB, 'utf8');

test('the four services exist', () => {
  const images = readPinnedImages(COMPOSE);
  for (const service of REQUIRED_SERVICES) {
    assert.ok(
      images.some((i) => i.service === service),
      `compose service "${service}" is missing`,
    );
  }
});

test('AC-6 — every image is pinned to a digest', () => {
  for (const image of readPinnedImages(COMPOSE)) {
    assert.ok(
      image.digest.startsWith('sha256:'),
      `${image.service} uses "${image.tag}" with no digest. A tag is mutable: the publisher can ` +
        `repoint it, so CI and a developer's machine silently run different builds.`,
    );
    assert.match(image.digest, /^sha256:[0-9a-f]{64}$/, `${image.service} has a malformed digest`);
  }
});

test('AC-6 — no floating :latest anywhere', () => {
  assert.ok(!/image:\s*\S*:latest/.test(compose), 'a :latest tag would fail pipeline-integrity');
});

test('the Testcontainers harness resolves the same reference compose runs', () => {
  // The whole point of parsing rather than duplicating. If this ever needed a second list to
  // stay in step, the divergence it exists to prevent would already be possible.
  for (const service of REQUIRED_SERVICES) {
    const reference = imageFor(service, COMPOSE);
    assert.ok(compose.includes(reference), `${service}: harness and compose disagree`);
  }
});

test('imageFor refuses an unknown service rather than inventing a tag', () => {
  assert.throws(() => imageFor('mongodb', COMPOSE), /No image pinned/);
});

test('AC-2 — Redis is capped at exactly three logical databases', () => {
  assert.match(
    compose,
    /--databases\s*\n\s*-\s*"3"/,
    'Redis must expose exactly 3 databases (cache, queue, ratelimit). The default of 16 lets ' +
      'someone use db 7, creating a namespace Terraform never provisioned.',
  );
});

test('AC-2 — BullMQ eviction is disabled', () => {
  assert.match(
    compose,
    /maxmemory-policy\s*\n\s*-\s*noeviction/,
    'An evicted BullMQ key is a job that was accepted and will never run, with nothing reporting it.',
  );
});

test('AC-3 — the kyc bucket is explicitly made private, then verified', () => {
  assert.match(compose, /mc anonymous set none local\/gymmap-kyc/, 'kyc privacy is only a default');
  assert.match(
    compose,
    /mc anonymous get local\/gymmap-kyc/,
    'the kyc policy is set but never read back. BR-DAT-07 covers PAN, Aadhaar and bank proofs; ' +
      'a silently-public bucket is the failure that must be impossible.',
  );
});

test('AC-3 — media stays publicly readable', () => {
  assert.match(compose, /mc anonymous set download local\/gymmap-media/);
});

test('AC-5 — no transaction-mode pooler in the local path', () => {
  // ADR-0004: a transaction-mode pooler breaks `SET LOCAL app.tenant_id`, because the statement
  // and the query can land on different backend connections. Local must have the same posture
  // as production or the tenancy work in M-010 is developed against the wrong shape.
  assert.ok(
    !/pgbouncer|pgpool|supavisor/i.test(compose),
    'a transaction-mode pooler would break RLS',
  );
});

test('the four long-running services all declare a health check', () => {
  // minio-init is a one-shot job and correctly has none.
  const healthchecks = compose.match(/healthcheck:/g) ?? [];
  assert.equal(healthchecks.length, 4, 'each long-running service needs a health check');
});

// ---------------------------------------------------------------------------
// initdb — the trap this milestone names.
// ---------------------------------------------------------------------------

test('THE TRAP — initdb refuses any Postgres other than 16', () => {
  // Several PostGIS images ship a different Postgres than their tag implies. The mismatch is
  // invisible until a GiST predicate plans differently, months later.
  assert.match(initdb, /server_version_num/, 'no version assertion');
  assert.match(initdb, /<>\s*16|!=\s*16/, 'the assertion does not pin major version 16');
  assert.match(initdb, /RAISE EXCEPTION/, 'a mismatch must refuse to start, not warn');
});

test('initdb ASSERTS extension availability and does not CREATE extensions', () => {
  // Ruling R-M1 gives extension creation to the 0_init migration (M-006). Creating them here
  // too would mean local gets them from Docker and production from the migration — the exact
  // local/production divergence this milestone exists to remove.
  assert.match(initdb, /pg_available_extensions/, 'availability is not asserted');

  // Strip `--` comments before looking for executable SQL. The file legitimately DISCUSSES
  // `CREATE EXTENSION` in the comment explaining why it does not run one, and a naive scan of
  // the raw text flags that prose — a false positive that would push someone to delete the
  // explanation in order to make the test pass.
  const executable = initdb
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

  assert.ok(
    !/CREATE\s+EXTENSION/i.test(executable),
    'initdb creates extensions. That belongs to the 0_init migration (M-006, ruling R-M1); ' +
      'doing it here makes the migration a silent no-op locally and untested until production.',
  );
});

test('initdb requires every extension 0_init will need', () => {
  for (const extension of [
    'postgis',
    'pg_trgm',
    'unaccent',
    'btree_gin',
    'btree_gist',
    'pgcrypto',
    'pg_stat_statements',
  ]) {
    assert.ok(initdb.includes(`'${extension}'`), `${extension} is not asserted`);
  }
});

test('the database is forced to UTC', () => {
  // India is UTC+05:30 with no DST, so the local day boundary is 18:30 UTC the previous day and
  // the financial year rolls at 18:30 UTC on 31 March. Every one of those calculations depends
  // on storage being UTC rather than on a server setting.
  assert.match(initdb, /SET timezone TO 'UTC'/);
});
