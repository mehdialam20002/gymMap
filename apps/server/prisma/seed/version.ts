/**
 * M-006 · R-M2 — the seed's version, separate from its payload.
 *
 * The version is read by the isolation and integration harnesses to decide whether a database
 * they have been handed is the one their fixtures assume. A seed whose contents changed without
 * its version changing is how a test suite starts asserting against data it did not create.
 *
 * | Version | Milestone | Payload                                                              |
 * | :------ | :-------- | :------------------------------------------------------------------- |
 * | `0.1`   | M-006     | Empty — `0_init` creates no tables. Three tenants added by M-009.    |
 * | `0.2`   | M-019     | + 12 roles, the §B3.2 permission catalogue, 11 §6.6 principals.      |
 * | `0.3`   | M-029     | + the India KYC checklist, 4 rows (one per entity type), 40 items.   |
 *
 * `TestingStrategy.md` §6.7 specifies a richer artefact than this — `seed.manifest.json` with
 * `epoch`, `prngSeed`, `namespace`, per-table `checksums` and `counts`, enforced by `SD-2`.
 * That manifest is not built: the roadmap names `SEED_VERSION → 0.2` for M-019, and the gate that
 * would read the manifest (`SD-2`, part of CI job 11) does not exist yet either. A checksum
 * nobody verifies is worse than no checksum, because it looks like a control.
 *
 * Recorded as **TD-033** rather than quietly skipped. The counts the manifest would carry are
 * asserted today by `roles-seed.int-spec.ts`, which also resolves every `role_permissions` row
 * back to its key — weaker than a checksum, and considerably better than nothing.
 */
/*
 * ┌─ 0.3 → 0.4, and the reason is a PAYLOAD change rather than a code change ────────────────────┐
 * │ `ADR-0047` amended `§B3.2` under Part C §C10: three new capability rows (43–45) and one       │
 * │ amended row (20). The seed writes `permissions` and `role_permissions` from that matrix, so   │
 * │ the rows this seed produces are different from the rows `0.3` produced — eight new permission │
 * │ keys, `catalog.branch.write` gone, and new `(role, permission)` pairs for three roles.        │
 * │                                                                                              │
 * │ An environment still on `0.3` and one on `0.4` now disagree about who can list a branch. That │
 * │ is exactly the divergence a version string exists to make visible, and the reason              │
 * │ `roles-seed.int-spec.ts` compares it as a LITERAL: a `>=` comparison would let a payload       │
 * │ change slip past under an old version, which is the failure mode, not the check.               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
/*
 * 0.4 -> 0.5: the eleven principals gain a password hash. A payload change, not a code change —
 * an environment on 0.4 has accounts that cannot enrol MFA and one on 0.5 has accounts that can.
 */
/*
 * ┌─ 0.5 -> 0.6 (M-031): three gyms, five branches, ten amenity claims ──────────────────────────┐
 * │ The catalogue tables have existed since M-031's migrations and no seed ever wrote a row into │
 * │ them — while `tenants.ts` had described their contents since M-009: tenant A *"single        │
 * │ branch"*, tenant B *"multi-branch"*, tenant C *"suspended, so BR-GYM-01 visibility can be    │
 * │ tested"*. Three sentences about data that did not exist.                                      │
 * │                                                                                              │
 * │ A payload change of the strongest kind: an environment on 0.5 has zero branches and one on   │
 * │ 0.6 has five, so every catalogue assertion means something different depending on which one  │
 * │ the suite was handed. That is precisely what this string exists to make visible, and why     │
 * │ `roles-seed.int-spec.ts` compares it as a LITERAL rather than with `>=`.                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const SEED_VERSION = '0.6' as const;
