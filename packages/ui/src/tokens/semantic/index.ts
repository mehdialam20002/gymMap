/**
 * Tier 2 · The semantic barrel, and the check that keeps the two themes honest.
 *
 * `DesignSystem.md` §9.2: a key present in one theme and absent from the other must FAIL A TYPE
 * CHECK, so "we forgot the dark value" cannot ship. Two halves are needed, and only having one is
 * the usual mistake:
 *
 *   dark satisfies Record<ColourTokenKey, string>   in colour.dark.ts — every LIGHT key exists in
 *                                                    dark, and (via `satisfies` excess-property
 *                                                    checking on an object literal) no extra ones
 *   the assertion below                              the reverse direction, spelled out, so the
 *                                                    guarantee survives someone loosening the
 *                                                    `satisfies` clause in a hurry
 *
 * The runtime key-set equality lives in `tokens.spec.ts`, because a type error is invisible to
 * anyone reading a CI log — and the type check disappears the moment somebody writes `as any`.
 */

import { light, type ColourTokenKey } from './colour.light.ts';
import { dark } from './colour.dark.ts';

export { light, dark };
export type { ColourTokenKey };

/**
 * The compile-time half of §9.2, in both directions.
 *
 * Unused at runtime by design — its whole job is to stop typechecking if the key sets diverge.
 */
type DarkKey = keyof typeof dark;
type MissingFromDark = Exclude<ColourTokenKey, DarkKey>;
type ExtraInDark = Exclude<DarkKey, ColourTokenKey>;

// Both must be `never`. If either is not, one of these lines is an error naming the offending key.
const _noKeyMissingFromDark: MissingFromDark[] = [];
const _noExtraKeyInDark: ExtraInDark[] = [];
void _noKeyMissingFromDark;
void _noExtraKeyInDark;

export const COLOUR_TOKEN_KEYS = Object.keys(light) as ColourTokenKey[];

/** Every theme this system ships. `data-theme` on `<html>` selects one (§9.2 `DM1`). */
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const themes: Record<Theme, Record<ColourTokenKey, string>> = { light, dark };

export * from './space.ts';
export * from './misc.ts';
