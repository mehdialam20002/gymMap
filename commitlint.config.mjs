/**
 * A-24 · Conventional Commits carrying a PRD identifier.
 *
 * Grammar, from PROJECT_CONSTITUTION.md §20.3:
 *
 *     <type>(<PRD-ID>): <imperative summary, <= 72 chars>
 *
 * §20 rule: "Every commit references at least one PRD identifier in the scope
 * or the footer." Both routes are accepted below — scope is the normal one,
 * footer is the escape hatch for a commit that legitimately spans several
 * identifiers.
 *
 * Examples that pass:
 *   feat(FR-CHK-04): enforce the ten-step check-in validation order
 *   fix(BR-PAY-03): return the stored response on idempotency-key replay
 *   chore(A-23): add the dependency-cruiser rule set
 *   feat(API-ORD)!: remove the deprecated total field
 */

/** Every identifier family that appears in the specification set. */
const PRD_ID =
  /^(FR|BR|NFR|AC|US|SCR|API|BAC|E2E|UAT|OBJ|KPI|RSK|OQ|ASM|CON|DEP|TD|KL|ADR|EP|BLK|A)-[A-Z0-9]+(-[A-Z0-9]+)*$/;

/** Scopes that carry no PRD identifier but are still legitimate. */
const INFRASTRUCTURAL_SCOPES = new Set(['deps', 'deps-dev', 'release', 'repo', 'setup']);

const prdIdentifierPlugin = {
  rules: {
    'prd-identifier-present': (parsed) => {
      const { scope, body, footer } = parsed;

      if (scope && PRD_ID.test(scope)) return [true];
      if (scope && INFRASTRUCTURAL_SCOPES.has(scope)) return [true];

      // Footer route: "Refs: FR-CHK-04, BR-CHK-08"
      const trailing = `${body ?? ''}\n${footer ?? ''}`;
      const anywhere =
        /\b(FR|BR|NFR|AC|US|SCR|API|BAC|E2E|UAT|OBJ|KPI|RSK|OQ|ASM|CON|DEP|TD|KL|ADR|EP|BLK|A)-[A-Z0-9]+(-[A-Z0-9]+)*\b/;
      if (anywhere.test(trailing)) return [true];

      return [
        false,
        [
          'every commit must cite a PRD identifier in the scope or the footer',
          '',
          '  feat(FR-CHK-04): enforce the ten-step check-in validation order',
          '  fix(BR-PAY-03): return the stored response on idempotency-key replay',
          '',
          `  infrastructural scopes that need no identifier: ${[...INFRASTRUCTURAL_SCOPES].join(', ')}`,
        ].join('\n'),
      ];
    },
  },
};

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [prdIdentifierPlugin],
  rules: {
    // Fixed set — PROJECT_CONSTITUTION.md §20.2
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'refactor',
        'test',
        'perf',
        'chore',
        'ci',
        'build',
        'revert',
        'hotfix',
      ],
    ],
    'scope-empty': [2, 'never'],
    // PRD identifiers are upper-case; the default lower-case rule would reject them.
    'scope-case': [0],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-empty': [2, 'never'],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],
    'prd-identifier-present': [2, 'always'],
  },
};
