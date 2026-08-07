/**
 * M-008 · CI job 8 `api-gates` — ONE reflection pass, four assertions.
 *
 *   PG-1  Every route declares a permission, or is `@Public()` AND on the reviewed allowlist.
 *   PG-2  Idempotency is declared wherever §14.2.1 says REQ.
 *   PG-3  Permission strings are `<module>.<resource>.<action>`, first segment a real module.
 *   PG-5  Every route carries a rate-limit class, and every emitted error code is registered.
 *
 * Plus AC-5: the five closed audience prefixes, and the two unversioned probes.
 *
 * ┌─ WHY THIS READS THE GENERATED DOCUMENT RATHER THAN THE SOURCE ─────────────────────────────┐
 * │ Parsing controllers with a regex would find `@RequiredPermission` in a comment, miss it     │
 * │ behind a custom composed decorator, and disagree with what Nest actually registered. The    │
 * │ generated `openapi.json` is what the application really exposes — and it is the artefact a  │
 * │ client is generated from, so a gate that passes here is a gate that passes on the thing     │
 * │ people actually consume.                                                                    │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * With zero routes this passes and SAYS SO, rather than passing silently. "0 routes checked"
 * and "everything checked and fine" must never look the same in a log.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

/** §C1.3 — the first segment of a permission must be one of these. */
export const MODULES = [
  'admin',
  'attendance',
  'audit',
  'billing',
  'catalog',
  'common',
  'crm',
  'discovery',
  'iam',
  'ledger',
  'memberships',
  'notifications',
  'onboarding',
  'ordering',
  'payments',
  'plans',
  'refunds',
  'reporting',
  'reviews',
  'settlements',
  'staff',
  'support',
  'tenancy',
];

/** API_Catalog.md §1.2 R7 — the five closed audience prefixes. */
export const AUDIENCE_PREFIXES = ['/me', '/tenant', '/admin', '/webhooks'];

/** Each of these names a CLIENT rather than an AUDIENCE, which stops being true immediately. */
export const FORBIDDEN_PREFIXES = ['/owner', '/dashboard', '/staff', '/api', '/internal'];

export const UNVERSIONED = ['/healthz', '/readyz'];

/** §14.2.1 — path fragments whose mutations MUST declare idempotency. */
export const IDEMPOTENCY_REQUIRED_PATTERNS = [
  /\/orders(\/|$)/,
  /\/payment-intent$/,
  /\/payments\/[^/]+\/retry$/,
  /\/refunds?(\/|$)/,
  /\/memberships\/[^/]+\/(freeze|unfreeze|renew|transfer|auto-renew)$/,
  /\/checkin\//,
  /\/webhooks\//,
  /\/(exports|import)$/,
  /\/coupon$/,
  /\/settlements\/[^/]+\/approve$/,
  /\/disputes\/[^/]+\/evidence$/,
];

const PERMISSION = /^([a-z]+)\.([a-z0-9_]+)\.([a-z0-9_]+)$/;

