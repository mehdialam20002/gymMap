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
const noBareDate = require('./no-bare-date.cjs');
const noSurfaceCurrencyFormat = require('./no-surface-currency-format.cjs');

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

      /*
       * M-030 · the physical quantities. Each matches MONEY_NAME — `maxTotalPixels` on "total",
       * `netBytes` on "net", `discountedSeconds` on "discount" — and none of them can hold a
       * monetary amount. `maxTotalPixels` is the ceiling that stops a decompression bomb.
       */
      { code: 'interface Limits { maxTotalPixels: number; }' },
      { code: 'interface Limits { maxEdgePixels: number; }' },
      { code: 'interface Probe { totalMetres: number; }' },
      { code: 'interface Probe { toleranceMeters: number; }' },
      { code: 'interface Cap { maxBytes: number; }' },
      { code: 'interface Job { totalSeconds: number; }' },
      { code: 'interface Job { expectedDurationMs: number; }' },
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
      /*
       * M-030 · the new physical-unit exemptions are SUFFIX-ANCHORED, and these prove it. Each
       * contains one of the added words somewhere other than the end, and each is money.
       *
       * Without the anchor `pixelPricing` would be exempt because it contains "pixel" — the same
       * mistake as the `discount`/"count" bug the exemption comment above records, re-made with a
       * different word. A widened exemption that quietly stops catching money is worse than the
       * false positive it was widening to fix.
       */
      {
        code: 'interface Ad { pixelPriceMinor: number; }',
        errors: [{ messageId: 'floatMoney' }],
      },
      {
        code: 'interface Bill { bytesTransferredFee: number; }',
        errors: [{ messageId: 'floatMoney' }],
      },
      {
        code: 'interface Plan { msPerRupeeTotal: number; }',
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

// ---------------------------------------------------------------------------
// no-bare-date — AC-FND-13.3, TR-21
//
// THE PARENTHESES ARE THE WHOLE RULE. `new Date()` reads the ambient clock;
// `new Date(value)` converts something it was given. A rule that banned both would be unusable,
// because parsing an ISO string from the database and copying a Date to avoid handing out a
// mutable reference are both `new Date(x)` and both correct.
// ---------------------------------------------------------------------------

test('no-bare-date', () => {
  ruleTester.run('no-bare-date', noBareDate, {
    valid: [
      // Converting a value it was GIVEN. This is the case the rule must never break.
      { code: 'const d = new Date(isoString);' },
      { code: 'const copy = new Date(other.getTime());' },
      { code: 'const d = new Date(2026, 0, 1);' },
      // The port. The whole point of the rule is that this is what code writes instead.
      { code: 'const now = clock.now();' },
      { code: 'const t = clock.now().getTime();' },
      // A property that merely happens to be called `now`.
      { code: 'const t = payload.now();' },
      { code: 'const t = other.Date.now();' },
    ],
    invalid: [
      {
        code: 'const now = new Date();',
        errors: [{ messageId: 'newDate' }],
      },
      {
        code: 'const t = Date.now();',
        errors: [{ messageId: 'dateNow' }],
      },
      {
        // Inside a method, which is where it actually appears.
        code: 'class S { expired(e) { return e < Date.now() / 1000; } }',
        errors: [{ messageId: 'dateNow' }],
      },
      {
        // Both forms in one file are two separate findings, not one.
        code: 'const a = new Date(); const b = Date.now();',
        errors: [{ messageId: 'newDate' }, { messageId: 'dateNow' }],
      },
    ],
  });
});

// ---------------------------------------------------------------------------
// no-surface-currency-format — FolderStructure.md §12 rules 12 & 14, LAUNCH_MARKET_INDIA.md §2
// ---------------------------------------------------------------------------

test('no-surface-currency-format', () => {
  ruleTester.run('no-surface-currency-format', noSurfaceCurrencyFormat, {
    valid: [
      // The point of the rule: the ONE formatter is imported, not reimplemented.
      {
        code: "import { formatIndianRupees } from '@gymmap/utils'; const s = formatIndianRupees(100n);",
      },

      // A formatter with no currency intent. Grouping a row count is not the problem, and a rule
      // that flagged it would be switched off within a week.
      { code: "const n = new Intl.NumberFormat('en-IN').format(1234);" },
      {
        code: "const n = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(1.25);",
      },
      { code: "const p = new Intl.NumberFormat('en-IN', { style: 'percent' }).format(0.18);" },
      { code: 'const s = value.toLocaleString();' },
      { code: "const s = date.toLocaleString('en-IN', { dateStyle: 'medium' });" },
      // Zero-argument and single-argument forms cannot express a currency.
      { code: 'const f = new Intl.NumberFormat();' },

      // A property NAMED currency on something that is not a formatter call.
      { code: "const config = { currency: 'INR' };" },
    ],

    invalid: [
      // The exact shape that reached the admin console's figures module.
      {
        code: "const s = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(x);",
        errors: [{ messageId: 'surfaceFormat' }],
      },
      // `style: 'currency'` alone.
      {
        code: "const s = new Intl.NumberFormat('en-IN', { style: 'currency' }).format(x);",
        errors: [{ messageId: 'surfaceFormat' }],
      },
      // A bare `currency:` key, without `style`. Still a currency formatter.
      {
        code: "const s = new Intl.NumberFormat('en-IN', { currency: 'INR' }).format(x);",
        errors: [{ messageId: 'surfaceFormat' }],
      },
      // Without `new` — same constructor, same result, and easy to miss by eye.
      {
        code: "const s = Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(x);",
        errors: [{ messageId: 'surfaceFormat' }],
      },
      // The method form, which is what §12 point 12 names literally.
      {
        code: "const s = amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });",
        errors: [{ messageId: 'surfaceFormat' }],
      },
      // A quoted key, because the AST shape differs and a rule that only read `Identifier` keys
      // would be silently bypassed by adding two quote characters.
      {
        code: "const s = amount.toLocaleString('en-IN', { 'style': 'currency' });",
        errors: [{ messageId: 'surfaceFormat' }],
      },
    ],
  });
});

test('no-surface-currency-format names the one formatter, so the fix is in the message', () => {
  const { surfaceFormat } = noSurfaceCurrencyFormat.meta.messages;
  assert.match(surfaceFormat, /format-indian-grouping\.ts/);
  assert.match(surfaceFormat, /formatIndianRupees/);
  // The consequence, not just the prohibition. A rule that says only "banned" gets argued with.
  assert.match(surfaceFormat, /2,50,000/);
});
