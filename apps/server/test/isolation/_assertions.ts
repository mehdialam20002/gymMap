/**
 * M-015 · A1 … A6 as reusable functions — `BAC-10`, `E2E-11`, `IS5`, `NFR-SEC-09`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A4 IS WRITTEN FIRST AND RUNS FIRST, AND THAT IS NOT A STYLE CHOICE
 *
 * Suppose `app.tenant_id` were globally broken — misspelled in the policy, say, so the predicate
 * never matches for anyone. Then:
 *
 *   A1  tenant B cannot read tenant A     ✓ passes (B reads nothing at all)
 *   A2  tenant B cannot write tenant A    ✓ passes (B writes nothing at all)
 *   A3  B's collection excludes A's rows  ✓ passes (B's collection is empty)
 *
 * All green, and the system returns nothing to everybody. `TestingStrategy.md` §5.4 calls this
 * the CATASTROPHIC FALSE PASS, and `E0.5` exists because of it. A4 is the assertion that
 * distinguishes "isolation works" from "nothing works", and it is the one people skip.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

import type { InventoryRoute } from './_inventory.ts';

/** What a probe returns, independent of the HTTP client used to make it. */
export interface ProbeResponse {
  readonly status: number;
  readonly body: unknown;
  /** The raw bytes, so A1 can assert BYTE identity rather than deep equality. */
  readonly raw: string;
}

export interface ProbeContext {
  /** Issues a request as the given tenant. */
  readonly request: (method: string, path: string, asTenant: 'A' | 'B') => Promise<ProbeResponse>;
  readonly tenantA: string;
  readonly tenantB: string;
}

