/**
 * The token barrel — `DesignSystem.md` §2.3.
 *
 * Tier 1 is exported for `packages/ui`'s own use and for the generator and the proof suite. It is
 * NOT reachable from `apps/**` in the way that matters: the Tailwind preset emits no primitive
 * class names, so `bg-gm-indigo-600` does not exist as a utility (`TK5`). An app that imported
 * `palette` and inlined a hex would still be caught — by `UI3`'s lint on `-[` in a className, and
 * by review.
 */

export * from './primitive/palette.ts';
export * from './primitive/scale.ts';
export * from './semantic/index.ts';
export * from './component/index.ts';
export * from './density/index.ts';
export * from './contrast.proof.ts';
export { generateTokensCss } from './generate-css.ts';
