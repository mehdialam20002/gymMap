/**
 * M-008 · CI job 8 `api-gates` — ONE reflection pass, six assertions.
 *
 *   PG-1  Every route declares a permission, or is `@Public()` AND on the reviewed allowlist.
 *   PG-2  Idempotency is declared wherever §14.2.1 says REQ.
 *   PG-3  Permission strings are `<module>.<resource>.<action>`, first segment a real module.
 *   PG-5  Every route carries a rate-limit class, and every emitted error code is registered.
 *   PG-6  Every §14.2.1 money-affecting route carries `@FinancialMutation()`, and only those do.
 *   PG-7  The permission string is IN the registry, not merely well-formed (Security.md RB3).
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

/**
 * Where `RB3`'s permission registry lives — every module that declares permission strings.
 *
 * Listed rather than globbed, so ADDING a module's `permissions.ts` is a visible edit to this
 * file. A glob would silently widen the registry the moment somebody created a new one, which is
 * the opposite of what a registry check is for.
 */
export const PERMISSION_REGISTRY_FILES = [
  'apps/server/src/iam/permissions.ts',
  'apps/server/src/admin/permissions.ts',
  'apps/server/src/onboarding/permissions.ts',
  'apps/server/src/tenancy/permissions.ts',
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

/**
 * `§14.2.1`'s MONEY-AFFECTING row, and only that row — `M-025` `AC-4`, `BR-DAT-02`, `E1.8`.
 *
 * ┌─ A STRICT SUBSET OF `IDEMPOTENCY_REQUIRED_PATTERNS`, AND SEPARATE ON PURPOSE ────────────────┐
 * │ That list is the whole table: money, membership state, attendance, webhooks, bulk, coupons.   │
 * │ Reusing it here would forbid impersonating a user to record a check-in or freeze a membership │
 * │ — which is most of what support DOES, and refusing it would make the feature useless while    │
 * │ looking rigorous.                                                                             │
 * │                                                                                              │
 * │ What impersonation must never do is move money. Ten endpoints, transcribed from the           │
 * │ constitution's first row rather than inferred from the word "financial".                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const MONEY_AFFECTING_PATTERNS = [
  /\/orders$/,
  /\/orders\/[^/]+\/payment-intent$/,
  /\/payments\/[^/]+\/retry$/,
  /\/tenant\/orders\/offline$/,
  /\/tenant\/orders\/[^/]+\/collect-balance$/,
  /\/memberships\/[^/]+\/refund-request$/,
  /\/tenant\/refunds$/,
  /\/admin\/refunds\/[^/]+\/decide$/,
  /\/admin\/settlements\/[^/]+\/approve$/,
  /\/admin\/disputes\/[^/]+\/evidence$/,
];

const PERMISSION = /^([a-z]+)\.([a-z0-9_]+)\.([a-z0-9_]+)$/;

export function runApiGates({
  document,
  publicAllowlist,
  errorCodes,
  rateLimitClasses,
  permissionRegistry = null,
}) {
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
      financialMutation: operation['x-gymmap-financial-mutation'] === true,
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

    /*
     * --- PG-7: the string is in the REGISTRY, not merely well-formed (Security.md RB3) ------
     *
     * ┌─ PG-3 CHECKS THE SHAPE OF THE KEY. NOTHING CHECKED THAT IT EXISTED. ──────────────────┐
     * │ `RB3`: *"Every permission string referenced by a `@RequiredPermission()` must exist in │
     * │ some module's `permissions.ts`; an unknown string fails CI."* Specified, and until now │
     * │ absent — `PG-3` validates three lowercase dot-separated segments and that the first is │
     * │ one of the 23 modules, which `catalog.branch.create` satisfies perfectly while being   │
     * │ granted to nobody.                                                                      │
     * │                                                                                        │
     * │ The consequence of the gap is not subtle. `permits()` does not find the key in          │
     * │ `PERMISSION_KEYS`, so the guard refuses EVERY caller with `UNKNOWN_PERMISSION` — and    │
     * │ the route fails at request time, where it reads as a permissions bug rather than as a  │
     * │ key nobody ever defined. This repository has now hit that shape four times: `BLK-10`,  │
     * │ `BLK-11`, `BLK-14` and `BLK-19`, each found by a person reading two documents against  │
     * │ each other rather than by a build.                                                      │
     * └────────────────────────────────────────────────────────────────────────────────────────┘
     *
     * ┌─ WHAT THIS DOES *NOT* CATCH, SAID PLAINLY ─────────────────────────────────────────────┐
     * │ A key that IS in a module's `permissions.ts` but that `§B3.2` never authorised. That is │
     * │ `BLK-10`'s exact shape — `admin.platform_overview.read` is a literal in                 │
     * │ `admin/permissions.ts` and passes this check — and catching it is `RB2`'s job           │
     * │ (`rbac-matrix-drift`, which parses the matrix out of `MASTER_PRD.md`). `RB2` is also    │
     * │ unbuilt. This gate is the cheaper half, and claiming it is both would be worse than     │
     * │ not having it.                                                                           │
     * └────────────────────────────────────────────────────────────────────────────────────────┘
     */
    if (permission && permissionRegistry !== null && !permissionRegistry.has(permission)) {
      fail(
        'PG-7',
        route,
        `declares "${permission}", which appears in no module's permissions.ts. Security.md ` +
          `RB3: an unknown string fails CI. It is well-formed, so PG-3 passes it — and then ` +
          `PermissionsGuard refuses every caller with UNKNOWN_PERMISSION at request time, where ` +
          `it reads as a permissions bug rather than as a key nobody defined. If §B3.2 really ` +
          `does authorise this capability, add the key to the owning module's permissions.ts; ` +
          `if it does not, the answer is a §C10 change-control decision and not a new string.`,
      );
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

    // --- PG-6: every money route is marked as a financial mutation ----------
    //
    // ┌─ THE GATE THAT MAKES THE RUNTIME GUARD HONEST ────────────────────────────────────────┐
    // │ `ImpersonationRestrictionGuard` can only refuse a handler it can SEE is financial, and  │
    // │ an undecorated one looks ordinary. The person adding the eleventh refund endpoint is    │
    // │ not thinking about impersonation, so the marker will be missed — and missing it is      │
    // │ silent: the route works, the tests pass, and a borrowed identity can move money.        │
    // │                                                                                        │
    // │ Cross-referencing the contract against `§14.2.1` moves that failure to the build.       │
    // └────────────────────────────────────────────────────────────────────────────────────────┘
    const movesMoney = mutating && MONEY_AFFECTING_PATTERNS.some((p) => p.test(path));

    if (movesMoney && !ext.financialMutation) {
      fail(
        'PG-6',
        route,
        `is in §14.2.1's money-affecting class but carries no @FinancialMutation(). ` +
          `Without it, ImpersonationRestrictionGuard cannot tell this route from an ordinary one, ` +
          `and a support agent acting under a borrowed identity can move money that will be ` +
          `attributed to the user they are impersonating (BR-DAT-02, E1.8).`,
      );
    }

    // The inverse is a mistake too, and a quieter one: a route marked financial that §14.2.1 does
    // not list is either a money route the constitution has not enumerated — a §24 amendment, not
    // a decorator — or a marker pasted onto the wrong handler, which silently blocks support from
    // doing something they are entitled to do.
    if (ext.financialMutation && !movesMoney) {
      fail(
        'PG-6',
        route,
        `carries @FinancialMutation() but is not in §14.2.1's money-affecting list. Either the ` +
          `constitution needs the route added under §24, or the decorator is on the wrong handler ` +
          `and is blocking support work for no reason.`,
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

  /*
   * The permission registry — `RB3`'s *"some module's `permissions.ts`"*, read as text.
   *
   * Every string literal matching the permission grammar, from every module that has one. A
   * module may declare its keys as literals (`admin/`) or read them out of `CAPABILITY_MATRIX`
   * by label (`onboarding/`); `iam/permissions.ts` holds the matrix itself, so its 64
   * `readKey`/`writeKey` literals are the bulk of the registry either way.
   *
   * Text, not an import, for the reason `loadRealConfig`'s own header gives: reading from source
   * makes the gate and the application agree by construction. Importing the compiled module would
   * also mean a gate that cannot run until the server builds, and the gates exist to run first.
   */
  const permissionSources = PERMISSION_REGISTRY_FILES.filter((relPath) =>
    existsSync(resolve(root, relPath)),
  ).map(source);

  return {
    publicAllowlist: new Set([...allowlistSource.matchAll(/route:\s*'([^']+)'/g)].map((m) => m[1])),
    errorCodes: new Set(
      [...registrySource.matchAll(/^\s{2}([A-Z][A-Z0-9_]*):\s*\{$/gm)].map((m) => m[1]),
    ),
    rateLimitClasses: new Set([...rateLimitSource.matchAll(/'(RL-[A-Z]+)'/g)].map((m) => m[1])),
    permissionRegistry: new Set(
      permissionSources.flatMap((text) =>
        [...text.matchAll(/'([a-z]+\.[a-z0-9_]+\.[a-z0-9_]+)'/g)].map((m) => m[1]),
      ),
    ),
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
  const { publicAllowlist, errorCodes, rateLimitClasses, permissionRegistry } =
    loadRealConfig(root);

  /*
   * Spread, rather than four named fields.
   *
   * The first version of this call listed the three fields it knew about, so adding
   * `permissionRegistry` to `loadRealConfig` left the CLI silently passing `undefined` — PG-7
   * defaulted to "not checked", the gate printed OK, and it took reading this line to notice. The
   * spec's `runApiGates({ document, ...real })` had it right all along; the CLI is the one that
   * could drift, and now cannot.
   */
  const { problems, operationCount } = runApiGates({
    document,
    publicAllowlist,
    errorCodes,
    rateLimitClasses,
    permissionRegistry,
  });

  if (problems.length === 0) {
    // Explicit, not silent. "0 routes checked" and "all routes fine" must never look the same.
    console.log(
      operationCount === 0
        ? 'api-gates: 0 operations in openapi.json — nothing to check yet, and that is reported ' +
            'rather than passed over. PG-1/2/3/5/6/7 are wired and will bite on the first endpoint.'
        : `api-gates: OK — ${operationCount} operation(s) pass PG-1, PG-2, PG-3, PG-5, PG-6, ` +
            `PG-7 and AC-5.`,
    );
    console.log(
      `  registry: ${errorCodes.size} error codes · ${rateLimitClasses.size} rate-limit classes · ` +
        `${publicAllowlist.size} allowlisted public route(s) · ` +
        // Printed because PG-7 silently not-running is the failure mode it is easiest to ship:
        // an empty or undefined registry reads identically to a clean pass in every other line.
        `${permissionRegistry.size} permission key(s)`,
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
