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
export const SEED_VERSION = '0.3' as const;
