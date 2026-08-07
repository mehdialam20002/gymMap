/**
 * M-015 · Six fixtures, one per `IG-` gate, each failing with its own message.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE GATE THAT GUARDS THE MOST IMPORTANT SUITE MUST ITSELF BE PROVED TO BITE
 *
 * `isolation-coverage` is green today with two routes and zero uncovered. It would be equally
 * green if `buildInventory` returned nothing, if the tenant-scoped flag were misspelled, or if
 * every gate had an inverted condition. A gate whose only evidence is "it passes" is a gate
 * nobody has tested.
 *
 * So each fixture below constructs the exact situation the gate exists to catch, and asserts
 * the gate catches it AND names it. The messages are asserted too: a gate that fails with
 * "error" teaches nobody, and the failure this produces on a Friday afternoon has to be
 * actionable by whoever caused it.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  SEED_TENANT_A_COUNTS,
  SEED_TENANT_B_IDS,
  audienceOf,
  buildInventory,
  classify,
  diffInventory,
  expectedRefusalFor,
  renderInventory,
  repoRoot,
  runGates,
} from './isolation-coverage.mjs';

const ROOT = repoRoot();

/** A minimal OpenAPI document with one tenant-scoped operation. */
function doc(path, method = 'get', extra = {}) {
  return {
    paths: {
      [path]: {
        [method]: {
          'x-gymmap-tenant-scoped': true,
          'x-gymmap-permission': 'catalog.gym.read',
          ...extra,
        },
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// The control. Everything below is meaningless if the baseline is not clean.
// ═══════════════════════════════════════════════════════════════════════════

test('CONTROL — a fully-covered route produces no problems', () => {
  const inventory = buildInventory(doc('/v1/tenant/{tenantRef}/ping'));
  assert.equal(inventory.routes.length, 1, 'the generator found no tenant-scoped route');
  assert.deepEqual(runGates({ inventory, env: {} }).problems, []);
});

test('CONTROL — the live contract yields a NON-EMPTY inventory', () => {
  // The gate's baseline is two routes. A generator returning zero would report "0 uncovered"
  // and pass forever — the same shape as the elevation inventory's zero baseline, and the same
  // fix: prove the thing finds something real.
  const live = buildInventory(JSON.parse(readFileSync(resolve(ROOT, 'openapi.json'), 'utf8')));
  assert.ok(
    live.routes.length >= 2,
    `the live contract yielded ${live.routes.length} tenant-scoped routes. The suite would ` +
      'report full coverage of nothing.',
  );
  assert.ok(
    live.routes.every((r) => r.permission.length > 0),
    'a route carries no permission',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// IG-1 — a @TenantScoped route with no case group fails the build.
// ═══════════════════════════════════════════════════════════════════════════

test('IG-1 — a new tenant-scoped route appears as ADDED against the committed inventory', () => {
  // The Friday-afternoon case, and the whole reason this file exists.
  const committed = buildInventory(doc('/v1/tenant/ping'));
  const live = buildInventory({
    paths: {
      '/v1/tenant/ping': doc('/v1/tenant/ping').paths['/v1/tenant/ping'],
      '/v1/tenant/gyms/{gymId}': doc('/v1/tenant/gyms/{gymId}').paths['/v1/tenant/gyms/{gymId}'],
    },
  });

  const diff = diffInventory(live, committed);
  assert.deepEqual(diff.added, ['GET /v1/tenant/gyms/{gymId}']);
  assert.deepEqual(diff.removed, []);
});

test('IG-1 — a changed ATTRIBUTE is caught, not only a changed route list', () => {
  // A route that turns from a read into a mutation changes WHICH assertions apply: A2's
  // before/after checksum starts mattering and A1's read assertion stops being sufficient. The
  // route key is identical, so a key-only diff would miss it entirely.
  const before = buildInventory(doc('/v1/tenant/gyms/{gymId}', 'get'));
  const after = buildInventory(
    doc('/v1/tenant/gyms/{gymId}', 'get', { 'x-gymmap-permission': 'catalog.gym.write' }),
  );

  const diff = diffInventory(after, before);
  assert.deepEqual(diff.added, []);
  assert.deepEqual(diff.removed, []);
  assert.deepEqual(diff.changed, ['GET /v1/tenant/gyms/{gymId}']);
});

// ═══════════════════════════════════════════════════════════════════════════
// IG-2 — a dead case cannot inflate apparent coverage.
// ═══════════════════════════════════════════════════════════════════════════

test('IG-2 — a case group for a deleted route appears as REMOVED', () => {
  // Twelve routes covered, four of them deleted last quarter, is worse than eight covered: the
  // number is the thing people read, and it is now a lie in the safe-looking direction.
  const committed = buildInventory({
    paths: {
      '/v1/tenant/ping': doc('/v1/tenant/ping').paths['/v1/tenant/ping'],
      '/v1/tenant/legacy': doc('/v1/tenant/legacy').paths['/v1/tenant/legacy'],
    },
  });
  const live = buildInventory(doc('/v1/tenant/ping'));

  const diff = diffInventory(live, committed);
  assert.deepEqual(diff.removed, ['GET /v1/tenant/legacy']);
});

// ═══════════════════════════════════════════════════════════════════════════
// IG-3 — a seed defect fails HERE, never as a silent skip.
// ═══════════════════════════════════════════════════════════════════════════

test('IG-3 — an item route with no seeded tenant-B id fails, naming the parameter', () => {
  const inventory = buildInventory(doc('/v1/tenant/gyms/{gymId}'));
  const { problems, uncovered } = runGates({ inventory, env: {} });

  assert.equal(problems.length, 1);
  assert.equal(problems[0].gate, 'IG-3');
  // Names the parameter, so the fix is obvious rather than a hunt through the seed.
  assert.match(problems[0].message, /gymId/);
  assert.match(problems[0].message, /silently skip/);
  assert.deepEqual(uncovered, ['GET /v1/tenant/gyms/{gymId}']);
});

test('IG-3 — a seeded parameter passes, so the gate is not simply always-fail', () => {
  // The negative half. Without it, IG-3 passing its fixture proves only that runGates returns
  // problems for everything.
  const inventory = buildInventory(doc('/v1/tenant/{tenantRef}/ping'));
  assert.deepEqual(runGates({ inventory, env: {} }).problems, []);
  assert.ok('tenantRef' in SEED_TENANT_B_IDS);
});

// ═══════════════════════════════════════════════════════════════════════════
// IG-4 — a set-returning route with a zero expected count.
// ═══════════════════════════════════════════════════════════════════════════

test('IG-4 — a collection with no non-zero tenant-A count fails', () => {
  const inventory = buildInventory(doc('/v1/tenant/gyms'));
  const { problems } = runGates({ inventory, env: {} });

  assert.equal(problems.length, 1);
  assert.equal(problems[0].gate, 'IG-4');
  // The message names the actual danger rather than the rule: A4 asserting "returns 0 rows and
  // that is correct" is exactly what a globally broken tenant variable also produces.
  assert.match(problems[0].message, /catastrophic false pass/);
});

test('IG-4 — a SEARCH route is held to the same rule as a COLLECTION', () => {
  // A5's leaky six: search does not LOOK like a resource read, which is precisely why it gets
  // forgotten. It must not slip past IG-4 because of its shape.
  const inventory = buildInventory(doc('/v1/tenant/search/gyms'));
  assert.equal(inventory.routes[0].kind, 'SEARCH');
  const { problems } = runGates({ inventory, env: {} });
  assert.equal(problems[0].gate, 'IG-4');
});

test('IG-4 — the seeded collection passes', () => {
  const inventory = buildInventory(doc('/v1/tenant/ping'));
  assert.deepEqual(runGates({ inventory, env: {} }).problems, []);
  assert.equal(SEED_TENANT_A_COUNTS['/v1/tenant/ping'], 1);
});

// ═══════════════════════════════════════════════════════════════════════════
// IG-5 — the suite runs unfiltered and uncached.
// ═══════════════════════════════════════════════════════════════════════════

test('IG-5 — CI without TURBO_FORCE fails', () => {
  // A cached isolation result is a result from a DIFFERENT COMMIT. An isolation gate that
  // reports a cache hit is an isolation gate that did not run, and it reports success.
  const inventory = buildInventory(doc('/v1/tenant/ping'));
  const { problems } = runGates({ inventory, env: { CI: 'true' } });

  assert.equal(problems.length, 1);
  assert.equal(problems[0].gate, 'IG-5');
  assert.match(problems[0].message, /did not run/);
});

test('IG-5 — CI with TURBO_FORCE passes, and local runs are not forced', () => {
  const inventory = buildInventory(doc('/v1/tenant/ping'));
  assert.deepEqual(runGates({ inventory, env: { CI: 'true', TURBO_FORCE: 'true' } }).problems, []);
  // Locally the cache is left alone — forcing it for every developer on every run would make
  // the gate the slowest thing in the loop, and slow gates get bypassed.
  assert.deepEqual(runGates({ inventory, env: {} }).problems, []);
});

// ═══════════════════════════════════════════════════════════════════════════
// IG-6 is satisfied UPSTREAM, and that is worth asserting rather than assuming.
// ═══════════════════════════════════════════════════════════════════════════

test('IG-6 — a tenant-scoped route with no permission is caught by api-gates PG-1 first', () => {
  // This gate does not re-check it. The assertion here is that the upstream gate EXISTS, so
  // "satisfied upstream" is a verified claim rather than a comment.
  const gates = readFileSync(resolve(ROOT, 'packages/config/scripts/api-gates.mjs'), 'utf8');
  assert.match(gates, /declares no permission and is not @Public\(\)/);
  // And the inventory records an empty permission rather than defaulting one, so if PG-1 were
  // ever weakened the gap would be visible in the committed file.
  const inventory = buildInventory({
    paths: { '/v1/tenant/gyms': { get: { 'x-gymmap-tenant-scoped': true } } },
  });
  assert.equal(inventory.routes[0].permission, '');
});

// ═══════════════════════════════════════════════════════════════════════════
// Classification — the kind decides which assertions apply.
// ═══════════════════════════════════════════════════════════════════════════

test('IG-D / §2.3 — an item refusal is 404 and a collection refusal is an empty set', () => {
  // A 403 on a cross-tenant item read is an EXISTENCE ORACLE: it confirms the resource is real
  // and merely forbidden, which is exactly the fact the caller must not learn.
  assert.equal(expectedRefusalFor('ITEM'), 404);
  assert.equal(expectedRefusalFor('ACTION'), 404);
  for (const kind of ['COLLECTION', 'SEARCH', 'REPORT', 'EXPORT']) {
    assert.equal(expectedRefusalFor(kind), 'EMPTY_SET', `${kind} must not refuse with an error`);
  }
});

test('a mutation is an ACTION even when its path ends in a parameter', () => {
  // Otherwise A1's read assertion applies and nobody checks whether the row survived — which is
  // the failure A2's checksum exists for.
  assert.equal(classify('DELETE', '/v1/tenant/gyms/{gymId}'), 'ACTION');
  assert.equal(classify('PATCH', '/v1/tenant/gyms/{gymId}'), 'ACTION');
  assert.equal(classify('GET', '/v1/tenant/gyms/{gymId}'), 'ITEM');
});

test("A5's leaky six classify as themselves, not as collections", () => {
  // Search, reports and exports are named in E2E-11 and IS5 precisely because they do not look
  // like resource reads. A generic classifier folds them into COLLECTION and the naming is lost.
  assert.equal(classify('GET', '/v1/tenant/search/gyms'), 'SEARCH');
  assert.equal(classify('GET', '/v1/tenant/gyms/suggest'), 'SEARCH');
  assert.equal(classify('GET', '/v1/tenant/reports/revenue'), 'REPORT');
  assert.equal(classify('GET', '/v1/tenant/exports/members'), 'EXPORT');
});

test('a sub-resource of one item is an ITEM, not a collection', () => {
  assert.equal(classify('GET', '/v1/tenant/{tenantRef}/ping'), 'ITEM');
  assert.equal(classify('GET', '/v1/tenant/gyms'), 'COLLECTION');
});

test('§5.5 — every non-tenant route is assigned an audience rather than dropped', () => {
  assert.equal(audienceOf('/healthz'), 'PROBE');
  assert.equal(audienceOf('/v1/me/memberships'), 'ME');
  assert.equal(audienceOf('/v1/tenant/ping'), 'TENANT');
  assert.equal(audienceOf('/v1/admin/applications'), 'ADMIN');
  assert.equal(audienceOf('/v1/webhooks/razorpay'), 'WEBHOOK');
  assert.equal(audienceOf('/v1/gyms/bengaluru/iron-temple'), 'PUBLIC');

  const live = buildInventory(JSON.parse(readFileSync(resolve(ROOT, 'openapi.json'), 'utf8')));
  for (const route of live.otherAudiences) {
    assert.ok(route.audience, `${route.method} ${route.path} has no audience`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The committed artefact.
// ═══════════════════════════════════════════════════════════════════════════

test('IG-E — the committed inventory matches the live contract', () => {
  const live = buildInventory(JSON.parse(readFileSync(resolve(ROOT, 'openapi.json'), 'utf8')));
  const committed = readFileSync(
    resolve(ROOT, 'apps/server/test/isolation/_inventory.generated.ts'),
    'utf8',
  );
  assert.equal(renderInventory(live).trim(), committed.trim());
});

test('IG-F — the committed inventory says it is generated, in its first lines', () => {
  // A hand edit is the failure mode: somebody deletes a route from the inventory to make the
  // suite pass. The banner is the first thing an editor sees, and the text diff against the
  // generator is what actually stops it.
  const committed = readFileSync(
    resolve(ROOT, 'apps/server/test/isolation/_inventory.generated.ts'),
    'utf8',
  );
  assert.match(committed.slice(0, 400), /GENERATED by/);
  assert.match(committed.slice(0, 400), /DO NOT EDIT/);
});

test('the generator is deterministic and sorted', () => {
  // It is diffed against a committed file; nondeterminism makes that gate fail at random, and a
  // gate that cries wolf gets muted — on the one suite where that must never happen.
  const document = {
    paths: {
      '/v1/tenant/zebra': doc('/v1/tenant/zebra').paths['/v1/tenant/zebra'],
      '/v1/tenant/alpha': doc('/v1/tenant/alpha').paths['/v1/tenant/alpha'],
    },
  };
  const first = buildInventory(document);
  assert.deepEqual(first, buildInventory(document));
  assert.deepEqual(
    first.routes.map((r) => r.path),
    ['/v1/tenant/alpha', '/v1/tenant/zebra'],
  );
});

test('the duplicated classifier matches the TypeScript one it copies', () => {
  // `_inventory.ts` holds the same logic for the suite to use; this `.mjs` copy exists so job 13
  // can fail a missing case group even when apps/server does not build. Duplication is only safe
  // while something asserts it.
  const ts = readFileSync(resolve(ROOT, 'apps/server/test/isolation/_inventory.ts'), 'utf8');
  for (const fragment of [
    "if (MUTATING.has(method)) return 'ACTION';",
    "if (/\\/search(\\/|$)|\\/suggest$/.test(afterVersion)) return 'SEARCH';",
    "if (/\\/reports?(\\/|$)/.test(afterVersion)) return 'REPORT';",
    "if (/\\/exports?(\\/|$)/.test(afterVersion)) return 'EXPORT';",
  ]) {
    assert.ok(ts.includes(fragment), `_inventory.ts has diverged: missing "${fragment}"`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The suite's own script must actually run every spec file it contains.
// ═══════════════════════════════════════════════════════════════════════════

test('every isolation spec file is matched by the test:isolation glob', () => {
  // Found the hard way. `test:isolation` listed `*.int-spec.ts` and `*.isolation-spec.ts`
  // explicitly, which silently excluded `dropped-policy.negative-spec.ts` — A7, the assertion
  // that makes the other six falsifiable. A file that exists and is never run is exactly the
  // failure this milestone exists to prevent, and it was in the milestone's own script.
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'apps/server/package.json'), 'utf8'));
  const glob = manifest.scripts['test:isolation'];

  const specs = readdirSync(resolve(ROOT, 'apps/server/test/isolation')).filter((f) =>
    /-spec\.tsx?$/.test(f),
  );
  assert.ok(specs.length >= 6, `only ${specs.length} isolation specs found`);

  // Translate the shell glob to a regex and check each file against it, rather than eyeballing
  // the string — the whole point is that reading the glob is what failed.
  const patterns = [...glob.matchAll(/test\/isolation\/([^"'\s]+)/g)].map(
    (m) => new RegExp(`^${m[1].replaceAll('.', '\\.').replaceAll('*', '.*')}$`),
  );
  assert.ok(patterns.length > 0, `no glob found in test:isolation: ${glob}`);

  const unmatched = specs.filter((f) => !patterns.some((p) => p.test(f)));
  assert.deepEqual(
    unmatched,
    [],
    'isolation spec file(s) exist but are NOT run by "pnpm --filter @gymmap/server ' +
      `test:isolation":\n  ${unmatched.join('\n  ')}\n\n` +
      'A spec that never runs reports no failures, which is indistinguishable from passing.',
  );
});