export function runApiGates({ document, publicAllowlist, errorCodes, rateLimitClasses }) {
  const problems = [];
  const fail = (gate, route, message) => problems.push({ gate, route, message });

  const operations = [];
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = item?.[method];
      if (operation) operations.push({ path, method: method.toUpperCase(), operation });
    }
  }

  for (const { path, method, operation } of operations) {
    const route = `${method} ${path}`;
    // Read the flat x-gymmap-* extension keys the decorators emit. A nested x-gymmap object
    // would be tidier, but ApiExtension writes one key per call and collapsing them in the
    // factory would mean the gate and the published contract disagree about the shape.
    const ext = {
      permission: operation['x-gymmap-permission'],
      public: operation['x-gymmap-public'] === true,
      idempotent: operation['x-gymmap-idempotent'],
      rateLimit: operation['x-gymmap-rate-limit'],
      tenantScoped: operation['x-gymmap-tenant-scoped'] === true,
      errorCodes: operation['x-gymmap-error-codes'] ?? [],
    };

    // --- AC-5: versioning and the closed prefix set --------------------------
    const unversioned = UNVERSIONED.includes(path);
    if (!unversioned && !path.startsWith('/v1/') && path !== '/v1') {
      fail(
        'AC-5',
        route,
        `is neither one of the unversioned probes (${UNVERSIONED.join(', ')}) nor under /v1. ` +
          `§C3.1 fixes URL versioning; an unversioned business route cannot be deprecated ` +
          `without breaking every client at once.`,
      );
    }
    if (unversioned && !UNVERSIONED.includes(path)) {
      fail('AC-5', route, 'is unversioned but is not a probe');
    }

    if (!unversioned) {
      const afterVersion = path.slice('/v1'.length);
      for (const forbidden of FORBIDDEN_PREFIXES) {
        if (afterVersion.startsWith(`${forbidden}/`) || afterVersion === forbidden) {
          fail(
            'AC-5',
            route,
            `uses the forbidden prefix "${forbidden}". It names a CLIENT, not an AUDIENCE — and ` +
              `a route named for its caller stops telling you who is authorised the moment a ` +
              `second client calls it. The five permitted prefixes are: none (public), ` +
              `${AUDIENCE_PREFIXES.join(', ')}.`,
          );
        }
      }
    }

    // --- PG-1: a permission, or a reviewed public exemption ------------------
    const isPublic = ext.public === true;
    const permission = ext.permission;

    if (!isPublic && !permission) {
      fail(
        'PG-1',
        route,
        `declares no permission and is not @Public(). FR-RBAC-01: every route is authorised ` +
          `server-side. There is no third option — an undeclared route is reachable by whoever ` +
          `holds any valid token.`,
      );
    }
    if (isPublic && permission) {
      fail(
        'PG-1',
        route,
        `is both @Public() and permission-guarded. One of the two is a mistake, and which one ` +
          `cannot be inferred — the guard would let it through while the contract claims it is ` +
          `protected.`,
      );
    }
    if (isPublic && !publicAllowlist.has(route)) {
      fail(
        'PG-1',
        route,
        `is @Public() but has no row in public-allowlist.ts. Opening a route to the ` +
          `unauthenticated internet must not be possible by adding five characters to a ` +
          `controller — the allowlist is the file a reviewer actually reads.`,
      );
    }

    // --- PG-3: permission grammar -------------------------------------------
    if (permission) {
      const match = PERMISSION.exec(permission);
      if (!match) {
        fail(
          'PG-3',
          route,
          `permission "${permission}" is not <module>.<resource>.<action> — three lowercase ` +
            `dot-separated segments. §12.2.1 AZ1. Free-text permissions drift within a week: ` +
            `gym.update, gyms.update and catalog.gym.edit all appear, and the ones that match ` +
            `nothing in the matrix guard nothing.`,
        );
      } else if (!MODULES.includes(match[1])) {
        fail(
          'PG-3',
          route,
          `permission "${permission}" starts with "${match[1]}", which is not one of the 23 ` +
            `modules of §C1.3. The first segment is checkable precisely so a typo cannot ` +
            `silently create a permission nobody grants.`,
        );
      }
    }

    // --- PG-2: idempotency where §14.2.1 says REQ ---------------------------
    const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const requiresIdempotency = mutating && IDEMPOTENCY_REQUIRED_PATTERNS.some((p) => p.test(path));

    if (requiresIdempotency && ext.idempotent !== 'required') {
      fail(
        'PG-2',
        route,
        `affects money, membership state or attendance but does not require an Idempotency-Key. ` +
          `§14.2.1. A checkout POST retried by a flaky mobile connection charges twice; the user ` +
          `sees one confirmation and two debits, and it surfaces days later as a refund request ` +
          `rather than a bug report.`,
      );
    }

    // --- PG-5: rate-limit class and registered error codes -------------------
    if (!ext.rateLimit) {
      fail(
        'PG-5',
        route,
        `declares no rate-limit class. NFR-SEC-06. An unclassed route is an unmetered route, ` +
          `and the first one anybody finds is the one that gets hammered.`,
      );
    } else if (!rateLimitClasses.has(ext.rateLimit)) {
      fail(
        'PG-5',
        route,
        `rate-limit class "${ext.rateLimit}" is not in the closed set ` +
          `(${[...rateLimitClasses].join(', ')}).`,
      );
    }

    for (const code of ext.errorCodes ?? []) {
      if (!errorCodes.has(code)) {
        fail(
          'PG-5',
          route,
          `emits "${code}", which has no row in the §13.2 registry. A client cannot branch on a ` +
            `code that is not in the contract, so it will fall through to a generic error and ` +
            `the user gets "something went wrong" for a condition we understood exactly.`,
        );
      }
    }
  }

  return { problems, operationCount: operations.length };
}

