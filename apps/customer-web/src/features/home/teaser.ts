/**
 * The three gyms the home page's compare teaser shows, and the URL its two buttons open.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A MODULE AND NOT TWO LINES INSIDE `chalk.tsx`
 *
 * `search({ ...EMPTY_QUERY, sort: 'distance' }).slice(0, 3)` was written out twice in `chalk.tsx`
 * - once for the plans block's "compare these" card and once for the comparison band below it -
 * and both fed a `toCompareParams(...)` of their own. Two copies of one fact, and a third copy of
 * the intent lived in the test.
 *
 * The test could not check any of them. `home-sections.spec.ts` asserted
 * `SECTIONS.includes('toCompareParams(')` - the NAME of the function, not its argument - so the
 * teaser could have shipped `toCompareParams([])` and stayed green: a table showing three gyms
 * above a button that opens an empty comparison. The test computed the right answer separately and
 * then never compared it to anything the page actually builds.
 *
 * The node runner cannot load a `.tsx`, which is why the assertion was reaching for a substring in
 * the first place. So the value moves into a `.ts` the runner CAN import, the component takes it
 * from here, and the test checks the URL that ships rather than a shape that resembles it. Same
 * move as `landing-metadata.ts`, for the same reason.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { compareKey, toCompareParams } from '../compare/compare.ts';
import type { GymDetail } from '../discovery/fixtures/catalogue.ts';
import { EMPTY_QUERY, search } from '../discovery/search.ts';

/**
 * Three, because the teaser is a table a reader takes in at a glance and four columns is where it
 * stops being one. `MAX_COMPARE` is a different number for a different reason - it is the ceiling
 * on what the compare PAGE will hold - and tying them together would make one change the other.
 */
export const TEASER_COUNT = 3;

/**
 * Nearest first. The teaser makes an implicit claim by ordering - "these are the ones near you" -
 * so the sort is part of the meaning rather than a default, and it is stated here once.
 */
export function teaserGyms(): readonly GymDetail[] {
  return search({ ...EMPTY_QUERY, sort: 'distance' }).slice(0, TEASER_COUNT);
}

/** The comparison the teaser's buttons open: exactly the gyms the teaser just showed. */
export function teaserCompareHref(): string {
  return toCompareParams(teaserGyms().map(compareKey));
}
