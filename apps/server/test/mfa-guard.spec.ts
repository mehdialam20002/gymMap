/**
 * `M-024` · `MfaGuard` — `NFR-SEC-11`, `Security.md` §2.8, `E1.3`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MfaGuard, MFA_EXEMPT } from '../dist/common/guards/mfa.guard.js';
import { IS_PUBLIC } from '../dist/common/decorators/public.decorator.js';

const TENANT = '0192de00-0000-7000-8000-00000000000a';

function harness(options: {
  roles?: readonly string[];
  enabled?: boolean;
  missing?: boolean;
  // `IS_PUBLIC` is a string key and `MFA_EXEMPT` a symbol — `PropertyKey` covers both.
  metadata?: Record<PropertyKey, boolean>;
  noPrincipal?: boolean;
} = {}) {
  let reads = 0;

  const store = {
    read: async () => {
      reads += 1;
      return options.missing
        ? null
        : {
            userId: 'user-ana',
            enabled: options.enabled ?? false,
            enrolledAt: null,
            secretEnvelope: null,
            recoveryCodeHashes: [],
            lastStep: null,
          };
    },
    savePendingSecret: async () => undefined,
    activate: async () => undefined,
    recordAcceptedStep: async () => undefined,
    replaceRecoveryCodes: async () => undefined,
    clear: async () => undefined,
  };

  const metadata = options.metadata ?? {};
  const reflector = {
    getAllAndOverride: (key: PropertyKey) => metadata[key],
  };

  const context = {
    getHandler: () => ({ name: 'handler' }),
    getClass: () => ({ name: 'Controller' }),
    switchToHttp: () => ({
      getRequest: () =>
        options.noPrincipal
          ? {}
          : { principal: { sub: 'user-ana', roles: options.roles ?? [] } },
    }),
  };

  return {
    guard: new MfaGuard(reflector as any, store as any),
    context: context as any,
    get reads() {
      return reads;
    },
  };
}

test('NFR-SEC-11 — enrolled platform staff pass', async () => {
  const h = harness({ roles: [`SUPER_ADMIN@platform`], enabled: true });
  assert.equal(await h.guard.canActivate(h.context), true);
});

test('§2.8 — UNENROLLED platform staff are refused with the code the client acts on', async () => {
  // A bare 403 leaves the console with a dead end. The CODE is what lets it open the enrolment
  // flow instead of showing "forbidden" to somebody who can fix this in thirty seconds.
  const h = harness({ roles: [`FINANCE@platform`], enabled: false });

  await assert.rejects(
    () => h.guard.canActivate(h.context),
    (error: { code?: string }) => error.code === 'MFA_ENROLMENT_REQUIRED',
  );
});

test('a user row that does not exist is refused, not waved through', async () => {
  // `state?.enabled === true` rather than `state?.enabled !== false` — the optional chain must fall
  // to the refusal, or a deleted account with a live token bypasses the mandate entirely.
  const h = harness({ roles: [`MODERATOR@platform`], missing: true });
  await assert.rejects(() => h.guard.canActivate(h.context));
});

test('a GYM_OWNER without a factor passes — OPTIONAL is not MANDATORY', async () => {
  const h = harness({ roles: [`GYM_OWNER@t:${TENANT}`], enabled: false });
  assert.equal(await h.guard.canActivate(h.context), true);
  assert.equal(h.reads, 0, 'the store was queried for a role that does not require a factor');
});

test('a RECEPTIONIST passes without a store read at all', async () => {
  // NOT_OFFERED. Querying would be harmless and pointless — a round trip per request for every
  // front-desk operator, to answer a question whose answer cannot change the outcome.
  const h = harness({ roles: [`RECEPTIONIST@b:${TENANT}:branch-1`], enabled: false });
  assert.equal(await h.guard.canActivate(h.context), true);
  assert.equal(h.reads, 0);
});

test('the enrolment route is exempt, or nobody could ever enrol', async () => {
  // ┌─ WHY THE EXEMPTION IS A DECORATOR AND NOT A PATH LIST ─────────────────────────────────────┐
  // │ A list of URLs inside the guard drifts the moment a route is renamed, and it drifts in the  │
  // │ dangerous direction: the enrolment endpoint stops being exempt and no staff member can      │
  // │ enrol — a lockout of everybody at once, caused by a rename.                                 │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const h = harness({
    roles: [`SUPER_ADMIN@platform`],
    enabled: false,
    metadata: { [MFA_EXEMPT]: true },
  });

  assert.equal(await h.guard.canActivate(h.context), true);
});

test('a public route is not gated', async () => {
  const h = harness({ roles: [], metadata: { [IS_PUBLIC]: true } });
  assert.equal(await h.guard.canActivate(h.context), true);
});

test('a MALFORMED role claim contributes nothing, and is not treated as staff', async () => {
  // `parseRoleGrants` drops anything unrecognised, so a forged `SUPER_ADMIN@` claim yields no role.
  // This guard therefore lets it past — correctly: the permission guard refuses it separately, and
  // two controls that do not rely on each other is the point.
  const h = harness({ roles: ['SUPER_ADMIN@', 'NOT_A_ROLE@platform', 'garbage'] });
  assert.equal(await h.guard.canActivate(h.context), true);
});

test('a GYM_OWNER@platform claim is refused as a role and does not become staff', async () => {
  // §B3.1 scopes GYM_OWNER to a tenant, so this claim is forged or stale. It parses to nothing.
  const h = harness({ roles: ['GYM_OWNER@platform'] });
  assert.equal(await h.guard.canActivate(h.context), true);
  assert.equal(h.reads, 0);
});

test('no principal defers to JwtAuthGuard rather than answering 403', async () => {
  // Refusing here would answer 403 to a request that should get 401 — telling an unauthenticated
  // caller that the route exists and needs MFA.
  const h = harness({ noPrincipal: true });
  assert.equal(await h.guard.canActivate(h.context), true);
});

test('holding a staff role ALONGSIDE a tenant role still requires the factor', async () => {
  const h = harness({
    roles: [`GYM_OWNER@t:${TENANT}`, `SUPPORT_AGENT@platform`],
    enabled: false,
  });

  await assert.rejects(
    () => h.guard.canActivate(h.context),
    (error: { code?: string }) => error.code === 'MFA_ENROLMENT_REQUIRED',
  );
});
