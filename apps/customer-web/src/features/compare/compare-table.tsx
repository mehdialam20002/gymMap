/**
 * `SCR-WEB-004` — the comparison itself. `FR-CMP-01` … `FR-CMP-04`.
 *
 * ┌─ A REAL `<table>`, AND IT MATTERS MORE HERE THAN ANYWHERE ELSE ON THE SITE ─────────────────┐
 * │ This page is a grid of numbers whose meaning comes ENTIRELY from which row and which column │
 * │ they sit in. Built from divs, "₹2,499" is announced as "₹2,499" and a screen-reader user is │
 * │ asked to remember the column order across eleven rows. In a table with `<th scope>` on both  │
 * │ axes it is announced as "Iron House Strength Club, From per month, ₹2,499" — the row and     │
 * │ column headers come for free, from markup that is also less code.                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ NOTHING IS CALLED "BEST" ──────────────────────────────────────────────────────────────────┐
 * │ The cheapest and the nearest are marked, because both are facts this page already computed  │
 * │ and a member scanning four columns should not have to. No overall winner, no score, no       │
 * │ "recommended" badge: the platform ranking one paying listing above another, on the screen    │
 * │ where the decision is made, is a different product from a marketplace — and `BR-GYM-*` gives │
 * │ us no basis for the claim.                                                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Link from 'next/link';

import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { formatMinor } from '../discovery/search.ts';
import { GymPhoto } from '../discovery/gym-photo.tsx';
import type { GymDetail } from '../discovery/fixtures/catalogue.ts';
import { amenityMatrix, compareKey, toCompareParams } from './compare.ts';

/**
 * The static half of the table's classes, kept out of the interpolation on purpose —
 * `shell.spec.ts` §"no arbitrary utility hides inside an interpolated template literal". Tailwind
 * finds candidates by scanning source TEXT and does not reliably see them in a template that also
 * carries a `${…}`; a plain string constant concatenated at the call site is extracted, and the
 * concatenation costs nothing because extraction never runs the code.
 */
const TABLE_CLASS = 'w-full table-fixed border-collapse text-left';

