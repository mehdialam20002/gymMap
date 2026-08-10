/**
 * M-008 · `api-gates` and `api-absence-assertions` — fixture documents, each failing exactly
 * one gate with its own PG- or invariant id.
 *
 * With zero real endpoints, both scripts currently pass on the live document. That is exactly
 * when a gate is most likely to be inert and least likely to be noticed: it goes green on the
 * day it is written and stays green for six sprints, and nobody discovers it never worked until
 * the first unguarded endpoint ships. These fixtures prove each gate bites BEFORE it has
 * anything real to bite on.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  runApiGates,
  loadRealConfig,
  MODULES,
  FORBIDDEN_PREFIXES,
  UNVERSIONED,
} from './api-gates.mjs';
import { runAbsenceAssertions } from './api-absence-assertions.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const ERROR_CODES = new Set(['VALIDATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND']);
const RATE_LIMITS = new Set(['RL-READ', 'RL-WRITE', 'RL-PAYMENT', 'RL-ADMIN']);
const ALLOWLIST = new Set(['GET /healthz', 'GET /readyz']);

/** A minimal document with one operation, so each test breaks exactly one thing. */
function doc(path, method, extensions = {}, extra = {}) {
  return {
    openapi: '3.0.0',
    paths: { [path]: { [method]: { summary: 'x', ...extensions, ...extra } } },
  };
}

/**
 * The default driver leaves `permissionRegistry` unset, so PG-7 does not run.
 *
 * Deliberate. Every test below uses a permission string chosen to exercise PG-1, PG-2, PG-3, PG-5
 * or PG-6, and none of them is in any real registry — feeding them one would make PG-7 fire on
 * forty assertions that are about something else, and each would then be proved by the wrong
 * failure. PG-7 gets its own driver and its own fixture, immediately below its tests.
 */
const gates = (document) =>
  runApiGates({
    document,
    publicAllowlist: ALLOWLIST,
    errorCodes: ERROR_CODES,
    rateLimitClasses: RATE_LIMITS,
  });

/** A fixture registry — `RB3`'s "some module's permissions.ts", stubbed to two real keys. */
const PERMISSIONS = new Set(['ordering.order.create', 'catalog.branch.read']);

const gatesWithRegistry = (document) =>
  runApiGates({
    document,
    publicAllowlist: ALLOWLIST,
    errorCodes: ERROR_CODES,
    rateLimitClasses: RATE_LIMITS,
    permissionRegistry: PERMISSIONS,
  });

const codes = (problems) => problems.map((p) => p.gate);

const GUARDED = {
  'x-gymmap-permission': 'ordering.order.create',
  'x-gymmap-rate-limit': 'RL-WRITE',
};

// ---------------------------------------------------------------------------
// The baseline must be clean, or every assertion below proves nothing.
// ---------------------------------------------------------------------------

test('a well-formed operation passes every gate', () => {
  const { problems } = gates(doc('/v1/tenant/plans', 'post', GUARDED));
  assert.deepEqual(problems, []);
});

test('the two probes as they actually exist pass', () => {
  const { problems } = gates({
    openapi: '3.0.0',
    paths: {
      '/healthz': { get: { 'x-gymmap-public': true, 'x-gymmap-rate-limit': 'RL-READ' } },
      '/readyz': { get: { 'x-gymmap-public': true, 'x-gymmap-rate-limit': 'RL-READ' } },
    },
  });
  assert.deepEqual(problems, []);
});

// ---------------------------------------------------------------------------
// PG-1 — every route declares a permission or is a reviewed public exemption.
// ---------------------------------------------------------------------------

test('PG-1 · a route with no permission and no @Public() fails', () => {
  const { problems } = gates(
    doc('/v1/tenant/plans', 'post', { 'x-gymmap-rate-limit': 'RL-WRITE' }),
  );
  assert.deepEqual(codes(problems), ['PG-1']);
  assert.match(problems[0].message, /FR-RBAC-01/);
  assert.match(problems[0].message, /whoever holds any valid token/);
});

