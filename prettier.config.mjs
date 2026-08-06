/**
 * Root Prettier configuration.
 *
 * At Phase 8 this file should shrink to a re-export of `@gymmap/config/prettier`
 * (FolderStructure.md §2 — shared tool config lives in packages/config). It is
 * defined inline for now because packages/config has no package.json yet:
 * Phase 8 is locked, and creating one would mean declaring dependencies.
 */

/** @type {import('prettier').Config} */
export default {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',

  overrides: [
    {
      // The specification set is ~90,000 lines of hand-formatted Markdown with
      // wide tables. Reflowing it would produce an enormous, meaningless diff
      // and would break the two-space hard line breaks.
      files: ['docs/**/*.md', '*.md'],
      options: {
        proseWrap: 'preserve',
        printWidth: 100,
      },
    },
    {
      files: ['*.yml', '*.yaml'],
      options: { singleQuote: false },
    },
    {
      files: ['*.json', '*.jsonc'],
      options: { singleQuote: false, trailingComma: 'none' },
    },
  ],
};
