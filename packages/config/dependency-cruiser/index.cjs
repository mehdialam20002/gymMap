/**
 * M-002 · dependency-cruiser rule set — A-23, constitution §3.7, ModuleDependency.md §7.
 *
 * The architecture is only "enforced in code" if something fails the build when it is violated.
 * ESLint sees one file at a time and cannot see an edge between packages; this is the tool that
 * can, so the module boundaries live here.
 *
 * Re-exported by the root `.dependency-cruiser.cjs`, which owns no rules of its own.
 */

'use strict';

/** AC-3 — the four forbidden edges of FolderStructure.md §3.2, each with its rule id. */
const FORBIDDEN_EDGES = [
  {
    name: 'no-ui-to-utils',
    comment:
      '§3.2 — packages/ui must not depend on packages/utils. ui is presentational; utils is ' +
      'domain-adjacent (Money, Clock, formatting). The edge would drag server-shaped code into ' +
      'every browser bundle and put NFR-PERF-10 (200 KB) at risk for no rendering benefit.',
    severity: 'error',
    from: { path: '^packages/ui' },
    to: { path: '^packages/utils' },
  },
  {
    name: 'no-types-to-utils',
    comment:
      '§3.2 — packages/types must not depend on packages/utils. types is the leaf of the graph: ' +
      'branded ids, Money contracts, the error registry. Everything imports it, so an edge out ' +
      'of it is how a cycle enters the workspace.',
    severity: 'error',
    from: { path: '^packages/types' },
    to: { path: '^packages/utils' },
  },
  {
    name: 'no-app-to-app',
    comment:
      '§3.2 — no app may import another app. Shared code goes to packages/*. An app-to-app edge ' +
      'means the two deploy together, which defeats the point of four deployables.',
    severity: 'error',
    from: { path: '^apps/([^/]+)/' },
    to: { path: '^apps/([^/]+)/', pathNot: '^apps/$1/' },
  },
  {
    name: 'no-server-to-ui',
    comment:
      '§3.2 — apps/server must not import packages/ui. React primitives have no place in a ' +
      'NestJS process, and the edge would pull the DOM lib into the server type graph.',
    severity: 'error',
    from: { path: '^apps/server' },
    to: { path: '^packages/ui' },
  },
];

/** §11.5 — the tenancy prohibition dependency-cruiser can see and ESLint cannot. */
const TENANCY_RULES = [
  {
    name: 'no-raw-prisma-outside-tenancy',
    comment:
      'ADR-0005 / BR-TEN-01 — only the tenancy module may import @prisma/client directly. Every ' +
      'other module goes through the tenant-context extension, which wraps each operation in a ' +
      'transaction that sets app.tenant_id first. A raw client bypasses RLS silently: the query ' +
      'is valid, it simply has no tenant, and the failure surfaces as missing data rather than ' +
      'as an isolation breach.',
    severity: 'error',
    from: { path: '^apps/server/src', pathNot: '^apps/server/src/tenancy/prisma/' },
    to: { path: 'node_modules/@prisma/client' },
  },
  {
    name: 'no-platform-prisma-outside-allowlist',
    comment:
      'AC-FND-05.3 / PE4 / BR-TEN-01 / NFR-SEC-09 (M-014) — PlatformPrismaService and ' +
      'runElevated() read ACROSS tenants. ' +
      'Only four modules have a reason to: admin/ (the approval queue and the audit explorer), ' +
      'reporting/ (platform aggregates), settlements/ (reconciliation spans tenants by ' +
      'definition) and audit/ (the read port). Anywhere else, a cross-tenant read is a bug that ' +
      'looks like a feature — it returns MORE rows than expected, so it never fails a test and ' +
      "never throws; it just quietly shows one tenant another tenant's data. " +
      'The runtime guard refuses outside runElevated(); this rule refuses at the import, which ' +
      'is the layer a reviewer actually reads.',
    severity: 'error',
    from: {
      path: '^apps/server/src',
      pathNot: '^apps/server/src/(tenancy/|admin/|reporting/|settlements/|audit/)',
    },
    to: { path: '^apps/server/src/tenancy/prisma/(platform-prisma\\.service|platform-elevation)' },
  },
  {
    name: 'no-test-harness-in-src',
    comment:
      'NFR-SEC-09 / FR-RBAC-01, §12.3 (M-011 AC-8) — application code may not import ' +
      'test/harness/. The harness SIGNS access ' +
      'tokens (mint-token.ts), so anything in src/ that can reach it can mint a token for any ' +
      'tenant and any role: every authorisation control in the system, bypassed by one import. ' +
      'Living under test/ is a convention; this rule is the enforcement, and conventions do not ' +
      'survive a refactor at 6pm.',
    severity: 'error',
    from: { path: '^apps/server/src' },
    to: { path: '^apps/server/test/' },
  },
];

/** §3.4 — structural hygiene. */
const STRUCTURAL_RULES = [
  {
    name: 'no-circular',
    comment:
      '§3.7 — a cycle means the two modules are one module wearing two names, and neither can be ' +
      'extracted to a service later (ADR-0003).',
    severity: 'error',
    from: {},
    to: { circular: true },
  },
  {
    name: 'no-orphans',
    comment:
      '§3.7 — an unreachable module is dead code that still costs review time, build time and ' +
      'bundle weight (NFR-PERF-10). A warning rather than an error because a genuinely new module ' +
      'is briefly an orphan between the commit that creates it and the one that wires it in.',
    severity: 'warn',
    from: { orphan: true, pathNot: '\\.(spec|test|d)\\.[cm]?tsx?$|^packages/config/' },
    to: {},
  },
  {
    name: 'not-to-dev-dep',
    comment:
      '§3.6 — a runtime import of a devDependency works locally and fails in the production ' +
      'image, where devDependencies are pruned. The failure appears at container start, not in ' +
      'CI, which makes it a deploy-time surprise rather than a build error.',
    severity: 'error',
    // The exemption must cover .cjs and .mjs, not only .ts — the custom-rule specs are CommonJS
    // because ESLint's RuleTester is, and they legitimately import eslint itself.
    from: { path: '^(apps|packages)', pathNot: '\\.(spec|test)\\.[cm]?[jt]sx?$' },
    to: {
      dependencyTypes: ['npm-dev'],
      // `@types/*` packages are ERASED at compile time — `import type { Request } from 'express'`
      // emits nothing, so there is no runtime import to break in a pruned production image.
      // Declaring them as devDependencies is correct, and flagging them here was a false positive
      // that `tsPreCompilationDeps: true` makes unavoidable without this exclusion: the setting
      // is needed so type-only edges across a FORBIDDEN boundary stay visible, and it necessarily
      // surfaces these harmless ones too.
      pathNot: 'node_modules/@types/',
    },
  },
];

module.exports = {
  forbidden: [...FORBIDDEN_EDGES, ...TENANCY_RULES, ...STRUCTURAL_RULES],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|build|coverage|\\.next|\\.turbo)/' },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node'],
    },
    reporterOptions: { dot: { collapsePattern: '^(apps|packages)/[^/]+' } },
  },
};

// No additional exports. dependency-cruiser validates the exported object against its own
// schema and rejects any unrecognised top-level property — so a convenience export here fails
// the whole run with "data must NOT have additional properties". The spec derives what it needs
// from `forbidden` instead.
