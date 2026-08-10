/**
 * `M-031` · `ref:generate`, and the taxonomy checked against the document that fixes it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE KEYS ARE READ OUT OF `SeedStrategy.md` §3.7, NOT RESTATED HERE
 *
 * `ADR-0042` adds a display layer — `name`, `icon`, `slug`, `sort_order` — over keys that §3.7
 * already fixes. The display layer is editable through the `FR-ADMN-06` path; the KEYS are not,
 * because `RD2` derives every `id` from the key and an id is permanent.
 *
 * So the one thing that must never drift is the key set, and a test that restated it would drift
 * with the CSV it is meant to police. This greps the specification.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BUSINESS_KEY,
  NS_REFERENCE,
  emitInsert,
  readCsv,
  referenceUuid,
} from './reference-generate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const csv = (name) =>
  readCsv(readFileSync(resolve(ROOT, 'apps/server/prisma/reference', name), 'utf8'));
const SPEC = readFileSync(resolve(ROOT, 'docs/database/SeedStrategy.md'), 'utf8');

/** §3.7's six display groups with the counts the document states in its own headers. */
const GROUPS = {
  Facilities: 16,
  Equipment: 16,
  Classes: 12,
  Services: 6,
  Accessibility: 6,
  Hours: 3,
};

test('§3.7 — every amenity key in the CSV appears in the specification', () => {
  const rows = csv('amenities.csv');
  assert.equal(rows.length, 59, '§1.4 fixes amenities.csv at 59 rows');

  for (const row of rows) {
    assert.ok(
      SPEC.includes(`\`${row.key}\``),
      `${row.key} is in the CSV and not in SeedStrategy.md §3.7 — an invented key gets a permanent ` +
        `id, because RD2 derives it from the key`,
    );
  }
});

test('§3.7 — the six display groups reconcile to the counts the document states', () => {
  const counts = {};
  for (const row of csv('amenities.csv'))
    counts[row.display_group] = (counts[row.display_group] ?? 0) + 1;
  assert.deepEqual(counts, GROUPS);
});

test('§3.7 — every gym_category key in the CSV appears in the specification', () => {
  const rows = csv('gym-categories.csv');
  assert.equal(rows.length, 15, '§1.4 fixes gym-categories.csv at 15 rows');
  for (const row of rows) assert.ok(SPEC.includes(`\`${row.key}\``), `${row.key} is not in §3.7`);
});

// ═══════════════════════════════════════════════════════════════════════════
// The display layer's own rules — ADR-0042
// ═══════════════════════════════════════════════════════════════════════════

test('every icon is distinct — no glyph does two jobs', () => {
  // `IC4` makes glyph choice reviewable, and a reused glyph is the failure it is guarding: two
  // amenities that look identical in a chip row are two the member cannot tell apart.
  const icons = csv('amenities.csv').map((r) => r.icon);
  assert.equal(new Set(icons).size, icons.length);
});

test('sort_order is a contiguous global 1..59, not per-group', () => {
  /*
   * `AC-GYM-04.3`: *"exactly the top three by platform-defined display priority appear, and the
   * detail page shows all twelve grouped by amenity category."* A per-group order cannot answer
   * "top three of twelve ACROSS groups"; a global order answers both, because sorting a group by
   * the global key is still a stable within-group order.
   */
  const orders = csv('amenities.csv')
    .map((r) => Number(r.sort_order))
    .sort((a, b) => a - b);
  assert.deepEqual(
    orders,
    Array.from({ length: 59 }, (_, i) => i + 1),
  );
});

