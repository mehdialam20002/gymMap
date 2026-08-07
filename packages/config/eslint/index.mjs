/**
 * The shared ESLint flat config — A-21…A-24, constitution §10.3, `AC-FND-06.2`, `AC-FND-13.3`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE FOUR CUSTOM RULES WERE WRITTEN IN M-002 AND HAD NEVER RUN
 *
 * `no-float-money`, `no-tenant-id-parameter` and `no-type-import-in-ctor` existed as rule
 * modules with passing `RuleTester` specs, and there was no ESLint config to register them in —
 * so `pnpm lint` exited 2 ("could not find a configuration file") and had done since M-002.
 *
 * A rule with a green unit test and no config is a rule that has never seen the codebase. This
 * file is what turns three tested functions into three enforced invariants, and M-016 is where
 * it belongs: `no-float-money` can only be switched on repository-wide once `Money` exists to
 * be the alternative.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { createRequire } from 'node:module';

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const require = createRequire(import.meta.url);

/** The custom rules, as a plugin. CommonJS because ESLint's `RuleTester` specs are. */
export const gymmapPlugin = {
  rules: {
    'no-float-money': require('./rules/no-float-money.cjs'),
    'no-tenant-id-parameter': require('./rules/no-tenant-id-parameter.cjs'),
    'no-type-import-in-ctor': require('./rules/no-type-import-in-ctor.cjs'),
    'no-bare-date': require('./rules/no-bare-date.cjs'),
  },
};

/**
 * Files where a bare `Date` is legitimate.
 *
 * A CLOSED list of three, not a pattern. `system-clock.adapter.ts` IS the clock; the utils time
 * module converts an instant it was given; and tests construct fixed instants deliberately.
 * Everything else injects `Clock` (`AC-FND-13.3`).
 */
const BARE_DATE_ALLOWED = [
  '**/common/clock/system-clock.adapter.ts',
  '**/packages/utils/src/time/**',
  '**/test/**',
  '**/*.spec.ts',
  '**/*.spec.mjs',
  '**/*.spec.cjs',
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/coverage/**',
      // Generated, and diffed byte-for-byte against its generator. Linting it would produce a
      // fix the generator immediately undoes.
      '**/test/isolation/_inventory.generated.ts',
      '**/next-env.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    /**
     * Node globals, declared by hand rather than via the `globals` package.
     *
     * `globals` is not on the approved dependency list, and the alternative to adding it is
     * eleven names. Everything in this repository runs under Node — the browser apps are
     * bundled, and their own DOM globals come from `lib: ["DOM"]` in the tsconfig, which ESLint
     * does not read but TypeScript does. So `no-undef` on a DOM symbol would be a false positive
     * that `tsc` has already ruled out, and it is disabled for TypeScript files below.
     */
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        structuredClone: 'readonly',
      },
    },
    plugins: { gymmap: gymmapPlugin },
    rules: {
      // ── The four invariants this repository enforces mechanically ──────────────────────
      'gymmap/no-float-money': 'error',
      'gymmap/no-tenant-id-parameter': 'error',
      'gymmap/no-type-import-in-ctor': 'error',
      'gymmap/no-bare-date': 'error',

      // `any` defeats every other type-level control in this codebase, including the branded
      // ids and the Money value object. §9.1.
      '@typescript-eslint/no-explicit-any': 'error',

      // An unused variable is usually a half-finished edit. `_`-prefixed is the escape hatch,
      // because a deliberately-ignored parameter is a real thing.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      /**
       * `console` bypasses the redaction layer entirely — `BR-DAT-06`, `NFR-OBS-*`.
       *
       * Pino strips names, emails, phone numbers and PANs from every log line it writes
       * (`redaction.ts`). A `console.log(user)` writes the whole object to stdout, where the
       * aggregator ingests it and the seven-year retention keeps it. Nothing errors, nothing is
       * flagged, and the personal data is in the log estate permanently.
       *
       * Two bootstrap files and the CI scripts are exempt below — they run before a logger
       * exists, or are not the application at all.
       */
      'no-console': 'error',

      // `Math.random()` in a security value is SEC-A02-008. Every OTP, nonce, token, salt and
      // recovery code comes from node:crypto's CSPRNG — and a rule that only fired inside
      // `iam/` would miss the one written somewhere else.
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Math.random() is not cryptographically secure (SEC-A02-008). Every OTP, nonce, ' +
            'token, salt and recovery code uses node:crypto. For non-security randomness, say ' +
            'so in a comment and disable this rule with an ADR reference.',
        },
      ],
    },
  },

  {
    /**
     * TypeScript files: `no-undef` is off, and that is the standard advice rather than a
     * loosening. `tsc` already resolves every identifier against the configured `lib`, so
     * ESLint duplicating the check adds nothing and produces false positives on every DOM
     * symbol in the browser apps — which ESLint cannot see the `lib` for.
     */
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    rules: { 'no-undef': 'off' },
  },

  {
    // CommonJS. `require` and `module` are the module system here, not a style choice: ESLint's
    // own `RuleTester` is CJS, so the custom-rule specs have to be.
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
        exports: 'writable',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  {
    // `createRequire` is the sanctioned ESM escape hatch for loading a CJS module, and this
    // config file itself uses it to register the four `.cjs` rules.
    files: ['**/*.mjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  {
    /**
     * Where `console` is legitimate.
     *
     * The `scripts/` gates, the seed and every test print to a terminal a human is reading,
     * not to the log estate — a CI gate whose output went through a structured logger would
     * be unreadable in an Actions log.
     *
     * `main.ts` and `worker.ts` are deliberately NOT here. They each have exactly one
     * `console.error`, in a bootstrap catch where the failure may BE the logger's own
     * construction — and a per-line disable naming that reason is narrower than exempting
     * two whole files, in which a later `console.log(user)` would go unflagged.
     */
    files: [
      '**/scripts/**',
      '**/test/**',
      '**/*.spec.*',
      '**/infra/**',
      '**/prisma/seed/**',
      'packages/config/**',
    ],
    rules: { 'no-console': 'off' },
  },

  { files: BARE_DATE_ALLOWED, rules: { 'gymmap/no-bare-date': 'off' } },

  {
    // Test files construct deliberately-wrong values to prove the code refuses them, so the
    // type-level rules that protect production code get in the way rather than helping.
    files: ['**/test/**', '**/*.spec.*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'gymmap/no-float-money': 'off',
    },
  },

  // LAST. Turns off every rule that conflicts with Prettier, so the two tools cannot disagree
  // about the same line — which is how a repository ends up with a format war in CI.
  prettier,
);
