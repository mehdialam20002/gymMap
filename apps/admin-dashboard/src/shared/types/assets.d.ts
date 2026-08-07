/**
 * Side-effect stylesheet imports.
 *
 * `next-env.d.ts` covers CSS *modules* (`*.module.css`), but not a bare `import './globals.css'`,
 * which is how the Tailwind entry reaches the root layout. Without this the typecheck fails on a
 * line the build handles perfectly — a gap between what `tsc` knows and what the bundler does,
 * and the wrong fix would be to loosen the typecheck.
 */

declare module '*.css';