function psql(sql: string): string {
  try {
    return execFileSync(
      'docker',
      [
        'exec',
        '-i',
        'gymmap-postgres',
        'psql',
        '-U',
        'postgres',
        '-d',
        'gymmap',
        '-tA',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return `${e.stdout ?? ''}\n${e.stderr ?? ''}`.trim();
  }
}

/**
 * A2's real assertion — a hash of EVERY column of a row, taken outside the caller's scope.
 *
 * ┌─ THE STATUS CODE IS DECORATION; THIS IS THE ASSERTION ──────────────────────────────────────┐
 * │ A `404` with a completed write is the exact shape produced by a session-only tenant check    │
 * │ that filters the RESPONSE but not the MUTATION. The caller is told "no such resource" and    │
 * │ the resource has been changed. It is the worst possible outcome — worse than a 200, because  │
 * │ nothing in the logs suggests anything happened.                                              │
 * │                                                                                              │
 * │ So A2 hashes the row before and after and asserts identity. `to_jsonb(t.*)` covers EVERY     │
 * │ column, including ones added later: a checksum over a hand-listed column set stops covering  │
 * │ the column somebody adds next sprint, and does so silently.                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Read as `postgres` rather than through `runElevated`, deliberately: the point is to observe the
 * row with NO policy in the way. A checksum taken through any policy-bound connection could
 * itself be filtered, and would then be identical before and after for the wrong reason.
 */
export function platformChecksum(table: string, id: string): string {
  const json = psql(`SELECT to_jsonb(t.*)::text FROM ${table} t WHERE t.id = '${id}';`);
  if (!json || json.startsWith('ERROR')) {
    throw new Error(
      `platformChecksum could not read ${table}.${id}. A checksum that cannot be taken is not a ` +
        `passing assertion — it is an absent one. psql said: ${json || '(empty)'}`,
    );
  }
  return createHash('sha256').update(json).digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════════
// A4 · POSITIVE CONTROL. First, always.
// ═══════════════════════════════════════════════════════════════════════════

export async function assertA4PositiveControl(
  context: ProbeContext,
  route: InventoryRoute,
  expectedCount?: number,
): Promise<void> {
  const path = fillPath(route.path, context.tenantA);
  const response = await context.request(route.method, path, 'A');

  assert.equal(
    response.status,
    200,
    `A4 FAILED for ${route.method} ${route.path}: tenant A cannot read its OWN data ` +
      `(${response.status}). Every "cannot read another tenant" assertion in this suite would ` +
      `now pass trivially, because nothing is readable by anybody. This is the catastrophic ` +
      `false pass of TestingStrategy.md §5.4 — the suite is a very expensive expect(true).`,
  );

  const body = response.body as Record<string, unknown> | unknown[];
  const isEmpty =
    body === null ||
    body === undefined ||
    (Array.isArray(body) && body.length === 0) ||
    (typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0);

  assert.ok(
    !isEmpty,
    `A4 FAILED for ${route.method} ${route.path}: the response is 200 with an EMPTY body. A ` +
      `200 that carries nothing proves the route is reachable, not that the tenant context ` +
      `resolved — which is the thing A4 exists to prove.`,
  );

  if (expectedCount !== undefined && Array.isArray(body)) {
    assert.equal(body.length, expectedCount, `A4: expected ${expectedCount} rows for tenant A`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// A1 · a cross-tenant READ is refused, and discloses no existence.
// ═══════════════════════════════════════════════════════════════════════════

export async function assertA1ReadRefused(
  context: ProbeContext,
  route: InventoryRoute,
  /** Fields of tenant B's row that must not appear anywhere in the response. */
  forbiddenFragments: readonly string[],
): Promise<void> {
  const crossTenant = await context.request(
    route.method,
    fillPath(route.path, context.tenantB),
    'A',
  );

  assert.equal(
    crossTenant.status,
    404,
    `A1 FAILED for ${route.method} ${route.path}: expected 404, got ${crossTenant.status}. ` +
      `A 403 is an EXISTENCE ORACLE — it confirms the resource is real and merely forbidden, ` +
      `which turns a uuid list into a customer census (RSK-08, API_Catalog.md §2.3).`,
  );

  for (const fragment of forbiddenFragments) {
    assert.ok(
      !crossTenant.raw.includes(fragment),
      `A1 FAILED for ${route.method} ${route.path}: the refusal body contains "${fragment}", ` +
        `which is derived from tenant B's row. A 404 that leaks a field is not a refusal.`,
    );
  }

  // BYTE IDENTITY between "yours but forbidden" and "does not exist". A body that differs by a
  // single character is still an oracle, just a quieter one — and quieter is worse, because it
  // survives review.
  const nonexistent = await context.request(
    route.method,
    fillPath(route.path, '01912f00-0000-7000-8000-0000000000ff'),
    'A',
  );

  assert.equal(
    crossTenant.status,
    nonexistent.status,
    `A1 FAILED for ${route.method} ${route.path}: a cross-tenant id and a nonexistent id return ` +
      `different statuses (${crossTenant.status} vs ${nonexistent.status}).`,
  );
  assert.equal(
    redactVariable(crossTenant.raw),
    redactVariable(nonexistent.raw),
    `A1 FAILED for ${route.method} ${route.path}: the two refusal bodies differ. The caller can ` +
      `distinguish "exists but not yours" from "does not exist", which is the fact the 404 ` +
      `exists to hide.`,
  );
}

/**
 * Blanks the fields that legitimately differ between two responses.
 *
 * A correlation id and a timestamp are different on every request by design, so comparing raw
 * bytes without this would fail on two identical refusals. Blanking them is the narrowest thing
 * that makes the comparison meaningful — and each pattern is listed so nobody widens it to
 * "ignore anything that differs", which would make the assertion vacuous.
 */
function redactVariable(raw: string): string {
  return raw
    .replace(/"correlation_?[Ii]d"\s*:\s*"[^"]*"/g, '"correlationId":"<redacted>"')
    .replace(/"request_?[Ii]d"\s*:\s*"[^"]*"/g, '"requestId":"<redacted>"')
    .replace(/"timestamp"\s*:\s*"[^"]*"/g, '"timestamp":"<redacted>"')
    .replace(/"instance"\s*:\s*"[^"]*"/g, '"instance":"<redacted>"');
}

// ═══════════════════════════════════════════════════════════════════════════
// A2 · a cross-tenant WRITE leaves the row byte-identical.
// ═══════════════════════════════════════════════════════════════════════════

export async function assertA2WriteRefused(
  context: ProbeContext,
  route: InventoryRoute,
  table: string,
): Promise<void> {
  const before = platformChecksum(table, context.tenantB);

  const response = await context.request(route.method, fillPath(route.path, context.tenantB), 'A');

  const after = platformChecksum(table, context.tenantB);

  // The checksum FIRST. If the row changed, the status code is irrelevant and reporting it first
  // would send the reader looking at the wrong thing.
  assert.equal(
    after,
    before,
    `A2 FAILED for ${route.method} ${route.path}: tenant B's row in ${table} CHANGED. The ` +
      `caller received ${response.status}, so the API reported a refusal while the mutation ` +
      `completed — the exact shape of a session-only tenant check that filters the response and ` +
      `not the write. This is the worst possible outcome: nothing in the logs suggests anything ` +
      `happened.`,
  );

  assert.equal(
    response.status,
    404,
    `A2 for ${route.method} ${route.path}: the row is intact but the status is ` +
      `${response.status}, not 404. The row surviving is the safety property; the 404 is the ` +
      `non-disclosure property, and both are required.`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// A3 · a COLLECTION is filtered, asserted by COUNT.
// ═══════════════════════════════════════════════════════════════════════════

export async function assertA3CollectionFiltered(
  context: ProbeContext,
  route: InventoryRoute,
  expectedCount: number,
  /** How to read the tenant id off each row, so a wrapped envelope still works. */
  tenantIdOf: (row: unknown) => string | undefined,
): Promise<void> {
  const response = await context.request(route.method, route.path, 'A');
  assert.equal(response.status, 200, `A3: tenant A cannot read the collection`);

  const rows = toRows(response.body);

  // By COUNT, because a filter that returned the right ids but a wrong count means the same row
  // twice, and a correct-looking page whose TOTAL is wrong is what a broken LIMIT interaction
  // produces — the caller then learns how many rows exist in other tenants.
  assert.equal(
    rows.length,
    expectedCount,
    `A3 FAILED for ${route.method} ${route.path}: tenant A sees ${rows.length} rows, expected ` +
      `${expectedCount}. A guard that leaks the COUNT, the facets or the pagination total leaks ` +
      `the size of every other tenant's data even when it shows none of it.`,
  );

  for (const row of rows) {
    const owner = tenantIdOf(row);
    if (owner === undefined) continue;
    assert.equal(
      owner,
      context.tenantA,
      `A3 FAILED for ${route.method} ${route.path}: a row belonging to ${owner} appeared in ` +
        `tenant A's collection.`,
    );
  }
}

function toRows(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    const envelope = body as Record<string, unknown>;
    if (Array.isArray(envelope['data'])) return envelope['data'];
    if (Array.isArray(envelope['items'])) return envelope['items'];
    // A single-object response is a collection of one — `GET /v1/tenant/ping` returns the
    // caller's own tenant, which under P-SELF is the whole visible set.
    return [body];
  }
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════
// A6 · the session variable was set INSIDE the transaction.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `TR-01` / `TD-010` — invisible to any black-box request test.
 *
 * The failure this catches: `set_config` executed on a DIFFERENT connection from the query. Under
 * a transaction-mode pooler that is not hypothetical, and the symptom is not an error — it is the
 * policy raising 42704 for an unset variable, or worse, silently reading the previous caller's
 * scope if the variable happened to be set.
 *
 * Asserted by counting sessions that hold `app.tenant_id` while an interactive transaction is
 * open. A request that passes A4 while this count is zero has set the variable somewhere the
 * query cannot see it.
 */
export function assertA6VariableInTransaction(): void {
  // Asserted as the PAIR of properties that matter, in one session so the two are comparable:
  //
  //   inside a transaction   set_config(..., is_local => true) is visible to the query
  //   after it commits       the setting is GONE
  //
  // The second half is the one worth having. A setting that outlived its transaction would leak
  // the previous caller's tenant onto the next request that borrowed the same pooled connection
  // — a cross-tenant read with no attacker, produced by connection reuse alone.
  //
  // An earlier version of this assertion counted rows in `pg_settings` from a FRESH psql
  // session. A custom GUC only exists on a connection where it has been set, so the count was
  // always 0 and the assertion was simply wrong — it would have failed on a correct system.
  const probe = '01912f00-0000-7000-8000-00000000000a';
  const observed = psql(
    `BEGIN;
     SELECT set_config('app.tenant_id', '${probe}', true);
     SELECT 'inside=' || current_setting('app.tenant_id');
     COMMIT;
     SELECT 'after=[' || coalesce(current_setting('app.tenant_id', true), '<null>') || ']';`,
  );

  assert.match(
    observed,
    new RegExp(`inside=${probe}`),
    `A6 FAILED: app.tenant_id was not readable inside the transaction that set it. Every RLS ` +
      `policy in this schema reads it, so this is the mechanism they all depend on.\n${observed}`,
  );

  // After COMMIT the VALUE is gone. Postgres leaves the custom GUC REGISTERED with an empty
  // string rather than unregistering it, so the assertion is on the value and not on `<null>` —
  // an earlier version demanded the latter and failed against entirely correct behaviour.
  //
  // The value is what matters. A registered-but-empty GUC makes the policy's
  // `current_setting('app.tenant_id')` — which has NO missing_ok — return '', and '' matches no
  // tenant. What must never happen is the previous transaction's id still being there when a
  // pooled connection is handed to the next request.
  assert.ok(
    !observed.includes(`after=[${probe}]`),
    `A6 FAILED: app.tenant_id SURVIVED its transaction. is_local must be true, or a pooled ` +
      `connection carries one request's tenant into the next — a cross-tenant read produced by ` +
      `connection reuse alone, with no attacker involved.\n${observed}`,
  );
  assert.match(observed, /after=\[(<null>)?\]/, `unexpected post-commit value:\n${observed}`);
}

/** Substitutes the single path parameter, whatever it is named. */
export function fillPath(path: string, id: string): string {
  return path.replace(/\{[^}]+\}/g, id);
}
