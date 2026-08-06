/**
 * M-002 · AC-1 — a RuleTester spec per custom rule, each with at least one valid and one
 * invalid case, and each invalid message naming the constitution clause it enforces.
 *
 * A lint rule with no failing test is a rule nobody has proved bites. These run on Node's
 * built-in runner for the same reason M-001's do — the milestone must verify itself.
 */

'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const noFloatMoney = require('./no-float-money.cjs');
const noTenantIdParameter = require('./no-tenant-id-parameter.cjs');
const noTypeImportInCtor = require('./no-type-import-in-ctor.cjs');

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: false } },
  },
});

// ---------------------------------------------------------------------------
// no-float-money — §10.3, BR-PAY-01, AC-FND-06.2
// ---------------------------------------------------------------------------

test('no-float-money', () => {
  ruleTester.run('no-float-money', noFloatMoney, {
    valid: [
      // AC-FND-06.2: bigint with an adjacent currency is the correct shape.
      { code: 'interface Order { priceMinor: bigint; currency: CurrencyCode; }' },
      { code: 'interface Order { totalMinor: bigint; }' },
      { code: 'class Order { amountMinor!: bigint; }' },
      { code: 'interface Line { commissionMinor: Money; }' },
      // The trap, from the other side: a LOCAL named `total` is not a declaration we police.
      { code: 'const total = 1.5;' },
      { code: 'function f() { let amount = 0.1 + 0.2; return amount; }' },
      // Names that match the money pattern but are demonstrably not money.
      { code: 'interface Tier { commissionRateBps: number; }' },
      { code: 'interface Page { totalCount: number; }' },
      { code: 'interface Batch { reserveBps: number; }' },
      // Untyped is someone else's rule.
      { code: 'const o = { price: 1 };' },
    ],
    invalid: [
      {
        code: 'interface Order { price: number; }',
        errors: [{ messageId: 'floatMoney' }],
      },
      {
        // The exact case the M-002 note warns a name-only check gets backwards.
        code: 'interface Order { amount_minor: number; }',
        errors: [{ messageId: 'floatMoney' }],
      },
      {
        code: 'class Settlement { payableToGym: number = 0; }',
        errors: [{ messageId: 'floatMoney' }],
      },
      {
        code: 'function charge(totalMinor: number) { return totalMinor; }',
        errors: [{ messageId: 'floatMoney' }],
      },
      {
        code: 'class S { constructor(private readonly feeMinor: number) {} }',
        errors: [{ messageId: 'floatMoney' }],
      },
      {
        code: 'interface O { discount: number | null; }',
        errors: [{ messageId: 'floatMoney' }],
      },
    ],
  });
});

test('no-float-money — the invalid message names the clause it enforces (AC-1)', () => {
  const msg = noFloatMoney.meta.messages.floatMoney;
  assert.match(msg, /§10\.3/, 'must cite the constitution clause');
  assert.match(msg, /BR-PAY-01/, 'must cite the business rule');
});

// ---------------------------------------------------------------------------
// no-tenant-id-parameter — §11.5 BR5, BR-TEN-01
// ---------------------------------------------------------------------------

test('no-tenant-id-parameter', () => {
  ruleTester.run('no-tenant-id-parameter', noTenantIdParameter, {
    valid: [
      // The correct shape: no tenant id anywhere. Context supplies it, RLS enforces it.
      { code: 'class Repo { findMany(where: Filter) { return where; } }' },
      { code: 'class Repo { findById(id: MembershipId) { return id; } }' },
      { code: 'interface Repo { list(cursor?: string): Promise<Row[]>; }' },
      // A parameter that merely mentions a tenant is not a tenant id.
      { code: 'class Repo { create(tenantProfile: Profile) { return tenantProfile; } }' },
      // Exempt paths — tenancy/ owns the context, and tests must be able to construct it.
      {
        code: 'class Ctx { set(tenantId: string) { return tenantId; } }',
        filename: '/repo/apps/server/src/tenancy/context.ts',
      },
      {
        code: 'function seed(tenantId: string) { return tenantId; }',
        filename: '/repo/apps/server/src/gyms/gym.repository.spec.ts',
      },
    ],
    invalid: [
      {
        code: 'class Repo { findMany(tenantId: string, where: Filter) { return where; } }',
        filename: '/repo/apps/server/src/gyms/gym.repository.ts',
        errors: [{ messageId: 'tenantIdParam' }],
      },
      {
        code: 'class Repo { count(tenant_id: string) { return tenant_id; } }',
        filename: '/repo/apps/server/src/gyms/gym.repository.ts',
        errors: [{ messageId: 'tenantIdParam' }],
      },
      {
        code: 'interface Repo { list(tenantId: TenantId): Promise<Row[]>; }',
        filename: '/repo/apps/server/src/plans/plan.repository.ts',
        errors: [{ messageId: 'tenantIdParam' }],
      },
      {
        code: 'class S { constructor(private readonly tenantId: string) {} }',
        filename: '/repo/apps/server/src/plans/plan.service.ts',
        errors: [{ messageId: 'tenantIdParam' }],
      },
    ],
  });
});

test('no-tenant-id-parameter — the message names the clause and the rule (AC-1)', () => {
  const msg = noTenantIdParameter.meta.messages.tenantIdParam;
  assert.match(msg, /§11\.5/);
  assert.match(msg, /BR-TEN-01/);
});

// ---------------------------------------------------------------------------
// no-type-import-in-ctor — the TD-030 mitigation
// ---------------------------------------------------------------------------

test('no-type-import-in-ctor', () => {
  ruleTester.run('no-type-import-in-ctor', noTypeImportInCtor, {
    valid: [
      {
        code: [
          "import { UserRepository } from './user.repository';",
          'class S { constructor(private readonly users: UserRepository) {} }',
        ].join('\n'),
      },
      {
        // A type-only import NOT used in a constructor is fine and desirable.
        code: [
          "import type { Filter } from './filter';",
          "import { UserRepository } from './user.repository';",
          'class S {',
          '  constructor(private readonly users: UserRepository) {}',
          '  find(f: Filter) { return f; }',
          '}',
        ].join('\n'),
      },
      { code: 'class S { constructor() {} }' },
    ],
    invalid: [
      {
        code: [
          "import type { UserRepository } from './user.repository';",
          'class S { constructor(private readonly users: UserRepository) {} }',
        ].join('\n'),
        errors: [{ messageId: 'typeImportInCtor' }],
      },
      {
        // Inline type specifier — the same erasure, easier to miss in review.
        code: [
          "import { type PaymentProvider } from './payment.provider';",
          'class S { constructor(private readonly pay: PaymentProvider) {} }',
        ].join('\n'),
        errors: [{ messageId: 'typeImportInCtor' }],
      },
    ],
  });
});

test('no-type-import-in-ctor — the message cites the debt it discharges (AC-1)', () => {
  assert.match(noTypeImportInCtor.meta.messages.typeImportInCtor, /TD-030/);
});