/**
 * The real allow-list and registries, read from source.
 *
 * EXPORTED, and that matters more than it looks. The spec used to check the live `openapi.json`
 * against its own three-code FIXTURE set, so the moment M-012 shipped an endpoint emitting
 * `UNAUTHENTICATED` — a code that is in the registry — the spec failed while the actual gate
 * passed. A fixture set is the right thing for "does PG-5 bite"; it is the wrong thing for "is
 * the committed contract valid", and the two tests must not share one.
 *
 * Read from source rather than from `dist/` so the gate and the application agree by
 * construction rather than by two lists staying in step.
 */
export function loadRealConfig(root) {
  const source = (relPath) => readFileSync(resolve(root, relPath), 'utf8');

  const allowlistSource = source('apps/server/src/common/openapi/public-allowlist.ts');
  const registrySource = source('packages/types/src/errors/registry.ts');
  const rateLimitSource = source('apps/server/src/common/decorators/rate-limit.decorator.ts');

  return {
    publicAllowlist: new Set([...allowlistSource.matchAll(/route:\s*'([^']+)'/g)].map((m) => m[1])),
    errorCodes: new Set(
      [...registrySource.matchAll(/^\s{2}([A-Z][A-Z0-9_]*):\s*\{$/gm)].map((m) => m[1]),
    ),
    rateLimitClasses: new Set([...rateLimitSource.matchAll(/'(RL-[A-Z]+)'/g)].map((m) => m[1])),
  };
}

// --- CLI ---------------------------------------------------------------------

/**
 * Walks up to the directory holding `pnpm-workspace.yaml`.
 *
 * `process.cwd()` was wrong here and had been since M-008: `apps/server`'s `openapi:check` runs
 * this script with the cwd set to `apps/server`, so it looked for `openapi.json` there, did not
 * find it, and exited 1 — every time, for four milestones. The root `pnpm ci:api-gates` worked,
 * which is why nobody noticed: the two entry points disagreed about where the repository is.
 */
function repoRoot(from = process.cwd()) {
  let dir = resolve(from);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(from);
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'));
if (isMain) {
  const root = repoRoot();
  const documentPath = resolve(root, 'openapi.json');

  if (!existsSync(documentPath)) {
    console.error(
      'api-gates: openapi.json is missing. Run: pnpm --filter @gymmap/server openapi:emit',
    );
    process.exit(1);
  }

  const document = JSON.parse(readFileSync(documentPath, 'utf8'));
  const { publicAllowlist, errorCodes, rateLimitClasses } = loadRealConfig(root);

  const { problems, operationCount } = runApiGates({
    document,
    publicAllowlist,
    errorCodes,
    rateLimitClasses,
  });

  if (problems.length === 0) {
    // Explicit, not silent. "0 routes checked" and "all routes fine" must never look the same.
    console.log(
      operationCount === 0
        ? 'api-gates: 0 operations in openapi.json — nothing to check yet, and that is reported ' +
            'rather than passed over. PG-1/2/3/5 are wired and will bite on the first endpoint.'
        : `api-gates: OK — ${operationCount} operation(s) pass PG-1, PG-2, PG-3, PG-5 and AC-5.`,
    );
    console.log(
      `  registry: ${errorCodes.size} error codes · ${rateLimitClasses.size} rate-limit classes · ` +
        `${publicAllowlist.size} allowlisted public route(s)`,
    );
    process.exit(0);
  }

  console.error(`api-gates: ${problems.length} problem(s) across ${operationCount} operation(s)\n`);
  for (const p of problems) {
    console.error(`  [${p.gate}] ${p.route}`);
    console.error(`      ${p.message}\n`);
  }
  process.exit(1);
}