test('PG-1 · @Public() without an allowlist row fails', () => {
  const { problems } = gates(
    doc('/v1/gyms', 'get', { 'x-gymmap-public': true, 'x-gymmap-rate-limit': 'RL-READ' }),
  );
  assert.deepEqual(codes(problems), ['PG-1']);
  assert.match(problems[0].message, /public-allowlist/);
  assert.match(problems[0].message, /five characters/, 'must say why two mechanisms exist');
});

test('PG-1 · @Public() AND permission-guarded fails — the ambiguity is the bug', () => {
  const { problems } = gates(
    doc('/v1/tenant/plans', 'post', { ...GUARDED, 'x-gymmap-public': true }),
  );
  assert.ok(codes(problems).includes('PG-1'));
  assert.match(
    problems.find((p) => p.gate === 'PG-1').message,
    /cannot be inferred/,
    'must explain that the guard and the contract would disagree',
  );
});

// ---------------------------------------------------------------------------
// PG-3 — permission grammar.
// ---------------------------------------------------------------------------

test('PG-3 · a two-segment permission fails', () => {
  const { problems } = gates(
    doc('/v1/tenant/plans', 'post', { ...GUARDED, 'x-gymmap-permission': 'plan.update' }),
  );
  assert.deepEqual(codes(problems), ['PG-3']);
  assert.match(problems[0].message, /<module>\.<resource>\.<action>/);
});

test('PG-3 · the colon-and-scope form from §12.2.1 is rejected', () => {
  // `order:create.self` was the pre-AZ1 grammar. Self-scope is the /me prefix and the ownership
  // guard, not a segment in the string.
  const { problems } = gates(
    doc('/v1/orders', 'post', {
      'x-gymmap-permission': 'order:create.self',
      'x-gymmap-rate-limit': 'RL-PAYMENT',
      'x-gymmap-idempotent': 'required',
      // `/v1/orders` is in §14.2.1's money row, so PG-6 wants the marker. Supplied here so this
      // fixture still breaks exactly one thing — the permission grammar.
      'x-gymmap-financial-mutation': true,
    }),
  );
  assert.deepEqual(codes(problems), ['PG-3']);
});

test('PG-3 · a first segment that is not one of the 23 modules fails', () => {
  const { problems } = gates(
    doc('/v1/tenant/plans', 'post', { ...GUARDED, 'x-gymmap-permission': 'gym.plan.update' }),
  );
  assert.deepEqual(codes(problems), ['PG-3']);
  assert.match(problems[0].message, /"gym"/);
  assert.match(problems[0].message, /23 modules/);
});

test('PG-3 · every one of the 23 modules is accepted as a first segment', () => {
  for (const module of MODULES) {
    const { problems } = gates(
      doc('/v1/tenant/thing', 'post', {
        ...GUARDED,
        'x-gymmap-permission': `${module}.thing.update`,
      }),
    );
    assert.deepEqual(problems, [], `module "${module}" was rejected`);
  }
});

// ---------------------------------------------------------------------------
// PG-2 — idempotency where §14.2.1 says REQ.
// ---------------------------------------------------------------------------

const MONEY_ROUTES = [
  ['/v1/orders', 'post'],
  ['/v1/orders/abc/payment-intent', 'post'],
  ['/v1/me/memberships/abc/freeze', 'post'],
  ['/v1/me/memberships/abc/renew', 'post'],
  ['/v1/tenant/refunds', 'post'],
  ['/v1/checkin/scan', 'post'],
  ['/v1/webhooks/payments/razorpay', 'post'],
  ['/v1/tenant/exports', 'post'],
  ['/v1/orders/abc/coupon', 'post'],
];

for (const [path, method] of MONEY_ROUTES) {
  test(`PG-2 · ${method.toUpperCase()} ${path} without @Idempotent() fails`, () => {
    const { problems } = gates(doc(path, method, GUARDED));
    assert.ok(
      codes(problems).includes('PG-2'),
      `${path} affects money, membership state or attendance and must require an Idempotency-Key`,
    );
    assert.match(problems.find((p) => p.gate === 'PG-2').message, /charges twice|§14\.2\.1/);
  });
}

