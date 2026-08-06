/**
 * M-006 · R-M2 — the seed's version, separate from its payload.
 *
 * The version is read by the isolation and integration harnesses to decide whether a database
 * they have been handed is the one their fixtures assume. A seed whose contents changed without
 * its version changing is how a test suite starts asserting against data it did not create.
 */
export const SEED_VERSION = '0.1' as const;