/**
 * ┌─ THE PINNED LABEL COLUMN HAS TO BE BOUNDED, OR IT EATS EVERY GYM COLUMN ────────────────────┐
 * │ The table was `min-w-[48rem]` with `w-1/4` on each gym column and NO declared width on the   │
 * │ sticky label, which left the label as the only auto column - so it absorbed the entire       │
 * │ residual. Measured on the built page in Chromium: label 576px with one gym, 384px with two,  │
 * │ inside a scroller whose clientWidth is 284px at 320. Every `thead th` and every `tbody td`    │
 * │ measured 0px of visible width at rest. The comparison showed no gym data at all on a phone,   │
 * │ in the one- and two-gym cases a shared link usually arrives at.                               │
 * │                                                                                             │
 * │ It also clipped ITSELF: a sticky cell can shift at most (row width - its own width), so a    │
 * │ 384px label in a 768px table had 384px of travel against a 484px scroll range, and at the    │
 * │ end of the scroll "From, per month" rendered as literally "th".                               │
 * │                                                                                             │
 * │ `table-fixed` plus a declared label width is the whole fix, and fixed layout is the right    │
 * │ layout for this table anyway: the first row sets the columns, a declared width is honoured   │
 * │ exactly, and the remainder is divided EQUALLY between the auto columns - which is the        │
 * │ guarantee a comparison wants. Four columns of the same width, whatever is in them.           │
 * │                                                                                             │
 * │ The floor then has to be the sum of what the table holds, not one number for every set:      │
 * │ 8.5rem of label plus 9rem per gym. Measured in Chromium on a standalone replica of this box  │
 * │ model, because a rebuild of the app was not mine to run:                                      │
 * │                                                                                             │
 * │   gyms  min-width       at 320 (284px scroller)          label at full scroll                 │
 * │   1     17.5rem 280px   no sideways scroll at all, 148px  136 of 136 visible                  │
 * │   2     26.5rem 424px   144px column, 140px to scroll     136 of 136 visible                  │
 * │   3     35.5rem 568px   144px column, 284px to scroll     136 of 136 visible                  │
 * │   4     44.5rem 712px   144px column, 428px to scroll     136 of 136 visible                  │
 * │                                                                                             │
 * │ The flat 48rem made the ONE-gym case scroll 484px sideways to show a single column; it now   │
 * │ fits a 320px phone with nothing to scroll. The label is 136px in every row of that table, so │
 * │ its travel always exceeds the scroll range and it can no longer clip itself.                  │
 * │                                                                                             │
 * │ `sizes` travels with the plan for the same reason. The column is no longer a quarter of the  │
 * │ table, so one string cannot describe it: at 1024 a lone gym's cover is 806px of a 942px       │
 * │ scroller (79vw) and a four-gym cover is 201px (20vw). One `sizes` for both serves a blurry    │
 * │ candidate to one of them. `BP4` — 1024 is the only breakpoint named here.                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const COLUMN_PLAN = [
  { minWidth: 'min-w-[17.5rem]', sizes: '80vw' },
  { minWidth: 'min-w-[26.5rem]', sizes: '(min-width: 1024px) 40vw, 45vw' },
  { minWidth: 'min-w-[35.5rem]', sizes: '(min-width: 1024px) 27vw, 45vw' },
  { minWidth: 'min-w-[44.5rem]', sizes: '(min-width: 1024px) 22vw, 45vw' },
] as const;

export function CompareTable({ gyms }: { readonly gyms: readonly GymDetail[] }) {
  const amenities = amenityMatrix(gyms);
  const keys = gyms.map(compareKey);
  // `parseCompare` caps the set at `MAX_COMPARE`, so the fallback is unreachable today. It is the
  // four-gym plan on purpose: a table wider than its content scrolls, one narrower overlaps.
  const plan = COLUMN_PLAN[gyms.length - 1] ?? COLUMN_PLAN[3];

  // Computed once and marked, not ranked. Ties mark every gym that ties, because "lowest price
  // here" is a statement about the price and two gyms can both be lowest.
  const lowest = gyms.reduce<bigint | null>(
    (best, gym) => (best === null || gym.fromPriceMinor < best ? gym.fromPriceMinor : best),
    null,
  );
  const closest = gyms.reduce<number | null>(
    (best, gym) => (best === null || gym.distanceKm < best ? gym.distanceKm : best),
    null,
  );

  return (
    <>
      <p className="mt-stack-md max-w-prose text-sm text-content-muted">
        {t('web.compare.legend')}
      </p>

      {/*
       * The scroller hid 428px of table at 320 and said so nowhere: no scrollbar at rest (the
       * platform's overlay scrollbar leaves `offsetWidth - clientWidth` at 0), no edge fade, and
       * nothing in the accessibility tree. This sentence is the affordance a sighted member gets.
       *
       * Only when there is something to scroll. A single gym now fits a 320px phone exactly - 280
       * of 284 - so "scroll sideways" would be a page telling a member to do something that does
       * nothing. It is honest for two gyms up to roughly 460px of viewport and for four up to
       * `md`; between there and `md` it can name a scroll that is not there, which needs the
       * scroller's own width to decide and that is a client measurement this Server Component
       * does not get to make.
       */}
      {gyms.length > 1 && (
        <p className="mt-stack-sm text-sm text-content-muted md:hidden">
          {t('web.compare.table.scrollHint')}
        </p>
      )}

      {/*
       * `BP2` — four columns plus a label column does not fit a phone, so the TABLE scrolls
       * inside its own container and the page never does. The first column is sticky, because a
       * row of four ticks with the question scrolled off screen is not a comparison.
       *
       * `AX2` — `tabIndex={0}` because a scroll container that only a thumb or a trackpad can
       * move is unreachable by keyboard, and 428px of this table was behind exactly that. A
       * focusable scroller needs a role and a name or it is an unlabelled tab stop, so it is a
       * named `region`: the arrow keys then scroll it and a screen reader announces what took
       * focus instead of "group".
       */}
      <div
        className="gm-compare-scroll mt-stack-md overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label={t('web.compare.table.region')}
      >
        <table className={`${TABLE_CLASS} ${plan.minWidth}`}>
          <caption className="gm-visually-hidden">{t('web.compare.title')}</caption>

          <thead>
            <tr>
              {/*
               * The one declared width in the table, and under `table-fixed` it is the only one
               * that has to be: this cell is the first row's first cell, so it fixes the label
               * column at 8.5rem everywhere, and the gym columns split what is left equally.
               * 8.5rem holds "From, per month" and "Powerlifting platform" on two lines at 14px
               * with `p-inset-sm` either side, and leaves 148px of real gym data on a 320 phone.
               */}
              <td className="gm-compare-label w-[8.5rem] align-bottom" />
              {gyms.map((gym) => (
                <th
                  key={gym.id}
                  scope="col"
                  /* No `w-1/4`: it was a quarter of the TABLE, not a quarter of what remained
                   * after the label, so four of them claimed the whole width and left the label
                   * to take its share out of the gym columns. `table-fixed` divides the
                   * remainder equally without being told a fraction. */
                  className="border-b border-strong p-inset-sm align-bottom"
                >
                  <Link
                    href={`/gyms/${gym.citySlug}/${gym.slug}`}
                    /*
                     * No `overflow-hidden rounded-card` here any more, and it was not cosmetic:
                     * a rounded clip applies at all four corners, the gym's name sits flush to the
                     * left edge, and its FIRST GLYPH was being eaten by the corner curve - "Iron
                     * House" rendered as "ron House" in every column. The clip existed to round
                     * the photograph; the photograph is gone and the drawn ground rounds itself.
                     */
                    className="block"
                  >
                    {/* Cover plus its own disclosure - see `gym-photo.tsx`. */}
                    <GymPhoto gym={gym} sizes={plan.sizes} className="aspect-video rounded-card" />
                    <span className="mt-stack-xs block text-base font-semibold text-content hover:underline">
                      {gym.name}
                    </span>
                  </Link>
                  <span className="mt-stack-2xs block text-sm font-regular text-content-secondary">
                    {gym.locality}, {gym.city}
                  </span>
                  <Link
                    href={toCompareParams(keys.filter((key) => key !== compareKey(gym)))}
                    /*
                     * Neither `inline-block` nor `gm-hit-target`, and both were actively harmful
                     * once `.gm-card-add` became a real control.
                     *
                     * `inline-block` is a utility, so it beat the component's `display: inline-flex`
                     * - which took `align-items: center` with it, and the label sat jammed against
                     * the top of a 44px pill with 22px of empty space under it. `gm-hit-target`
                     * grows an `::after` outward to reach 44px, which the class no longer needs
                     * because it has 44px of real height, and which an ancestor's `overflow: hidden`
                     * would clip anyway.
                     */
                    className="gm-card-add mt-stack-xs rounded-control text-sm font-semibold"
                  >
                    {t('web.compare.remove')}
                    <span className="gm-visually-hidden">: {gym.name}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            <Row label="web.compare.row.price">
              {gyms.map((gym) => (
                <Cell key={gym.id}>
                  <span className="font-semibold tabular-nums text-content">
                    {formatMinor(gym.fromPriceMinor)}
                  </span>
                  {lowest !== null && gym.fromPriceMinor === lowest && (
                    <Mark label={t('web.compare.cheapest')} />
                  )}
                </Cell>
              ))}
            </Row>

            <Row label="web.compare.row.distance">
              {gyms.map((gym) => (
                <Cell key={gym.id}>
                  <span className="tabular-nums">
                    {t('web.gym.distanceFromCentre').replace('{km}', gym.distanceKm.toFixed(1))}
                  </span>
                  {closest !== null && gym.distanceKm === closest && (
                    <Mark label={t('web.compare.nearest')} />
                  )}
                </Cell>
              ))}
            </Row>

            <Row label="web.compare.row.rating">
              {gyms.map((gym) => (
                <Cell key={gym.id}>
                  {/* `BR-REV-01` once more: an unrated gym is new, not bad. No zero, no dash. */}
                  {gym.rating === null ? (
                    <span className="text-content-muted">{t('web.gym.facts.unrated')}</span>
                  ) : (
                    <>
                      <span className="font-semibold tabular-nums text-content">
                        {gym.rating.toFixed(1)}
                      </span>{' '}
                      <span className="text-content-muted">
                        ({gym.reviewCount.toLocaleString('en-IN')})
                      </span>
                    </>
                  )}
                </Cell>
              ))}
            </Row>

            <Row label="web.compare.row.activities">
              {gyms.map((gym) => (
                <Cell key={gym.id}>{gym.categories.join(' · ')}</Cell>
              ))}
            </Row>

            <Row label="web.compare.row.hours">
              {gyms.map((gym) => (
                <Cell key={gym.id}>{gym.openingHours}</Cell>
              ))}
            </Row>

            <Row label="web.compare.row.plans">
              {gyms.map((gym) => (
                <Cell key={gym.id}>
                  <ul className="flex flex-col gap-stack-2xs">
                    {gym.plans.map((plan) => (
                      <li key={plan.id} className="flex flex-wrap justify-between gap-inline-xs">
                        <span>{plan.name}</span>
                        <span className="font-medium tabular-nums text-content">
                          {formatMinor(plan.priceMinor)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Cell>
              ))}
            </Row>

            {/*
             * The facilities matrix. A section header row rather than a second table: the columns
             * are the same gyms, and splitting the table would make a screen reader re-announce
             * four column headers to say the same thing.
             */}
            {/*
             * ┌─ A FULL-WIDTH CELL CANNOT BE THE STICKY THING ────────────────────────────────┐
             * │ This `th` carried `.gm-compare-label`, and that class is `position: sticky;   │
             * │ left: 0`. A sticky box is shifted but never leaves its containing block, so a │
             * │ cell that spans every column has width EQUAL to the row and therefore zero    │
             * │ travel: it cannot stick at all. "Facilities" scrolled off the left with the   │
             * │ table and was fully off screen at maximum scroll from 320 to 768, which is    │
             * │ every phone, while the row labels underneath it stayed pinned.                 │
             * │                                                                              │
             * │ The word is what has to stay, not the cell. As a `sticky left-0` child it has │
             * │ the cell's full width as travel and holds its position across the whole       │
             * │ scroll range - measured 93 of 93px visible at maximum scroll at 320 with one, │
             * │ two, three and four gyms.                                                     │
             * │                                                                              │
             * │ The cell drops `.gm-compare-label` with it, and wants to: that class also     │
             * │ paints an opaque ground and a right-hand hairline, which on a full-span cell  │
             * │ drew a vertical rule at the far edge of the table. Nothing scrolls under this │
             * │ row, so the word needs no ground of its own. The padding rides on the span so │
             * │ it survives being pinned and stays aligned with the row labels below.          │
             * └──────────────────────────────────────────────────────────────────────────────┘
             */}
            <tr>
              <th
                scope="colgroup"
                colSpan={gyms.length + 1}
                className="border-b border-strong pt-inset-lg text-sm font-semibold uppercase tracking-wide text-content-muted"
              >
                <span className="sticky left-0 inline-block px-inset-sm">
                  {t('web.compare.facilities')}
                </span>
              </th>
            </tr>

            {amenities.map((amenity) => (
              <Row key={amenity} rawLabel={amenity}>
                {gyms.map((gym) => (
                  <Cell key={gym.id}>
                    <Presence present={gym.amenities.includes(amenity)} />
                  </Cell>
                ))}
              </Row>
            ))}

            <Row label="web.compare.row.verified">
              {gyms.map((gym) => (
                <Cell key={gym.id}>
                  <Presence present={gym.verified} />
                </Cell>
              ))}
            </Row>

            <tr>
              <td className="gm-compare-label" />
              {gyms.map((gym) => (
                <td key={gym.id} className="border-b border-subtle p-inset-sm align-top">
                  <Link
                    href={`/gyms/${gym.citySlug}/${gym.slug}`}
                    data-on-solid="true"
                    className="inline-flex min-h-[2.75rem] items-center rounded-control bg-brand-solid px-inset-md text-sm font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover"
                  >
                    {t('web.compare.view')}
                    <span className="gm-visually-hidden">: {gym.name}</span>
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({
  label,
  rawLabel,
  children,
}: {
  readonly label?: Parameters<typeof t>[0];
  /** An amenity name, which is data rather than interface copy and so is not a message key. */
  readonly rawLabel?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="gm-compare-label border-b border-subtle p-inset-sm align-top text-sm font-medium text-content-secondary"
      >
        {label === undefined ? rawLabel : t(label)}
      </th>
      {children}
    </tr>
  );
}

function Cell({ children }: { readonly children: React.ReactNode }) {
  return (
    <td className="border-b border-subtle p-inset-sm align-top text-base text-content-secondary">
      {children}
    </td>
  );
}

/** A fact marked because the page already knew it — never a ranking. */
function Mark({ label }: { readonly label: string }) {
  return (
    /*
     * Not the SUCCESS role. Green means "the thing you did worked"; this is a fact the page
     * computed about three numbers on screen, and a green pill beside a price reads as a discount.
     * The home page's compare band reached the same conclusion - `.gm-best` there, this here.
     */
    <span className="gm-best-pill">{label}</span>
  );
}

/**
 * Present or absent, said twice.
 *
 * The glyph is `aria-hidden` and the word is visually hidden, so a sighted member reads a tick
 * and a screen reader hears "Yes" — neither of them is asked to infer meaning from a shape or a
 * colour, which is the whole of `AX8`.
 */
function Presence({ present }: { readonly present: boolean }) {
  const Glyph = present ? icon.has : icon.hasNot;
  return (
    /*
     * The tick keeps the success role and the cross does not, which is the one place green is
     * right on this page: "the gym lists this facility" is a yes, not a ranking.
     */
    <span className={present ? 'text-content-success' : 'text-content-muted'}>
      <Glyph aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
      <span className="gm-visually-hidden">
        {present ? t('web.compare.has') : t('web.compare.hasNot')}
      </span>
    </span>
  );
}