test('every category slug satisfies the slug domain and is unique', () => {
  const rows = csv('gym-categories.csv');
  for (const row of rows) {
    assert.match(row.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${row.key}: slug violates the domain`);
  }
  assert.equal(new Set(rows.map((r) => r.slug)).size, rows.length);
});

test('no display name contains a comma — the CSV reader cannot express one', () => {
  // The reader is deliberately quote-free (see its header). This asserts the constraint that makes
  // that safe, rather than leaving it as a property somebody discovers by breaking it.
  for (const file of ['amenities.csv', 'gym-categories.csv']) {
    for (const row of csv(file)) assert.ok(!row.name.includes(','), `${row.name} contains a comma`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The generator itself
// ═══════════════════════════════════════════════════════════════════════════

test('RD2 — the id derives from the namespace and the business key, and nothing else', () => {
  assert.equal(NS_REFERENCE, '3f8a2d10-0000-5000-b000-000000000000');
  assert.equal(
    referenceUuid('amenities', 'SWIMMING_POOL'),
    referenceUuid('amenities', 'SWIMMING_POOL'),
  );
  assert.notEqual(
    referenceUuid('amenities', 'SWIMMING_POOL'),
    referenceUuid('gym_categories', 'SWIMMING_POOL'),
  );
});

test('no CSV carries an id column — the generator computes it', () => {
  // `RD2`'s point: a human never types a uuid, so a human cannot get one wrong.
  for (const file of ['amenities.csv', 'gym-categories.csv', 'countries.csv']) {
    assert.ok(!Object.keys(csv(file)[0]).includes('id'), `${file} has an id column`);
  }
});

test('RD5 — the emitted SQL carries no ON CONFLICT clause', () => {
  /*
   * "Silent no-op is how two environments diverge without anyone noticing." Under forward-only
   * migrations a duplicate can only mean the migration ran twice, which is itself the defect.
   */
  const sql = emitInsert('amenities', csv('amenities.csv'), [
    'key',
    'name',
    'icon',
    'display_group',
    'sort_order',
  ]);
  assert.ok(!/ON CONFLICT/i.test(sql));
});

test('the emit is deterministic — same CSV, byte-identical SQL', () => {
  // Otherwise `reference-data-drift` reports a change nobody made, every run, and stops being read.
  const rows = csv('gym-categories.csv');
  const cols = ['key', 'name', 'slug', 'sort_order'];
  assert.equal(emitInsert('gym_categories', rows, cols), emitInsert('gym_categories', rows, cols));
});

test('the reader refuses a row whose cell count does not match the header', () => {
  // The failure mode a quote-free reader has, made loud rather than silently shifting columns.
  assert.throws(() => readCsv('a,b,c\n1,2\n'), /has 2 cells, header has 3/);
});

// ═══════════════════════════════════════════════════════════════════════════
// cities — §3.6's twelve, and the argument order that is easiest to get wrong
// ═══════════════════════════════════════════════════════════════════════════

test('§3.6 — all twelve city slugs appear in the specification, and only those', () => {
  const rows = csv('cities.csv');
  assert.equal(rows.length, 12, '§3.6 fixes twelve metros');
  for (const row of rows) assert.ok(SPEC.includes(`\`${row.slug}\``), `${row.slug} is not in §3.6`);
});

test('§3.6 — every city starts PLANNED, because the launch city is a C9.4 decision', () => {
  /*
   * *"`OQ-01` fixed the launch COUNTRY; the launch CITY is selected separately against the `C9.4`
   * criteria. Until then every Indian city is `PLANNED`."* Open item `O-5`.
   *
   * A city arriving as `LIVE` in a data file would bypass five measurable gate criteria with a
   * CSV edit, which is exactly the kind of change nobody reviews as a decision.
   */
  for (const row of csv('cities.csv')) {
    assert.equal(row.status, 'PLANNED', `${row.slug} is not PLANNED`);
    assert.equal(row.timezone, 'Asia/Kolkata');
  }
});

test('ST_MakePoint gets LONGITUDE first — the swap that puts Mumbai in the ocean', () => {
  /*
   * Swapped, Mumbai's 19.076N 72.877E becomes 72.877N 19.076E — the Norwegian Sea. A valid point
   * on the right planet, which no "is this a geography" check would catch and no visual review of
   * a CSV would either, because the CSV is right and only the emit is wrong.
   *
   * Asserted on the generated SQL, which is the artefact that can be wrong.
   */
  const rows = csv('cities.csv');
  const sql = emitInsert('cities', rows, [
    'country_code',
    'name',
    'slug',
    'centroid',
    'status',
    'timezone',
  ]);

  const mumbai = rows.find((r) => r.slug === 'mumbai');
  assert.ok(
    sql.includes(`ST_MakePoint(${Number(mumbai.longitude)}, ${Number(mumbai.latitude)})`),
    'longitude must be the FIRST argument',
  );

  // And every Indian city sits in India's bounding box, so a swap anywhere is caught, not just Mumbai.
  for (const row of rows) {
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    assert.ok(lat > 6 && lat < 37, `${row.slug}: latitude ${String(lat)} is outside India`);
    assert.ok(lon > 68 && lon < 98, `${row.slug}: longitude ${String(lon)} is outside India`);
  }
});

test('BUSINESS_KEY covers every table the generator can emit', () => {
  for (const table of ['countries', 'cities', 'localities', 'amenities', 'gym_categories']) {
    assert.equal(typeof BUSINESS_KEY[table], 'function', `${table} has no business-key rule`);
  }
});
