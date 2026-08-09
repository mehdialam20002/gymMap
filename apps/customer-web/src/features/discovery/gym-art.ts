/**
 * `BR-GYM-01` — what a listing shows where a photograph would go.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE FIXTURES CARRY STOCK PHOTOGRAPHY, AND A BADGE TURNS IT INTO A CLAIM
 *
 * Every fixture has a `photo` pointing at Pexels, and every `photoAlt` is honest about what it is:
 * "barbell floor", "machine floor". Whoever wrote them knew these are not photographs of the gyms
 * they sit beside.
 *
 * On a card that also carries the gym's NAME and a green "Verified" badge, the composite says two
 * things: this is Iron House Strength Club, and a person checked it. Both are false, and the badge
 * is the one part of this product that has to be worth something. The sample banner above the
 * results is a real mitigation and it is not enough - a screenshot of one card outlives the banner
 * it was captured under, which is the same argument that took the invented figures off the owner
 * console.
 *
 * ┌─ THE OWNER ASKED FOR THE PHOTOGRAPHS BACK, AND THAT IS THE DECISION ────────────────────────┐
 * │ The objection above is real and it was raised. The answer is not to revert it away, it is to │
 * │ make the disclosure travel WITH the image: every card that shows a stock cover carries a     │
 * │ `Sample` marker on the media itself, so the screenshot that outlives the page banner still   │
 * │ says what it is. That is the pattern the gym-detail gallery already uses, and it is the one  │
 * │ place this codebase has been comfortable showing these photos all along.                     │
 * │                                                                                             │
 * │ So a listing shows its cover AND says the cover is a sample. `artFor` stays as the ground    │
 * │ for anything with no photo at all, and as the one place to switch back if the owner changes  │
 * │ their mind.                                                                                  │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** The six grounds, declared in `globals.css`. */
const ART = ['gm-art-1', 'gm-art-2', 'gm-art-3', 'gm-art-4', 'gm-art-5', 'gm-art-6'] as const;

/**
 * The ground for one gym, from its id.
 *
 * ┌─ DERIVED FROM THE GYM, NOT FROM ITS POSITION IN A LIST ─────────────────────────────────────┐
 * │ The homepage assigned these by index, which is fine on one page and wrong across a journey:  │
 * │ a gym is third in the featured rail, first in a filtered search and second in a comparison,  │
 * │ so it wore three different colours on the way to being chosen. The artwork's whole job is to │
 * │ make a row scannable, and something that changes identity between screens does the opposite. │
 * │                                                                                              │
 * │ A sum of character codes is enough. It needs to be stable and evenly spread, not             │
 * │ unpredictable - there is nothing to attack here.                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function artFor(gym: { readonly id: string }): string {
  let sum = 0;
  for (let i = 0; i < gym.id.length; i += 1) sum += gym.id.charCodeAt(i);
  return ART[sum % ART.length]!;
}
