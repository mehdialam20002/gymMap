/**
 * Root ESLint entry point.
 *
 * Owns NO rules — the same arrangement as `.dependency-cruiser.cjs`. The rule set lives in
 * `packages/config/eslint/` so it is versioned with everything else the workspace shares, and a
 * second copy here is how the two drift and the enforced rules stop matching the documented ones.
 */
export { default } from './packages/config/eslint/index.mjs';
