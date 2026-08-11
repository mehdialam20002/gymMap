/**
 * M-015 · CI job 13's gate — `IG-1` … `IG-6`. `BAC-10`, `IS3`, `PG-4`, `AC-FND-04.2`, DoD #16.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE ONE FAILURE THIS EXISTS TO PRODUCE
 *
 *   Handler GET /v1/tenant/gyms/{id} is @TenantScoped but absent from the isolation inventory
 *
 * Somebody adds a tenant-scoped route on a Friday afternoon and does not write a spec for it. A
 * hand-authored suite stays green. This does not.
 *
 * Every other gate in this repository answers "is what exists correct". This one answers "is
 * everything that exists covered" — a different question, and the one that decays silently.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Usage:
 *   node packages/config/scripts/isolation-coverage.mjs           # check, and print the summary
 *   node packages/config/scripts/isolation-coverage.mjs --write   # regenerate the inventory
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function repoRoot(from = process.cwd()) {
  let dir = resolve(from);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(from);
}

/**
 * Duplicated from `apps/server/test/isolation/_inventory.ts`, and asserted equal by
 * `isolation-coverage.spec.mjs`.
 *
 * The duplication is deliberate: this is an `.mjs` gate that must run in under a second with no
 * build step, and that is a `.ts` module inside the server's project. Importing across that
 * boundary would make job 13 depend on `apps/server` being built — which is exactly the
 * dependency that lets a broken build present as "isolation gate skipped".
 */
export function classify(method, path) {
  const afterVersion = path.replace(/^\/v\d+/, '');
  if (MUTATING.has(method)) return 'ACTION';
  if (/\/search(\/|$)|\/suggest$/.test(afterVersion)) return 'SEARCH';
  if (/\/reports?(\/|$)/.test(afterVersion)) return 'REPORT';
  if (/\/exports?(\/|$)/.test(afterVersion)) return 'EXPORT';
  if (/\{[^}]+\}$/.test(path)) return 'ITEM';
  if (/\{[^}]+\}\/[^/]+$/.test(path)) return 'ITEM';
  return 'COLLECTION';
}

export function expectedRefusalFor(kind) {
  return kind === 'ITEM' || kind === 'ACTION' ? 404 : 'EMPTY_SET';
}

export function buildInventory(document) {
  const routes = [];
  const otherAudiences = [];

  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const methodLower of HTTP_METHODS) {
      const operation = item[methodLower];
      if (!operation) continue;
      const method = methodLower.toUpperCase();

      if (operation['x-gymmap-tenant-scoped'] !== true) {
        otherAudiences.push({ method, path, audience: audienceOf(path) });
        continue;
      }
      const kind = classify(method, path);
      const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
      routes.push({
        method,
        path,
        kind,
        permission: operation['x-gymmap-permission'] ?? '',
        expectedRefusal: expectedRefusalFor(kind),
        needsTenantBId: parameters.length > 0,
        parameters,
      });
    }
  }

  routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  otherAudiences.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return { generatedFrom: 'openapi.json', routes, otherAudiences };
}

export function audienceOf(path) {
  if (path === '/healthz' || path === '/readyz') return 'PROBE';
  const afterVersion = path.replace(/^\/v\d+/, '');
  if (afterVersion.startsWith('/me')) return 'ME';
  if (afterVersion.startsWith('/tenant')) return 'TENANT';
  if (afterVersion.startsWith('/admin')) return 'ADMIN';
  if (afterVersion.startsWith('/webhooks')) return 'WEBHOOK';
  return 'PUBLIC';
}

/**
 * The seed's tenant-B ids, by path-parameter name.
 *
 * `IG-3` fails a route whose parameter has no entry here, so a SEED defect fails at this gate
 * with a named parameter — never as a silent skip inside the suite, which is where a missing
 * fixture usually hides.
 */
