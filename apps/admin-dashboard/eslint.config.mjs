/**
 * The admin console's ESLint entry point.
 *
 * ┌─ IT EXTENDS THE SHARED SET, IT DOES NOT REPLACE IT ─────────────────────────────────────────┐
 * │ ESLint uses the NEAREST config and does not merge upwards, so a local file that declared its │
 * │ own rules would quietly opt this app out of `no-float-money` and the rest of `A-21`. Hence    │
 * │ the spread: the shared set first, one narrow addition after it.                               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The addition is `public/theme.js` — the no-flash theme bootstrap. It is the one file in this app
 * that runs as a classic browser script rather than through the TypeScript build, so `document`
 * and `localStorage` are globals there and nowhere else. Declaring them here rather than
 * ignoring `public/` keeps the file linted; ignoring it would have meant the only unchecked
 * JavaScript in the app is the piece that runs before React exists.
 */
import shared from '@gymmap/config/eslint';

export default [
  ...shared,
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        localStorage: 'readonly',
        matchMedia: 'readonly',
        window: 'readonly',
      },
    },
  },
];
