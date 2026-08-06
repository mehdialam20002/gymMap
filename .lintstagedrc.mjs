/**
 * A-24 · lint-staged.
 *
 * Deliberately narrow for now. ESLint (A-21) is NOT wired in here yet, because
 * root-law R1a fixes the root devDependencies to exactly seven packages and
 * eslint is not one of them — it belongs to `packages/config` and is installed
 * per workspace at Phase 8. When that happens, add:
 *
 *   'apps/**\/*.{ts,tsx}': ['eslint --fix --max-warnings=0', 'prettier --write'],
 *
 * See docs/setup/INSTALLATION_REPORT.md for the reasoning and the exact command.
 */
export default {
  // docs/ is excluded by .prettierignore; --ignore-unknown keeps lint-staged
  // from failing when every staged file is ignored.
  '*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,css,scss,html}': ['prettier --write --ignore-unknown'],
  '*.{yml,yaml}': ['prettier --write --ignore-unknown'],
  '*.md': ['prettier --write --ignore-unknown'],
};
