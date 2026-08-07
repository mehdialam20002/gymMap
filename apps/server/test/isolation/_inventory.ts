/**
 * M-015 · The inventory GENERATOR — `BAC-10`, `IS3`, `IG-A` … `IG-F`, `AC-FND-04.2`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * GENERATION, NOT AUTHORSHIP — AND THAT IS SETTLED
 *
 * A hand-authored isolation suite measures the diligence of whoever last added a test. A
 * generated one measures the system. The difference shows up on the Friday afternoon somebody
 * adds a `@TenantScoped()` route and does not write a spec for it: the hand-authored suite stays
 * green and the generated one fails the build.
 *
 * `BAC-10` is a BUSINESS acceptance criterion, not an internal quality measure. It is the
 * artefact handed to the penetration tester, the evidence in an Enterprise sales conversation,
 * and — under the DPDP Act 2023 — the control standing between an ordinary coding mistake and a
 * reportable personal-data breach.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ SOURCE-OF-TRUTH PRECEDENCE ────────────────────────────────────────────────────────────────┐
 * │ 1. `openapi.json`, generated from the `@nestjs/swagger` document.                            │
 * │ 2. The Nest route table, used ONLY to cross-check.                                           │
 * │                                                                                              │
 * │ The document wins because it is what a client is generated from and what the contract gate   │
 * │ already polices. Parsing controllers with a regex would find a decorator in a comment, miss  │
 * │ one behind a composed decorator, and disagree with what Nest actually registered.            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * How a route must be probed. The kind decides WHICH assertions apply, so misclassifying one is
 * how a route gets a case group that proves nothing.
 */
export type RouteKind =
  /** Addresses one resource by id. A cross-tenant read is `404`, never `403` (`IG-D`). */
  | 'ITEM'
  /** Returns a set. The assertion is a COUNT, and the refusal is an empty set, not an error. */
  | 'COLLECTION'
  /** Mutates. A2's before/after checksum is the assertion; the status code is decoration. */
  | 'ACTION'
  /** `A5`'s leaky six. Named because they do not LOOK like a resource read. */
  | 'SEARCH'
  | 'REPORT'
  | 'EXPORT';

export interface InventoryRoute {
  readonly method: string;
  readonly path: string;
  readonly kind: RouteKind;
  readonly permission: string;
  /** `404` for an item, `200` with an empty set for a collection. §2.3, `IG-D`. */
  readonly expectedRefusal: 404 | 403 | 'EMPTY_SET';
  /** True when the path carries a parameter the probe must fill with a tenant-B id. */
  readonly needsTenantBId: boolean;
  /** Path parameter names, so `IG-3` can check the seed supplies each one. */
  readonly parameters: readonly string[];
}

export interface Inventory {
  readonly generatedFrom: string;
  readonly routes: readonly InventoryRoute[];
  /** Every non-tenant-scoped route, so `§5.5`'s other audiences are handled rather than skipped. */
  readonly otherAudiences: readonly { method: string; path: string; audience: string }[];
}

/** `§5.5` — the five audiences, each with its own treatment rather than a skip. */
export type Audience = 'PUBLIC' | 'ME' | 'TENANT' | 'ADMIN' | 'WEBHOOK' | 'PROBE';