test('PG-2 · the same route WITH @Idempotent() passes', () => {
  const { problems } = gates(
    doc('/v1/orders', 'post', {
      ...GUARDED,
      'x-gymmap-idempotent': 'required',
      // PG-6 also applies to `/v1/orders`. "Passes" means passes EVERY gate, so a clean fixture
      // has to satisfy the one added after it was written.
      'x-gymmap-financial-mutation': true,
    }),
  );
  assert.deepEqual(problems, []);
});

test('PG-2 · a GET is never asked for idempotency', () => {
  const { problems } = gates(
    doc('/v1/orders', 'get', {
      'x-gymmap-permission': 'ordering.order.read',
      'x-gymmap-rate-limit': 'RL-READ',
    }),
  );
  assert.deepEqual(problems, []);
});

test('PG-2 · a non-money mutation is not asked for idempotency', () => {
  const { problems } = gates(doc('/v1/tenant/gym/description', 'patch', GUARDED));
  assert.deepEqual(problems, []);
});

// ---------------------------------------------------------------------------
// PG-5 — rate-limit class and registered error codes.
// ---------------------------------------------------------------------------

test('PG-5 · a route with no rate-limit class fails', () => {
  const { problems } = gates(
    doc('/v1/tenant/plans', 'post', { 'x-gymmap-permission': 'plans.plan.update' }),
  );
  assert.deepEqual(codes(problems), ['PG-5']);
  assert.match(problems[0].message, /unmetered/);
});

test('PG-5 · a rate-limit class outside the closed set fails', () => {
  const { problems } = gates(
    doc('/v1/tenant/plans', 'post', { ...GUARDED, 'x-gymmap-rate-limit': 'RL-WHATEVER' }),
  );
  assert.deepEqual(codes(problems), ['PG-5']);
});

test('PG-5 · an unregistered error code fails, and says what it costs the user', () => {
  const { problems } = gates(
    doc('/v1/tenant/plans', 'post', {
      ...GUARDED,
      'x-gymmap-error-codes': ['VALIDATION_FAILED', 'PLAN_IS_HAUNTED'],
    }),
  );
  assert.deepEqual(codes(problems), ['PG-5']);
  assert.match(problems[0].message, /PLAN_IS_HAUNTED/);
  assert.match(problems[0].message, /§13\.2 registry/);
});

test('PG-5 · registered error codes pass', () => {
  const { problems } = gates(
    doc('/v1/tenant/plans', 'post', {
      ...GUARDED,
      'x-gymmap-error-codes': ['VALIDATION_FAILED', 'PERMISSION_DENIED'],
    }),
  );
  assert.deepEqual(problems, []);
});

// ---------------------------------------------------------------------------
// AC-5 — versioning and the five closed audience prefixes.
// ---------------------------------------------------------------------------

test('AC-5 · an unversioned business route fails', () => {
  const { problems } = gates(
    doc('/gyms', 'get', {
      'x-gymmap-permission': 'discovery.gym.read',
      'x-gymmap-rate-limit': 'RL-READ',
    }),
  );
  assert.deepEqual(codes(problems), ['AC-5']);
  assert.match(problems[0].message, /deprecated/);
});

test('AC-5 · the two probes are allowed to be unversioned', () => {
  for (const probe of UNVERSIONED) {
    const { problems } = gates(
      doc(probe, 'get', { 'x-gymmap-public': true, 'x-gymmap-rate-limit': 'RL-READ' }),
    );
    assert.deepEqual(
      problems.filter((p) => p.gate === 'AC-5'),
      [],
      `${probe} must be exempt`,
    );
  }
});

