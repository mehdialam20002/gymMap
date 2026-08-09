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

export function CompareTable({ gyms }: { readonly gyms: readonly GymDetail[] }) {
  const amenities = amenityMatrix(gyms);
  const keys = gyms.map(compareKey);

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
       * `BP2` — four columns plus a label column does not fit a phone, so the TABLE scrolls
       * inside its own container and the page never does. The first column is sticky, because a
       * row of four ticks with the question scrolled off screen is not a comparison.
       */}
      <div className="gm-compare-scroll mt-stack-md overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-left">
          <caption className="gm-visually-hidden">{t('web.compare.title')}</caption>

          <thead>
            <tr>
              <td className="gm-compare-label align-bottom" />
              {gyms.map((gym) => (
                <th
                  key={gym.id}
                  scope="col"
                  className="w-1/4 border-b border-strong p-inset-sm align-bottom"
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
                    <GymPhoto
                      gym={gym}
                      sizes="(min-width: 1024px) 22vw, 45vw"
                      className="aspect-video rounded-card"
                    />
                    <span className="mt-stack-xs block text-base font-semibold text-content hover:underline">
                      {gym.name}
                    </span>
                  </Link>
                  <span className="mt-stack-2xs block text-sm font-regular text-content-secondary">
                    {gym.locality}, {gym.city}
                  </span>
                  <Link
                    href={toCompareParams(keys.filter((key) => key !== compareKey(gym)))}
                    className="gm-hit-target gm-card-add mt-stack-xs inline-block rounded-control text-sm font-semibold"
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
                  <span className="tabular-nums">{gym.distanceKm.toFixed(1)} km</span>
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
            <tr>
              <th
                scope="colgroup"
                colSpan={gyms.length + 1}
                className="gm-compare-label border-b border-strong pt-inset-lg text-sm font-semibold uppercase tracking-wide text-content-muted"
              >
                {t('web.compare.facilities')}
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
                    className="gm-hit-target inline-block rounded-control bg-brand-solid px-inset-md py-inset-xs text-sm font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover"
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