export function audienceOf(path: string): Audience {
  if (path === '/healthz' || path === '/readyz') return 'PROBE';
  const afterVersion = path.replace(/^\/v\d+/, '');
  if (afterVersion.startsWith('/me')) return 'ME';
  if (afterVersion.startsWith('/tenant')) return 'TENANT';
  if (afterVersion.startsWith('/admin')) return 'ADMIN';
  if (afterVersion.startsWith('/webhooks')) return 'WEBHOOK';
  return 'PUBLIC';
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Classifies a route.
 *
 * The order matters. A mutation is an ACTION even when its path ends in a parameter, because A2
 * (the before/after checksum) is the assertion that matters for it — treating
 * `DELETE /v1/tenant/gyms/{id}` as an ITEM would apply A1's read assertion and never check
 * whether the row survived.
 */
export function classify(method: string, path: string): RouteKind {
  const afterVersion = path.replace(/^\/v\d+/, '');

  if (MUTATING.has(method)) return 'ACTION';
  // A5's leaky six, matched before the generic shapes: `/search` ends in no parameter, so it
  // would otherwise classify as a COLLECTION and never be probed as a search.
  if (/\/search(\/|$)|\/suggest$/.test(afterVersion)) return 'SEARCH';
  if (/\/reports?(\/|$)/.test(afterVersion)) return 'REPORT';
  if (/\/exports?(\/|$)/.test(afterVersion)) return 'EXPORT';
  if (/\{[^}]+\}$/.test(path)) return 'ITEM';
  // A trailing segment after a parameter is a sub-resource of one item — `.../{id}/ping` reads
  // one thing, not a set.
  if (/\{[^}]+\}\/[^/]+$/.test(path)) return 'ITEM';
  return 'COLLECTION';
}

/**
 * `IG-D` / `API_Catalog.md` §2.3 — what a cross-tenant probe must receive.
 *
 * A cross-tenant ITEM read is `404` and NEVER `403`. A 403 is an existence oracle: it confirms
 * the resource is real and merely forbidden, which is precisely the fact a cross-tenant caller
 * must not learn. Collections return an empty set rather than an error, because an error would
 * tell the caller that a filter matched something.
 */
export function expectedRefusalFor(kind: RouteKind): 404 | 403 | 'EMPTY_SET' {
  switch (kind) {
    case 'ITEM':
    case 'ACTION':
      return 404;
    case 'COLLECTION':
    case 'SEARCH':
    case 'REPORT':
    case 'EXPORT':
      return 'EMPTY_SET';
  }
}

function parametersOf(path: string): string[] {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!);
}

interface OpenApiOperation {
  readonly 'x-gymmap-tenant-scoped'?: boolean;
  readonly 'x-gymmap-permission'?: string;
  readonly 'x-gymmap-public'?: boolean;
}

/** Walks up to the directory holding `pnpm-workspace.yaml`, like the api-gates script. */
export function repoRoot(from: string = process.cwd()): string {
  let dir = resolve(from);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(from);
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

/**
 * Builds the inventory from a parsed OpenAPI document.
 *
 * Pure, so `isolation-coverage.spec.mjs` can feed it fixtures. The suite's baseline today is two
 * routes; a generator that silently produced zero would look identical from the outside, which
 * is why the coverage gate asserts a non-empty result against the live document.
 */
export function buildInventory(document: {
  paths?: Record<string, Record<string, OpenApiOperation>>;
}): Inventory {
  const routes: InventoryRoute[] = [];
  const otherAudiences: { method: string; path: string; audience: string }[] = [];

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
      const parameters = parametersOf(path);
      routes.push({
        method,
        path,
        kind,
        // `IG-6` is satisfied upstream: a @TenantScoped() handler with no @RequiredPermission()
        // fails api-gates PG-1 before this ever runs. Recorded rather than defaulted, so an
        // empty string here is visible in the committed inventory rather than absorbed.
        permission: operation['x-gymmap-permission'] ?? '',
        expectedRefusal: expectedRefusalFor(kind),
        needsTenantBId: parameters.length > 0,
        parameters,
      });
    }
  }

  // Sorted so the committed file is stable. An unsorted inventory produces a diff whenever the
  // document's key order changes, and a gate that cries wolf gets muted.
  routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  otherAudiences.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  return { generatedFrom: 'openapi.json', routes, otherAudiences };
}

export function loadLiveInventory(root: string = repoRoot()): Inventory {
  const documentPath = resolve(root, 'openapi.json');
  if (!existsSync(documentPath)) {
    throw new Error(
      `openapi.json is missing at ${documentPath}. The isolation inventory is DERIVED from the ` +
        'contract, so there is nothing to derive it from. Run: pnpm --filter @gymmap/server openapi:emit',
    );
  }
  return buildInventory(JSON.parse(readFileSync(documentPath, 'utf8')));
}