for (const forbidden of FORBIDDEN_PREFIXES) {
  test(`AC-5 · the forbidden prefix ${forbidden} fails`, () => {
    const { problems } = gates(
      doc(`/v1${forbidden}/thing`, 'get', {
        'x-gymmap-permission': 'admin.thing.read',
        'x-gymmap-rate-limit': 'RL-READ',
      }),
    );
    assert.ok(codes(problems).includes('AC-5'));
    assert.match(
      problems.find((p) => p.gate === 'AC-5').message,
      /names a CLIENT, not an AUDIENCE/,
    );
  });
}

test('AC-5 · the four permitted audience prefixes pass', () => {
  for (const prefix of ['/me', '/tenant', '/admin', '/webhooks']) {
    const { problems } = gates(
      doc(`/v1${prefix}/thing`, 'get', {
        'x-gymmap-permission': 'admin.thing.read',
        'x-gymmap-rate-limit': 'RL-READ',
      }),
    );
    assert.deepEqual(problems, [], `prefix ${prefix} must be permitted`);
  }
});

// ---------------------------------------------------------------------------
// The four absence assertions.
// ---------------------------------------------------------------------------

test('I5 · a client-driven activation route fails (BR-PAY-02)', () => {
  const { problems } = runAbsenceAssertions(doc('/v1/me/memberships/abc/activate', 'post'));
  assert.equal(problems.length, 1);
  assert.equal(problems[0].assertion, 'no-client-signal-activation');
  assert.match(problems[0].message, /forgeable/);
});

test('I5 · an operation DOCUMENTED as activating a membership fails even with a safe path', () => {
  const { problems } = runAbsenceAssertions(
    doc('/v1/orders/abc/done', 'post', { summary: 'Activates the membership after payment' }),
  );
  assert.ok(problems.some((p) => p.assertion === 'no-client-signal-activation'));
});

test('I5 · the webhook route is exempt — it IS the activation path', () => {
  const { problems } = runAbsenceAssertions(
    doc('/v1/webhooks/payments/razorpay', 'post', {
      summary: 'Activates the membership on a verified capture',
    }),
  );
  assert.deepEqual(problems, []);
});

test('I2 · a monetary field in a request body fails (BR-PAY-04)', () => {
  const document = {
    openapi: '3.0.0',
    paths: {
      '/v1/orders': {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: { type: 'object', properties: { planId: {}, amountMinor: {} } },
              },
            },
          },
        },
      },
    },
  };
  const { problems } = runAbsenceAssertions(document);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].assertion, 'no-monetary-request-field');
  assert.match(problems[0].message, /client-CHOSEN/);
});

test('I2 · a shared component schema with a price is caught too', () => {
  // Checking only inline schemas would miss every operation that references the shared DTO.
  const document = {
    openapi: '3.0.0',
    paths: {},
    components: {
      schemas: { CreateOrderRequest: { type: 'object', properties: { price: {} } } },
    },
  };
  const { problems } = runAbsenceAssertions(document);
  assert.equal(problems.length, 1);
  assert.match(problems[0].where, /CreateOrderRequest/);
});