export const SEED_TENANT_B_IDS = {
  tenantRef: '01912f00-0000-7000-8000-00000000000b',

  /*
   * ┌─ `id` IS A GENERIC PARAMETER NAME, AND TODAY IT MEANS ONE THING ───────────────────────────┐
   * │ Seed `v0.6` · `branchId('peak:koregaon-park')` — tenant B's primary branch, derived through │
   * │ `seedUuid` and therefore stable across re-seeds.                                            │
   * │                                                                                            │
   * │ The three `/v1/tenant/branches/{id}` routes are the only `{id}` routes that exist. The      │
   * │ moment a second resource uses the same parameter name — `/v1/tenant/plans/{id}` at `M-036` —│
   * │ this map stops being able to express both, because it is keyed on the PARAMETER and not on  │
   * │ the route. A branch id addressed to a plans route would 404 for the wrong reason and `A1`   │
   * │ would pass having proved nothing.                                                           │
   * │                                                                                            │
   * │ Left as-is rather than pre-emptively re-keyed: the map is `IG-3`'s and changing its shape   │
   * │ changes the gate. Recorded so the next milestone to add an `{id}` route finds the reason    │
   * │ here instead of adding a second value and wondering why the first one moved.                 │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  id: '496d6f74-6de9-5f52-92ee-bf9904b3f682',
};

/**
 * Expected tenant-A row counts for set-returning routes.
 *
 * `IG-4` fails a COLLECTION / SEARCH / REPORT / EXPORT route whose expected count is zero,
 * because A4 — the positive control — could not then prove anything. An empty expected count
 * turns "the filter works" into "the filter returns nothing", and those look identical.
 */
export const SEED_TENANT_A_COUNTS = {
  // P-SELF: `tenants` has no tenant_id column, its PK IS the tenant id, so tenant A always sees
  // exactly itself.
  '/v1/tenant/ping': 1,

  /*
   * Seed `v0.6` gives tenant A exactly ONE branch, and `tenants.ts` has said so since `M-009`:
   * *"Single branch, the ordinary case."*
   *
   * One rather than three is deliberate on the A4 side. Tenant B holds three, so a globally broken
   * tenant variable — the failure `IG-4` exists to catch — produces the WRONG count here rather
   * than a plausible one: A4 asserting `1` fails loudly against a leak that returns 4.
   */
  '/v1/tenant/branches': 1,
};

export function runGates({ inventory, exceptedRoutes = new Set(), env = process.env }) {
  const problems = [];
  const fail = (gate, message) => problems.push({ gate, message });

  const covered = [];
  const uncovered = [];

  for (const route of inventory.routes) {
    const key = `${route.method} ${route.path}`;

    if (exceptedRoutes.has(key)) continue;

    // IG-3 — a route addressing one resource must have a tenant-B id to address it WITH.
    if (route.needsTenantBId) {
      const missing = route.parameters.filter((p) => !(p in SEED_TENANT_B_IDS));
      if (missing.length > 0) {
        fail(
          'IG-3',
          `${key} takes path parameter(s) ${missing.join(', ')} for which the seed supplies no ` +
            `tenant-B value. A1 and A2 cannot address tenant B's resource, so the case group ` +
            `would silently skip — which is indistinguishable from passing.`,
        );
        uncovered.push(key);
        continue;
      }
    }

    // IG-4 — a set-returning route needs a non-zero tenant-A count, or A4 proves nothing.
    if (['COLLECTION', 'SEARCH', 'REPORT', 'EXPORT'].includes(route.kind)) {
      const expected = SEED_TENANT_A_COUNTS[route.path];
      if (!expected) {
        fail(
          'IG-4',
          `${key} is a ${route.kind} with no non-zero tenant-A expected count. A4's positive ` +
            `control would assert "returns 0 rows and that is correct", which is exactly the ` +
            `catastrophic false pass: a globally broken tenant variable produces the same result.`,
        );
        uncovered.push(key);
        continue;
      }
    }

    covered.push(key);
  }

  // IG-5 — the suite must run unfiltered and uncached. Only checked in CI, because forcing
  // TURBO_FORCE locally would defeat the cache for every developer on every run.
  if (env['CI'] === 'true' && env['TURBO_FORCE'] !== 'true') {
    fail(
      'IG-5',
      'TURBO_FORCE is not set. A cached isolation result is a result from a different commit, ' +
        'and CI_CD.md §3.4 makes this job uncacheable for that reason. An isolation gate that ' +
        'reports a hit is an isolation gate that did not run.',
    );
  }

  return { problems, covered, uncovered };
}

/**
 * `IG-1` and `IG-2` — the committed inventory must match what the contract yields.
 *
 * IG-1 catches a route that exists and is not in the inventory. IG-2 catches an inventory entry
 * for a route that no longer exists, so dead cases cannot accumulate and inflate apparent
 * coverage — a suite reporting "12 routes covered" when 4 of them were deleted last quarter is
 * worse than one reporting 8.
 */
export function diffInventory(live, committed) {
  const key = (r) => `${r.method} ${r.path}`;
  const liveKeys = new Set(live.routes.map(key));
  const committedKeys = new Set(committed.routes.map(key));

  return {
    added: [...liveKeys].filter((k) => !committedKeys.has(k)).sort(),
    removed: [...committedKeys].filter((k) => !liveKeys.has(k)).sort(),
    changed: live.routes
      .filter((r) => committedKeys.has(key(r)))
      .filter((r) => {
        const before = committed.routes.find((c) => key(c) === key(r));
        return JSON.stringify(before) !== JSON.stringify(r);
      })
      .map(key)
      .sort(),
  };
}

const HEADER = `/**
 * GENERATED by packages/config/scripts/isolation-coverage.mjs — DO NOT EDIT.
 *
 * Regenerate:  pnpm ci:isolation-coverage --write
 * Verify:      pnpm ci:isolation-coverage
 *
 * COMMITTED on purpose (IG-E). A regeneration that silently drops routes shows up as DELETED
 * LINES under CODEOWNERS review — which is the only way a shrinking isolation surface becomes
 * visible to a human. A gitignored inventory would let coverage fall without a diff.
 */
`;

export function renderInventory(inventory) {
  return `${HEADER}
import type { Inventory } from './_inventory.ts';

export const GENERATED_INVENTORY: Inventory = ${JSON.stringify(inventory, null, 2)} as const;
`;
}

function summary(inventory, covered, uncovered, exceptions) {
  return [
    '### Isolation coverage',
    '',
    `- tenant-scoped endpoints: **${inventory.routes.length}**`,
    `- covered: **${covered.length}**`,
    `- uncovered: **${uncovered.length}** (must be zero)`,
    `- declared exceptions: **${exceptions}** (this number should shrink)`,
    '',
    'Other audiences, each handled rather than skipped:',
    ...Object.entries(
      inventory.otherAudiences.reduce((acc, r) => {
        acc[r.audience] = (acc[r.audience] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([audience, count]) => `- \`${audience}\`: ${count}`),
  ].join('\n');
}

function main() {
  const root = repoRoot();
  const documentPath = resolve(root, 'openapi.json');
  const committedPath = resolve(root, 'apps/server/test/isolation/_inventory.generated.ts');

  if (!existsSync(documentPath)) {
    console.error(
      'isolation-coverage: openapi.json is missing. The inventory is DERIVED from the contract, ' +
        'so there is nothing to derive it from.\n  Run: pnpm --filter @gymmap/server openapi:emit',
    );
    process.exit(1);
  }

  const live = buildInventory(JSON.parse(readFileSync(documentPath, 'utf8')));

  if (process.argv[2] === '--write') {
    writeFileSync(committedPath, renderInventory(live), 'utf8');
    console.log(
      `isolation-coverage: wrote ${relative(root, committedPath)} — ${live.routes.length} ` +
        'tenant-scoped route(s).',
    );
    return;
  }

  if (!existsSync(committedPath)) {
    console.error(
      `isolation-coverage FAILED\n\n  ✗ ${relative(root, committedPath)} does not exist.\n` +
        '    Run: pnpm ci:isolation-coverage --write, and commit it.',
    );
    process.exit(1);
  }

  // The committed file is compared as TEXT rather than imported: importing it would require the
  // server to be built, and job 13 must be able to fail a missing case group even when the
  // build is broken.
  const expected = renderInventory(live).trim();
  const actual = readFileSync(committedPath, 'utf8').trim();

  const failures = [];

  if (expected !== actual) {
    const committedRoutes = [
      ...actual.matchAll(/"method": "(\w+)",\s*\n\s*"path": "([^"]+)"/g),
    ].map((m) => `${m[1]} ${m[2]}`);
    const diff = diffInventory(live, { routes: committedRoutes.map(toRoute) });

    for (const route of diff.added) {
      failures.push({
        gate: 'IG-1',
        message:
          `Handler ${route} is @TenantScoped but absent from the isolation inventory. Every ` +
          'tenant-scoped route needs a case group before it can merge — BAC-10 is the artefact ' +
          'handed to the penetration tester, and an uncovered route is a gap in it.\n' +
          '    Fix: pnpm ci:isolation-coverage --write, review the added lines, and commit.',
      });
    }
    for (const route of diff.removed) {
      failures.push({
        gate: 'IG-2',
        message:
          `${route} is in the inventory but no longer exists in the contract. A dead case ` +
          'inflates apparent coverage: the summary would report it as covered.\n' +
          '    Fix: pnpm ci:isolation-coverage --write, and confirm the route was deleted on purpose.',
      });
    }
    if (diff.added.length === 0 && diff.removed.length === 0) {
      failures.push({
        gate: 'IG-1',
        message:
          'The committed inventory differs from the contract in a route ATTRIBUTE — a kind, a ' +
          'permission or an expected refusal changed. That changes which assertions apply.\n' +
          '    Fix: pnpm ci:isolation-coverage --write, and read the diff.',
      });
    }
  }

  const { problems, covered, uncovered } = runGates({ inventory: live });
  failures.push(...problems);

  if (failures.length > 0) {
    console.error('isolation-coverage FAILED\n');
    for (const f of failures) console.error(`  ✗ [${f.gate}] ${f.message}\n`);
    process.exit(1);
  }

  console.log(summary(live, covered, uncovered, 0));
  console.log(
    `\nisolation-coverage: OK — ${covered.length}/${live.routes.length} tenant-scoped route(s) ` +
      'covered, 0 uncovered.',
  );
}

function toRoute(key) {
  const [method, ...rest] = key.split(' ');
  return { method, path: rest.join(' ') };
}

if (process.argv[1] && process.argv[1].endsWith('isolation-coverage.mjs')) main();