test('I1 · a tenant id header fails (BR-TEN-01)', () => {
  const document = doc('/v1/tenant/plans', 'get', {
    parameters: [{ name: 'X-Tenant-Id', in: 'header' }],
  });
  const { problems } = runAbsenceAssertions(document);
  assert.equal(problems[0].assertion, 'no-client-tenant-id');
  assert.match(problems[0].message, /someone ELSE'S tenant/);
});

test('I1 · a tenant id in the path fails', () => {
  const { problems } = runAbsenceAssertions(doc('/v1/tenant/{tenantId}/plans', 'get'));
  assert.ok(problems.some((p) => p.assertion === 'no-client-tenant-id'));
});

test('I1 · a tenant id in the request body fails', () => {
  const document = {
    openapi: '3.0.0',
    paths: {
      '/v1/tenant/plans': {
        post: {
          requestBody: {
            content: {
              'application/json': { schema: { type: 'object', properties: { tenant_id: {} } } },
            },
          },
        },
      },
    },
  };
  const { problems } = runAbsenceAssertions(document);
  assert.ok(problems.some((p) => p.assertion === 'no-client-tenant-id'));
});

test('I4 · deciding an application outside /admin fails (BR-GYM-03)', () => {
  const { problems } = runAbsenceAssertions(doc('/v1/tenant/applications/abc/approve', 'post'));
  assert.equal(problems[0].assertion, 'no-gym-edits-review');
  assert.match(problems[0].message, /approve their own listing/);
});

test('I4 · the same decision under /admin is correct and passes', () => {
  const { problems } = runAbsenceAssertions(doc('/v1/admin/applications/abc/approve', 'post'));
  assert.deepEqual(problems, []);
});

// ---------------------------------------------------------------------------
// The live document.
// ---------------------------------------------------------------------------

const liveDocument = () => JSON.parse(readFileSync(resolve(REPO_ROOT, 'openapi.json'), 'utf8'));

test('the committed openapi.json passes both gates', () => {
  // The REAL registries, not the three-code fixture set above. Sharing the fixtures here was a
  // bug: it made this assertion fail the moment M-012 shipped a route emitting UNAUTHENTICATED,
  // a code that is registered — the gate passed, the test did not, and the test was wrong.
  const document = liveDocument();
  const real = loadRealConfig(REPO_ROOT);

  assert.ok(real.errorCodes.size > 10, 'the registry failed to load — this test proves nothing');
  assert.ok(
    real.permissionRegistry.size > 40,
    `the permission registry loaded ${String(real.permissionRegistry.size)} keys — §B3.2 has 42 ` +
      `capabilities, so anything this small means the regex stopped matching and PG-7 is now ` +
      `passing every route by accident`,
  );
  assert.deepEqual(runApiGates({ document, ...real }).problems, []);
  assert.deepEqual(runAbsenceAssertions(document).problems, []);
});

// ---------------------------------------------------------------------------
// PG-7 · Security.md RB3 — the string must be IN the registry, not merely well-formed
// ---------------------------------------------------------------------------

test('PG-7 — a well-formed permission that exists nowhere is refused', () => {
  /*
   * `catalog.branch.create` is the real case, not an invented one. `API_Catalog.md` line 941
   * freezes it for `POST /v1/tenant/branches`; the shipped `CAPABILITY_MATRIX` decomposes
   * `§B3.2` row 20 into `catalog.branch.read` and `catalog.branch.write` and nothing else. That
   * disagreement is `BLK-19`.
   *
   * PG-3 passes it — three lowercase segments, first segment a real module — and before this
   * gate existed nothing else looked. The route would have shipped and refused every caller with
   * UNKNOWN_PERMISSION at request time.
   */
  const { problems } = gatesWithRegistry(
    doc('/v1/tenant/branches', 'post', {
      'x-gymmap-permission': 'catalog.branch.create',
      'x-gymmap-rate-limit': 'RL-WRITE',
      'x-gymmap-idempotent': 'required',
    }),
  );

  assert.ok(codes(problems).includes('PG-7'), 'an unregistered permission was accepted');
  assert.ok(
    !codes(problems).includes('PG-3'),
    'PG-3 must NOT fire here — the whole point is that the string is well-formed, and if PG-3 ' +
      'caught it then PG-7 is being proved by the wrong assertion',
  );
});

test('PG-7 — the sibling key that IS registered passes', () => {
  // The control. Without it, a PG-7 that refused everything would look identical above.
  const { problems } = gatesWithRegistry(
    doc('/v1/tenant/branches/abc', 'get', {
      'x-gymmap-permission': 'catalog.branch.read',
      'x-gymmap-rate-limit': 'RL-READ',
    }),
  );
  assert.deepEqual(codes(problems), []);
});

test('PG-7 — a @Public() route with no permission is not dragged in', () => {
  const { problems } = gatesWithRegistry(
    doc('/healthz', 'get', { 'x-gymmap-public': true, 'x-gymmap-rate-limit': 'RL-READ' }),
  );
  assert.ok(!codes(problems).includes('PG-7'), 'PG-7 fired on a route with no permission at all');
});

test('PG-7 does not run at all when no registry is supplied, rather than passing silently', () => {
  /*
   * The default is `null`, and `null` means NOT CHECKED — which is a different thing from
   * checked-and-clean. This file's own header states the principle: *"0 routes checked and
   * everything checked and fine must never look the same in a log."*
   *
   * Pinned because the tempting default is an empty Set, and an empty Set would fail EVERY route
   * — turning a missing argument into a hundred spurious failures that somebody would silence by
   * deleting the gate.
   */
  const problems = runApiGates({
    document: doc('/v1/tenant/branches', 'post', {
      'x-gymmap-permission': 'catalog.branch.create',
      'x-gymmap-rate-limit': 'RL-WRITE',
      'x-gymmap-idempotent': 'required',
    }),
    publicAllowlist: ALLOWLIST,
    errorCodes: ERROR_CODES,
    rateLimitClasses: RATE_LIMITS,
  }).problems;

  assert.ok(!codes(problems).includes('PG-7'));
});

test('the real registry contains the keys the shipped routes declare', () => {
  // Guards the regex itself. If `loadRealConfig`'s pattern stopped matching `readKey: '...'`,
  // the set would be empty, PG-7 would refuse every route, and somebody would "fix" it by
  // removing the gate rather than the regex.
  const real = loadRealConfig(REPO_ROOT);
  assert.ok(real.permissionRegistry.has('catalog.branch.read'));

  /*
   * ┌─ THE CANARY FIRED, AND IT SAID EXACTLY WHAT TO DO ───────────────────────────────────────────┐
   * │ This block used to assert `catalog.branch.write` PRESENT and `catalog.branch.create` ABSENT, │
   * │ with the message: *"catalog.branch.create is now registered — if that was a deliberate §C10  │
   * │ decision, close BLK-19 in docs/PHASES.md and delete this assertion."*                         │
   * │                                                                                              │
   * │ That is what happened. `ADR-0047` records the owner's §C10 amendment and `BLK-19` is closed. │
   * │ The assertions are inverted rather than deleted, because the direction of the change is      │
   * │ itself worth pinning: `.write` appears on no route in `API_Catalog.md` and is gone, and the  │
   * │ five strings the catalogue actually freezes are the ones that must resolve.                   │
   * │                                                                                              │
   * │ Note this also proves the loader reads `extraReadKeys` / `extraWriteKeys`. It has no special │
   * │ handling for them — the pattern matches any quoted `<module>.<resource>.<action>` — and if   │
   * │ that ever stopped being true, `.list`, `.update` and `.deactivate` would silently drop out    │
   * │ of the registry and `PG-7` would refuse three shipped routes.                                 │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  assert.ok(
    !real.permissionRegistry.has('catalog.branch.write'),
    'catalog.branch.write is back. It is on no route in API_Catalog.md, and §5.6 calls a ' +
      'permission with no endpoint an ungoverned grant',
  );
  for (const key of ['catalog.branch.list', 'catalog.branch.create', 'catalog.branch.update']) {
    assert.ok(
      real.permissionRegistry.has(key),
      `${key} is not in the registry, so PG-7 refuses it`,
    );
  }
});

test('AC-5 — the probes are unversioned and everything else is under /v1', () => {
  // Asserted as a PROPERTY, not as a frozen list. The previous version demanded the document
  // contain exactly ['/healthz','/readyz'], which was true at M-008 and became a false failure
  // the day the first real endpoint shipped. A test that has to be edited whenever a route is
  // added is a test that gets edited without being read.
  const paths = Object.keys(liveDocument().paths);

  for (const probe of UNVERSIONED) {
    assert.ok(paths.includes(probe), `${probe} is missing — the probe must stay unversioned`);
  }
  for (const path of paths) {
    if (UNVERSIONED.includes(path)) continue;
    assert.match(
      path,
      /^\/v\d+\//,
      `${path} is neither a probe nor versioned. An unversioned public route cannot be changed ` +
        'without breaking every client at once.',
    );
  }
});

// ---------------------------------------------------------------------------
// PG-6 · M-025 — every §14.2.1 money route is marked, and only those are.
//
// ┌─ THIS GATE PASSES VACUOUSLY TODAY, WHICH IS WHY THE FIXTURES EXIST ────────────────────────┐
// │ Not one money-affecting route is built yet, so running it against the real contract proves │
// │ nothing at all. These fixtures are the only evidence that it will fail when the first       │
// │ refund endpoint lands without the marker — which is the single moment it has to work.       │
// └───────────────────────────────────────────────────────────────────────────────────────────┘
// ---------------------------------------------------------------------------

/** §14.2.1's money-affecting row, transcribed from the constitution. */
const MONEY_AFFECTING = [
  '/v1/orders',
  '/v1/orders/abc123/payment-intent',
  '/v1/payments/pay_1/retry',
  '/v1/tenant/orders/offline',
  '/v1/tenant/orders/ord_1/collect-balance',
  '/v1/me/memberships/mem_1/refund-request',
  '/v1/tenant/refunds',
  '/v1/admin/refunds/ref_1/decide',
  '/v1/admin/settlements/set_1/approve',
  '/v1/admin/disputes/dis_1/evidence',
];

const MONEY_GUARDED = { ...GUARDED, 'x-gymmap-idempotent': 'required' };

for (const path of MONEY_AFFECTING) {
  test(`PG-6 · POST ${path} without @FinancialMutation() fails`, () => {
    const { problems } = gates(doc(path, 'post', MONEY_GUARDED));
    assert.ok(
      codes(problems).includes('PG-6'),
      `${path} moves money and must be marked, or an impersonated session can spend it`,
    );
    assert.match(problems.find((p) => p.gate === 'PG-6').message, /BR-DAT-02|borrowed identity/);
  });
}

for (const path of MONEY_AFFECTING) {
  test(`PG-6 · POST ${path} WITH @FinancialMutation() passes`, () => {
    const { problems } = gates(
      doc(path, 'post', { ...MONEY_GUARDED, 'x-gymmap-financial-mutation': true }),
    );
    assert.deepEqual(problems, [], `${path} should be clean once marked`);
  });
}

test('PG-6 · the marker on a route §14.2.1 does not list ALSO fails', () => {
  // The quieter mistake. Either it is a money route the constitution has not enumerated — a §24
  // amendment, not a decorator — or the marker is on the wrong handler, silently blocking support
  // from doing something they are entitled to do.
  const { problems } = gates(
    doc('/v1/tenant/members', 'post', { ...GUARDED, 'x-gymmap-financial-mutation': true }),
  );
  assert.ok(codes(problems).includes('PG-6'));
  assert.match(problems.find((p) => p.gate === 'PG-6').message, /§24|wrong handler/);
});

test('PG-6 · a GET on a money path is never asked for the marker', () => {
  // Reading an order moves nothing. Marking it would refuse an impersonated support agent the one
  // thing impersonation is FOR — looking at what the user is looking at.
  const { problems } = gates(doc('/v1/orders', 'get', GUARDED));
  assert.deepEqual(problems, []);
});

test('PG-6 · membership and attendance routes are NOT financial mutations', () => {
  // ┌─ THE SUBSET THAT MAKES THE FEATURE USABLE ────────────────────────────────────────────────┐
  // │ §14.2.1 requires idempotency on freezes, renewals and check-ins too — but those are not    │
  // │ money. Reusing the idempotency list for this gate would forbid impersonating a user to      │
  // │ record a check-in or freeze a membership, which is most of what support does.               │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  for (const path of ['/v1/me/memberships/m_1/freeze', '/v1/checkin/manual']) {
    const { problems } = gates(doc(path, 'post', MONEY_GUARDED));
    assert.deepEqual(codes(problems), [], `${path} should not require the financial marker`);
  }
});
