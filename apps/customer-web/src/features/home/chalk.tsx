/**
 * `SCR-WEB-001`'s sections, in "Chalk & Iron".
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * EVERY FIGURE ON THIS PAGE COMES FROM THE CATALOGUE
 *
 * The reference hard-codes its data: six gyms with invented ratings, review counts and distances,
 * and a compare table with three columns typed out by hand. That is the right way to build a
 * design mockup and the wrong way to build a page, because the moment the two disagree the design
 * is the one people believe.
 *
 * So every card, every price, every rating and the whole comparison read `CATALOGUE` and
 * `search()` - the same calls `/search` and `/compare` make. A price here cannot differ from the
 * price at checkout, and an unrated gym says so rather than showing a number, because the data is
 * the same data.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/*
 * ┌─ `gm-reveal` ON EVERY SECTION WRAP, WHICH IS WHERE IT BELONGS ──────────────────────────────┐
 * │ Each band rises 1.25rem as it enters, driven by `animation-timeline: view()` - no listener,  │
 * │ no observer, no state, and `§4.5` bans a scroll handler outright. The rule was already in    │
 * │ the stylesheet and correctly built: an ENTRY-relative range so the last band before the      │
 * │ footer finishes rather than sitting half-faded, an `@supports` guard so Safari and Firefox   │
 * │ get the finished page immediately, and a print block so paper does not come out blank.       │
 * │                                                                                             │
 * │ It had gone dead. The identity rebuild replaced its last user and the guard in               │
 * │ `hero-contrast.spec.ts` failed the build on the same run - which is the whole reason that    │
 * │ guard exists, and it is a better outcome than deleting a correct rule to make a lint quiet.  │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Link from 'next/link';

import { t, type MessageKey } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { MAX_COMPARE, compareKey } from '../compare/compare.ts';
import { GymPhoto } from '../discovery/gym-photo.tsx';
import { railToggleHref } from '../compare/compare-rail.tsx';
import { CATALOGUE, type GymDetail } from '../discovery/fixtures/catalogue.ts';
import { EMPTY_QUERY, formatMinor, search } from '../discovery/search.ts';
import { HOME_COMPARE_BASE, teaserCompareHref, teaserGyms } from './teaser.ts';
import { checkoutHref } from '../checkout/quote.ts';

/*
 * `ART` lived here and is gone: every surface that used it now shows a photograph, and the six
 * grounds survive in `gym-art.ts` as the fallback for a listing with no cover. One home for the
 * decision, which is where it should have been from the start.
 */

/**
 * ┌─ THE EYEBROW IS OPTIONAL, AND MOST SECTIONS DID NOT EARN ONE ──────────────────────────────┐
 * │ Eleven of them ran down this page, and the count was the smaller half of the problem. Read  │
 * │ against the heading each sat above, most were saying nothing:                               │
 * │                                                                                             │
 * │     "Discover near you"      over  "Verified gyms near you"       the same words             │
 * │     "Explore by city"        over  "Where we have listings"       the same idea              │
 * │     "Find your fit"          over  "What are you training for?"   the same question          │
 * │     "Smarter decisions"      over  the comparison teaser          a mood, not a fact         │
 * │     "Simple by design"       over  "How GYM MAP works"             a claim about ourselves    │
 * │     "Membership marketplace" over  "Plans from verified gyms"     positioning                │
 * │                                                                                             │
 * │ A structural device has to encode something true about the content or it is decoration, and  │
 * │ a small-caps line that repeats the heading underneath it is just a second heading. The three │
 * │ mood phrases are the `ai-tells.md` filler case exactly.                                      │
 * │                                                                                             │
 * │ The rule now: an eyebrow states the section's KIND - who it is for, or what form it takes -  │
 * │ and never restates the heading. Five survive it. Two mark AUDIENCE, which a reader genuinely │
 * │ cannot get from the heading and which this page switches between more than once ("For gym    │
 * │ owners", "The member experience"); one marks FORM ("Questions"); and two name the product    │
 * │ RULE the section exists to demonstrate ("What we guarantee", "Earned reviews"), where the    │
 * │ headings below them are deliberately hedged and the eyebrow is the unhedged version.         │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */
function SectionHead({
  eyebrow,
  title,
  lede,
  action,
}: {
  readonly eyebrow?: MessageKey;
  readonly title: MessageKey;
  readonly lede?: MessageKey;
  readonly action?: { readonly href: string; readonly label: MessageKey };
}) {
  return (
    <div className="gm-sec-head">
      <div>
        {eyebrow ? <p className="gm-eyebrow-k">{t(eyebrow)}</p> : null}
        <h2 className="gm-h2">{t(title)}</h2>
        {lede ? <p className="gm-lede">{t(lede)}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className="gm-btn gm-btn-ghost gm-btn-sm">
          {t(action.label)} <i aria-hidden="true">→</i>
        </Link>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Verified gyms
// ─────────────────────────────────────────────────────────────────────────────

export function GymRail({ selected = [] }: { readonly selected?: readonly GymDetail[] }) {
  const gyms = search({ ...EMPTY_QUERY, sort: 'distance' }).slice(0, 6);
  const chosen = new Set(selected.map(compareKey));

  return (
    <section className="gm-sec" id="gyms">
      <div className="gm-wrap gm-reveal">
        <SectionHead
          title="web.home.featured.title"
          action={{ href: '/search', label: 'web.home.featured.seeAll' }}
        />

        <p className="gm-note">
          <b>{t('web.home.fixture.label')}</b> {t('web.home.fixture.body')}
        </p>

        <ul className="gm-cards">
          {gyms.map((gym) => (
            <li key={gym.id} className="gm-card-k" data-compared={chosen.has(compareKey(gym))}>
              <div className="gm-card-media">
                {/*
                 * The gym's own cover, with its "Sample photo" marker attached. The badge sits
                 * top-left and the price bottom-right, so the marker's bottom-left corner is the
                 * one place on this media that nothing else has claimed.
                 */}
                <GymPhoto
                  gym={gym}
                  sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                  className="gm-card-art"
                />

                {/*
                 * `BR-GYM-01` on the card. Every gym in the fixture set is approved, so every
                 * badge here is earned - and the day one is not, the flag is on the record rather
                 * than on the component.
                 */}
                {/* `BR-GYM-01`: the badge states that a human approved this listing, so it reads
                    the field that records the approval. Unconditional while the type was the
                    literal `true`; the type is `boolean` now and the compiler keeps it honest. */}
                {gym.verified && (
                  <span className="gm-card-badge">
                    <b aria-hidden="true">✓</b> {t('web.gym.facts.verified')}
                  </span>
                )}

                <p className="gm-card-price">
                  <strong>{formatMinor(gym.fromPriceMinor)}</strong>
                  <span>{t('web.home.plans.perMonthFrom')}</span>
                </p>
              </div>

              <div className="gm-card-body">
                <h3 className="gm-h3">{gym.name}</h3>

                <p className="gm-card-meta">
                  <span>
                    {gym.locality}, {gym.city}
                  </span>
                  <span>
                    {/* Through the catalogue, like every other surface. A bare "1.2 km" beside a
                        locality reads as "from you", and the unit was a hard-coded string. */}
                    <b>
                      {t('web.gym.distanceFromCentre').replace('{km}', gym.distanceKm.toFixed(1))}
                    </b>
                  </span>
                  {/*
                   * `BR-REV-01`. An unrated gym reads as a new listing, never as a zero - a zero
                   * is a claim that members rated it badly, which is the opposite of the truth.
                   */}
                  <span>
                    {gym.rating === null ? (
                      t('web.gym.facts.unrated')
                    ) : (
                      <>
                        {/*
                         * `toLocaleString('en-IN')` and the singular, like the card and the gym
                         * page. This printed `String(count)` with a fixed plural, so a gym with
                         * 1,204 reviews read "1204 reviews" here and "1,204 reviews" on its card -
                         * and a gym with one would have read "1 reviews". The grouping matters
                         * more than it looks on an India-facing surface, where the separator
                         * positions are not the ones a naive format produces.
                         */}
                        <b>{gym.rating.toFixed(1)}</b> · {gym.reviewCount.toLocaleString('en-IN')}{' '}
                        {t(gym.reviewCount === 1 ? 'web.gym.reviews.one' : 'web.gym.reviews.many')}
                      </>
                    )}
                  </span>
                </p>

                <ul className="gm-tags">
                  {gym.amenities.slice(0, 3).map((amenity) => (
                    <li key={amenity} className="gm-tag">
                      {amenity}
                    </li>
                  ))}
                  {/* The catalogue's marker, not a bare "+3". The card two sections below shows
                      "+3 more" from `web.gym.amenitiesMore`; this printed "+3" from a literal, so
                      the same gym's facility list ended two different ways on one page - and the
                      "+" was a user-facing string outside the catalogue. */}
                  {gym.amenities.length > 3 ? (
                    <li className="gm-tag">
                      {t('web.gym.amenitiesMore').replace(
                        '{count}',
                        String(gym.amenities.length - 3),
                      )}
                    </li>
                  ) : null}
                </ul>

                <div className="gm-card-foot">
                  {/*
                   * "Add to compare" is a LINK, not a button with state. The selection lives in
                   * the URL (`FR-CMP-01`), so this href names the NEXT selection and the rail at
                   * the foot of the page renders the current one. It works before hydration, the
                   * back button undoes it, and a shared link opens with the same gyms.
                   *
                   * `aria-pressed` would be wrong for the same reason `role="switch"` is wrong on
                   * the theme control: this is a link that navigates, not a control that holds
                   * state, so the label changes instead.
                   */}
                  {/*
                   * At the limit the ADD becomes a statement, not a link.
                   *
                   * `toCompareParams` caps the set at `MAX_COMPARE`, so with four already chosen
                   * the "add" href resolved to the URL the reader was already on: a control that
                   * looked live, announced itself as an add, and did nothing. Saying the set is
                   * full is the honest version, and it is a `<span>` so it leaves the tab order.
                   */}
                  {!chosen.has(compareKey(gym)) && selected.length >= MAX_COMPARE ? (
                    <span className="gm-card-add text-sm font-semibold opacity-60">
                      {t('web.compare.rail.full').replace('{max}', String(MAX_COMPARE))}
                    </span>
                  ) : (
                    <Link
                      /* The base is stated now rather than defaulted inside the rail - ADR-0050,
                       * and `HOME_COMPARE_BASE` is `/` plus this section's own `#gyms`. */
                      href={railToggleHref(selected, gym, HOME_COMPARE_BASE)}
                      className="gm-card-add text-sm font-semibold transition-colors duration-fast ease-standard"
                    >
                      {t(
                        chosen.has(compareKey(gym))
                          ? 'web.home.compare.remove'
                          : 'web.home.compare.add',
                      )}
                      {/* Six of these on the rail, one per card, and the name on the card is not a
                          link - so without this they are six controls called "Add to compare". */}
                      <span className="gm-visually-hidden">: {gym.name}</span>
                    </Link>
                  )}
                  {/*
                   * The gym's name, for anybody who cannot see which card this is.
                   *
                   * The rail renders six cards, and the name on each is a plain `<h3>` rather than
                   * a link - so listing the page's links gave six controls called "View" and six
                   * called "Add to compare", twelve destinations and not one of them identified.
                   * The visible label stays short because the card supplies the context visually;
                   * the hidden half supplies it to everything else. `gym-card.tsx` already did
                   * this for its own compare control, which is where the pattern comes from.
                   */}
                  <Link
                    href={`/gyms/${gym.citySlug}/${gym.slug}`}
                    className="gm-btn gm-btn-ghost gm-btn-sm"
                  >
                    {t('web.home.card.view')}
                    <span className="gm-visually-hidden">: {gym.name}</span>
                    <i aria-hidden="true">→</i>
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The four promises, in full
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Title shared with the hero's marquee, body written long.
 *
 * ┌─ THIS BAND EXISTS BECAUSE THE MARQUEE CANNOT BE THE ONLY COPY ──────────────────────────────┐
 * │ The marquee is `aria-hidden` and unpausable, which is right for a decorative loop and wrong  │
 * │ for the four claims that are the reason to use this marketplace. For one commit they were    │
 * │ ONLY in the marquee: a sighted reader got them four words at a time, and a screen-reader     │
 * │ user got nothing at all. `shell.spec.ts` was still green, because it asserted the strings    │
 * │ existed in the catalogue rather than that anybody could read them.                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Each row names the rule it is a statement of. They are the four the codebase actually enforces,
 * so none of this is a claim the product would have to be trusted on.
 */
const PROMISES = [
  {
    glyph: 'verified',
    title: 'web.home.trust.verified.title',
    body: 'web.home.value.verified.body',
  },
  { glyph: 'pricing', title: 'web.home.trust.pricing.title', body: 'web.home.value.pricing.body' },
  { glyph: 'reviews', title: 'web.home.trust.reviews.title', body: 'web.home.value.reviews.body' },
  { glyph: 'secure', title: 'web.home.trust.payments.title', body: 'web.home.value.payments.body' },
] as const satisfies readonly { glyph: keyof typeof icon; title: MessageKey; body: MessageKey }[];

export function Promises() {
  return (
    <section className="gm-sec gm-sec-paper" id="promises">
      <div className="gm-wrap gm-reveal">
        <SectionHead
          eyebrow="web.home.eyebrow.promises"
          title="web.home.promises.title"
          lede="web.home.promises.body"
        />

        {/*
         * A `<ul>`, because it is four peers with no order between them. The heading level is `h3`
         * under the section's `h2`, so the outline a screen reader builds matches the picture.
         */}
        <ul className="gm-promises">
          {PROMISES.map((promise) => {
            const Glyph = icon[promise.glyph];
            return (
              <li key={promise.title} className="gm-promise">
                <span aria-hidden="true" className="gm-promise-mark">
                  <Glyph className="h-[1.0625rem] w-[1.0625rem]" />
                </span>
                <h3>{t(promise.title)}</h3>
                <p>{t(promise.body)}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plans
// ─────────────────────────────────────────────────────────────────────────────

export function PlanRow() {
  const cheapest = search({ ...EMPTY_QUERY, sort: 'price-asc' }).slice(0, 3);

  return (
    <section className="gm-sec gm-sec-paper" id="plans">
      <div className="gm-wrap gm-reveal">
        <SectionHead
          title="web.home.plans.title"
          lede="web.home.plans.body"
          action={{ href: '/search', label: 'web.home.plans.seeAll' }}
        />

        <div className="gm-plans">
          {cheapest.map((gym) => {
            const plan = gym.plans[0];
            if (!plan) return null;
            return (
              <article key={plan.id} className="gm-plan">
                <span className="gm-plan-where">
                  {gym.name} · {gym.city}
                </span>
                <p className="mb-[0.25rem] mt-[1rem] text-[15px] font-semibold">{plan.name}</p>
                <p className="gm-plan-amt">{formatMinor(plan.priceMinor)}</p>
                <p className="gm-plan-sub">
                  {t('web.home.plans.perMonth')} · {String(plan.durationDays)}{' '}
                  {t('web.home.plans.days')}
                </p>
                {/*
                 * Three, and then a count of what is not shown.
                 *
                 * This truncated silently: a gym with six facilities showed three, and the same
                 * gym's card two sections up showed three plus "+3 more". Same page, same gym, two
                 * different facility lists, and only one of them admits it is a list. A truncation
                 * with no marker is not a summary - it is a shorter fact.
                 */}
                <ul className="gm-tags my-[18px]">
                  {gym.amenities.slice(0, 3).map((amenity) => (
                    <li key={amenity} className="gm-tag">
                      {amenity}
                    </li>
                  ))}
                  {gym.amenities.length > 3 && (
                    <li className="gm-tag">
                      {t('web.gym.amenitiesMore').replace(
                        '{count}',
                        String(gym.amenities.length - 3),
                      )}
                    </li>
                  )}
                </ul>
                <Link href={checkoutHref(gym, plan)} className="gm-btn mt-auto w-full">
                  {t('web.home.plans.view')}
                  {/* Which plan, at which gym. Three identical buttons otherwise. */}
                  <span className="gm-visually-hidden">
                    : {plan.name}, {gym.name}
                  </span>
                  <i aria-hidden="true">→</i>
                </Link>
              </article>
            );
          })}

          <article className="gm-plan gm-plan-alt">
            <span className="gm-plan-where">{t('web.home.plans.compareTitle')}</span>
            <p className="mb-[0.25rem] mt-[1rem] text-[15px] font-semibold">
              {t('web.home.compareTeaser.title')}
            </p>
            <p className="gm-plan-sub">{t('web.home.plans.compareBody')}</p>
            <Link href={teaserCompareHref()} className="gm-btn mt-auto w-full">
              {t('web.home.plans.compareCta')} <i aria-hidden="true">→</i>
            </Link>
          </article>
        </div>

        <p className="gm-smallprint">{t('web.home.plans.noDiscountNote')}</p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compare
// ─────────────────────────────────────────────────────────────────────────────

export function CompareBand() {
  const gyms = teaserGyms();
  if (gyms.length === 0) return null;

  /**
   * Each row knows how to read a gym, and which cell wins.
   *
   * The mark is computed rather than marked up, so the mint can never sit on the wrong column
   * after an edit — and `AX8` means it is never colour alone: the cell also carries a visually
   * hidden word.
   *
   * That word names the FACT, never a verdict. "Lowest price shown" is arithmetic about three
   * numbers on screen; "best" would be the platform ranking one listing above another on the page
   * where the decision is made, which `BR-GYM-*` gives no basis for. `compare.spec.ts` enforces
   * it across the namespace, and it caught this exact wording.
   */
  const rows = [
    {
      mark: 'web.compare.markLowest' as MessageKey,
      label: 'web.home.compareTeaser.rowPrice' as MessageKey,
      cell: (gym: (typeof gyms)[number]) => formatMinor(gym.fromPriceMinor),
      best: (gym: (typeof gyms)[number]) =>
        gym.fromPriceMinor ===
        gyms.reduce((a, b) => (a.fromPriceMinor < b.fromPriceMinor ? a : b)).fromPriceMinor,
    },
    {
      mark: 'web.compare.markNearest' as MessageKey,
      label: 'web.home.compareTeaser.rowDistance' as MessageKey,
      cell: (gym: (typeof gyms)[number]) =>
        t('web.gym.distanceFromCentre').replace('{km}', gym.distanceKm.toFixed(1)),
      best: (gym: (typeof gyms)[number]) =>
        gym.distanceKm === Math.min(...gyms.map((g) => g.distanceKm)),
    },
    {
      mark: 'web.compare.markRated' as MessageKey,
      label: 'web.home.compareTeaser.rowRating' as MessageKey,
      cell: (gym: (typeof gyms)[number]) =>
        gym.rating === null ? t('web.gym.facts.unrated') : gym.rating.toFixed(1),
      /*
       * The unrated are EXCLUDED from the maximum, not coerced into it.
       *
       * `g.rating ?? 0` was the first version and `home-sections.spec.ts` rejected it: it is the
       * literal statement that a gym nobody has reviewed scored zero, which is `BR-REV-01`'s whole
       * objection. It happens to mark the right cell today - `Math.max` ignores a zero when any
       * real rating exists - so it is the kind of wrong that survives review and then decides a
       * sort order six months later.
       *
       * With three unrated gyms nothing is marked, which is correct: there is no highest rating
       * among no ratings.
       */
      best: (gym: (typeof gyms)[number]) => {
        const rated = gyms.map((g) => g.rating).filter((r) => r !== null);
        return rated.length > 0 && gym.rating !== null && gym.rating === Math.max(...rated);
      },
    },
  ];

  return (
    <section className="gm-sec" id="compare">
      <div className="gm-wrap gm-cmp gm-reveal">
        <div>
          <h2 className="gm-h2">{t('web.home.compareTeaser.title')}</h2>
          <p className="gm-lede">{t('web.home.compareTeaser.body')}</p>
          <p className="mt-[26px]">
            <Link href={teaserCompareHref()} className="gm-btn gm-btn-amber gm-btn-lg">
              {t('web.home.compareTeaser.cta')} <i aria-hidden="true">→</i>
            </Link>
          </p>
        </div>

        {/*
         * ┌─ THE LABEL COLUMN STAYS PUT, THE GYM COLUMNS SCROLL ───────────────────────────────┐
         * │ `DesignSystem.md` §11.4 do-not row 30, `NFR-USE-07`, `BP2`. The container already   │
         * │ scrolled - `overflow-x-auto` on the box, `min-w-[30rem]` on the table - and the     │
         * │ labels went with it, which is the half of that row that was missing. Measured in    │
         * │ Chromium on the served build, at full scroll, with the three teaser gyms:           │
         * │                                                                                    │
         * │   viewport   scroller   travel   label width   label visible at the end             │
         * │   320        282px      198px    129px         0 of 129                             │
         * │   360        322px      158px    129px         0 of 129                             │
         * │   390        352px      128px    129px         2 of 129                             │
         * │   414        376px      104px    129px         25 of 129                            │
         * │                                                                                    │
         * │ So on a phone the reader arrives at the far end holding "₹2,499 / 1.2 km / 4.6" in  │
         * │ three rows and no statement anywhere of which is which. `compare-table.tsx` solved  │
         * │ this on `/compare` and this is the same class doing the same job.                   │
         * │                                                                                    │
         * │ The HEAD's corner cell takes it too, and that is not symmetry for its own sake: the │
         * │ labels are pinned in all three body rows, so without it the gym NAMES slide through │
         * │ the same 129px of column with nothing over them and the header is the one row that  │
         * │ visibly comes apart.                                                                │
         * │                                                                                    │
         * │ The ground is named here rather than taken from the class. A sticky cell must be    │
         * │ opaque or it shows the cells sliding under it, and `.gm-compare-label` paints       │
         * │ `surface-default` - correct on `/compare`, where the page itself is that ground.    │
         * │ Inside `.gm-table-box` the body sits on `surface-raised` and the head row on        │
         * │ `surface-overlay`, so the class's own colour would pin a mismatched stripe down the │
         * │ left of the table. Opaque, in the colour the cell is actually standing on.          │
         * │                                                                                    │
         * │ The full-span trap `compare-table.tsx` documents cannot be reached here: a cell     │
         * │ spanning every column is as wide as the row, so it has zero travel and cannot stick │
         * │ at all. This table has no section header row. If one is ever added, the sticky goes │
         * │ on a child span, exactly as FACILITIES does over there.                              │
         * └────────────────────────────────────────────────────────────────────────────────────┘
         */}
        <div className="gm-compare-scroll gm-table-box overflow-x-auto">
          <table className="gm-table min-w-[30rem]">
            <caption className="gm-visually-hidden">{t('web.compare.title')}</caption>
            <thead>
              <tr>
                <th scope="col" className="gm-compare-label bg-surface-overlay">
                  <span className="gm-visually-hidden">{t('web.compare.rowLabel')}</span>
                </th>
                {gyms.map((gym) => (
                  <th key={gym.id} scope="col">
                    {gym.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  {/* `surface-raised` because that is what `.gm-table-box` paints under the body
                      rows; the head's corner cell above takes `surface-overlay` for the same
                      reason. See the note above the scroller. */}
                  <th scope="row" className="gm-compare-label bg-surface-raised">
                    {t(row.label)}
                  </th>
                  {gyms.map((gym) => {
                    const wins = row.best(gym);
                    return (
                      <td key={gym.id} className={wins ? 'gm-best' : undefined}>
                        {row.cell(gym)}
                        {wins ? <span className="gm-visually-hidden"> ({t(row.mark)})</span> : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cities
// ─────────────────────────────────────────────────────────────────────────────

export function CityGrid() {
  /*
   * Counted from the catalogue, one entry per city that actually has listings. The reference
   * prints "3,245 gyms" under each tile; these are the real counts, which are small, and a small
   * true number is worth more here than a large invented one.
   */
  const cities = [...new Set(CATALOGUE.map((gym) => gym.citySlug))].map((slug) => {
    const gyms = CATALOGUE.filter((gym) => gym.citySlug === slug);
    const first = gyms[0]!;
    /*
     * The tile wears a photograph from a gym in that city, with the same "Sample photo" marker
     * every other cover carries.
     *
     * It was one of six abstract gradients before, and those six introduce five hues - orange,
     * cyan, violet, green, pink - that appear nowhere else in this identity. Four of them in a
     * row under an ink-and-amber page is a palette of its own. The gradients stay as the ground
     * for a listing with no cover at all, which is what they were always for.
     */
    return { slug, name: first.city, count: gyms.length, cover: first };
  });

  return (
    <section className="gm-sec" id="cities">
      <div className="gm-wrap gm-reveal">
        <SectionHead
          title="web.home.cities.title"
          action={{ href: '/cities', label: 'web.home.cities.seeAll' }}
        />

        <ul className="gm-cities">
          {cities.map((city) => (
            <li key={city.slug}>
              <Link href={`/gyms/${city.slug}`} className="gm-city">
                <GymPhoto
                  gym={city.cover}
                  sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                  className="gm-city-art"
                />
                <span className="gm-city-t">
                  <strong>{city.name}</strong>
                  <span>
                    {String(city.count)}{' '}
                    {t(
                      city.count === 1 ? 'web.home.cities.listingsOne' : 'web.home.cities.listings',
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────────────────────

const FAQ = [
  { q: 'web.home.faq.verified.q', a: 'web.home.faq.verified.a' },
  { q: 'web.home.faq.price.q', a: 'web.home.faq.price.a' },
  { q: 'web.home.faq.reviews.q', a: 'web.home.faq.reviews.a' },
  { q: 'web.home.faq.checkin.q', a: 'web.home.faq.checkin.a' },
] as const satisfies readonly { q: MessageKey; a: MessageKey }[];

export function Faq() {
  return (
    <section className="gm-sec" id="faq">
      <div className="gm-wrap gm-reveal">
        <SectionHead
          eyebrow="web.home.eyebrow.faq"
          title="web.home.faq.title"
          lede="web.home.faq.body"
        />

        {/*
         * `<details>` and not a JavaScript accordion. It opens before hydration, it is
         * keyboard-operable and announced correctly with no work, and a crawler reads the answers
         * whether or not it expands them — which is most of the point of an FAQ on a marketing
         * page. The rotating `+` is CSS on `[open]`, so there is no state anywhere.
         */}
        <div className="gm-faq">
          {FAQ.map((item, i) => (
            <details key={item.q} className="gm-faq-i">
              <summary className="gm-faq-q">
                <span className="gm-faq-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="gm-h3">{t(item.q)}</span>
                <span aria-hidden="true" className="gm-faq-x">
                  +
                </span>
              </summary>
              <p className="gm-faq-a">{t(item.a)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Closing
// ─────────────────────────────────────────────────────────────────────────────

export function ClosingBand() {
  const Search = icon.search;

  return (
    <section className="gm-close">
      <div className="gm-wrap gm-reveal">
        <h2 className="gm-display">
          {t('web.home.closing.titleLead')} <em>{t('web.home.closing.titleAccent')}</em>
        </h2>
        <p className="gm-lede mx-auto mt-[26px] text-center">{t('web.home.closing.body')}</p>
        <p className="mt-[30px]">
          <Link href="/search" className="gm-btn gm-btn-amber gm-btn-lg">
            <Search aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
            {t('web.home.closing.cta')}
          </Link>
        </p>

        {/* The brand set very large, as a full stop. Nothing to read that the header did not say. */}
        <p aria-hidden="true" className="gm-wordmark">
          {t('web.chrome.brand')}
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Explore by goal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each goal is a real query. "Build strength" is `?category=Strength`, which the results page
 * already understands, so these are crawlable entry points (`FR-SRCH-13`) rather than decoration.
 */
const GOALS = [
  { label: 'web.home.goals.strength', query: 'category=Strength', glyph: 'strength' },
  { label: 'web.home.goals.weight', query: 'category=Cardio', glyph: 'cardio' },
  { label: 'web.home.goals.fitness', query: 'category=Gym', glyph: 'strength' },
  { label: 'web.home.goals.flexibility', query: 'category=Yoga', glyph: 'yoga' },
  { label: 'web.home.goals.sport', query: 'category=Boxing', glyph: 'boxing' },
  { label: 'web.home.goals.routine', query: 'category=Group%20classes', glyph: 'cardio' },
] as const satisfies readonly { label: MessageKey; query: string; glyph: keyof typeof icon }[];

export function Goals() {
  return (
    <section className="gm-sec" id="goals">
      <div className="gm-wrap gm-reveal">
        <SectionHead title="web.home.goals.title" lede="web.home.goals.body" />

        <ul className="gm-goals">
          {GOALS.map((goal) => {
            const Glyph = icon[goal.glyph];
            return (
              <li key={goal.label}>
                {/*
                 * The whole tile is one link and its accessible name is the goal, so both the
                 * glyph and the caret are `aria-hidden` - otherwise the name becomes "Build
                 * strength, next", which names a control that is not there.
                 */}
                <Link href={`/search?${goal.query}`} className="gm-goal gm-hit-target">
                  <Glyph aria-hidden="true" className="h-[1.25rem] w-[1.25rem] shrink-0" />
                  <em>{t(goal.label)}</em>
                  <span aria-hidden="true" className="gm-goal-arrow">
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// How it works
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { title: 'web.home.how.discover.title', body: 'web.home.how.discover.body' },
  { title: 'web.home.how.compare.title', body: 'web.home.how.compare.body' },
  { title: 'web.home.how.choose.title', body: 'web.home.how.choose.body' },
  { title: 'web.home.how.join.title', body: 'web.home.how.join.body' },
] as const satisfies readonly { title: MessageKey; body: MessageKey }[];

export function HowItWorks() {
  return (
    <section className="gm-sec gm-sec-paper" id="how">
      <div className="gm-wrap gm-reveal">
        <SectionHead title="web.home.how.title" />

        {/*
         * Numbered, and here the numbers earn it: this is a sequence a member moves through in
         * order, so the ordinal carries information the reader needs. An `<ol>` says to a screen
         * reader what the mono numerals say to everyone else, and the rule filling under each step
         * is the same fact a third time.
         */}
        <ol className="gm-steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="gm-step">
              <p className="gm-step-n">{String(index + 1).padStart(2, '0')}</p>
              <h3 className="gm-h3">{t(step.title)}</h3>
              <p className="gm-lede">{t(step.body)}</p>
              <span aria-hidden="true" className="gm-step-bar" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The reviews band, with nothing in it, on purpose.
 *
 * ┌─ THE SECTION EXISTS. THE QUOTES DO NOT. ────────────────────────────────────────────────────┐
 * │ The reference fills this with three five-star testimonials from three named members and a   │
 * │ "4.8 from verified members" figure. `BR-REV-01` makes a review impossible without a recorded │
 * │ check-in and there are no check-ins, so all four would be fabrications - on the page whose   │
 * │ entire argument is that its reviews are the ones you can trust.                              │
 * │                                                                                             │
 * │ Leaving the band out was the earlier answer and it was weaker. A page that quietly omits     │
 * │ reviews says nothing about the rule; a band that states the rule and then shows an honest    │
 * │ zero demonstrates it. The empty state is not a gap here, it is the argument.                  │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function Reviews() {
  const Star = icon.reviews;
  const Verified = icon.verified;

  return (
    <section className="gm-sec" id="reviews">
      <div className="gm-wrap gm-reveal">
        <SectionHead
          eyebrow="web.home.eyebrow.reviews"
          title="web.home.reviews.title"
          lede="web.home.reviews.body"
          action={{ href: '/how-it-works', label: 'web.home.reviews.cta' }}
        />

        <div className="gm-rev">
          {/*
           * The empty state is the LARGER half, not a footnote under three cards that are not
           * there. It is what this section currently has to say.
           */}
          <div className="gm-rev-empty">
            {/*
             * A check-in scanner, because the check-in is the thing that has to happen before a
             * review can exist. Decorative, `aria-hidden`, and it stops dead under reduced motion
             * rather than strobing at 1ms - an infinite loop cannot be handled by the duration
             * tokens the way a one-shot transition can.
             */}
            <div aria-hidden="true" className="gm-scanner">
              <Verified className="h-[1.5rem] w-[1.5rem] text-content-muted" />
            </div>
            <h3 className="gm-h3 mt-[26px]">{t('web.home.reviews.emptyTitle')}</h3>
            <p className="gm-lede mx-auto max-w-[46ch]">{t('web.home.reviews.emptyBody')}</p>
          </div>

          <ul className="grid content-start gap-[14px]">
            {(
              [
                {
                  Glyph: Verified,
                  title: 'web.home.reviews.ruleTitle',
                  body: 'web.home.reviews.ruleBody',
                },
                {
                  Glyph: Star,
                  title: 'web.home.reviews.unratedTitle',
                  body: 'web.home.reviews.unratedBody',
                },
              ] as const
            ).map((item) => (
              <li key={item.title} className="gm-mini">
                <p className="gm-eyebrow-k">
                  <item.Glyph aria-hidden="true" className="h-[0.875rem] w-[0.875rem]" />
                  {t(item.title)}
                </p>
                <p className="gm-lede mt-[10px]">{t(item.body)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The account
// ─────────────────────────────────────────────────────────────────────────────

const MEMBER_FEATURES = [
  { glyph: 'verified', title: 'web.home.member.qr.title', body: 'web.home.member.qr.body' },
  { glyph: 'place', title: 'web.home.member.visits.title', body: 'web.home.member.visits.body' },
  {
    glyph: 'pricing',
    title: 'web.home.member.receipts.title',
    body: 'web.home.member.receipts.body',
  },
] as const satisfies readonly { glyph: keyof typeof icon; title: MessageKey; body: MessageKey }[];

/**
 * The reference sells an app here, with two store buttons. There is no app and no store listing,
 * so this sells the account, which exists, is linked, and is where all three of these live.
 */
export function MemberExperience() {
  return (
    <section className="gm-sec gm-sec-paper" id="member">
      <div className="gm-wrap gm-reveal">
        <SectionHead
          eyebrow="web.home.eyebrow.member"
          title="web.home.member.title"
          lede="web.home.member.body"
          action={{ href: '/account', label: 'web.home.member.cta' }}
        />

        {/* Three, not four - the band's own grid, so it divides evenly rather than leaving a gap. */}
        <ul className="gm-promises gm-promises-3">
          {MEMBER_FEATURES.map((feature) => {
            const Glyph = icon[feature.glyph];
            return (
              <li key={feature.title} className="gm-promise">
                <span aria-hidden="true" className="gm-promise-mark">
                  <Glyph className="h-[1.0625rem] w-[1.0625rem]" />
                </span>
                <h3>{t(feature.title)}</h3>
                <p>{t(feature.body)}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// For gym owners
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The owner console, as a shape.
 *
 * ┌─ IT CARRIES NO FIGURES, AND THAT IS THE WHOLE DESIGN OF IT ─────────────────────────────────┐
 * │ The reference fills this panel with `₹4.82L revenue +18.4%` and `1,284 members +12.8%`.      │
 * │ Those are invented business results printed beside a "list your gym" button, which makes     │
 * │ them a performance claim to a prospective seller rather than decoration - and a screenshot   │
 * │ of this section would outlive any disclaimer next to it.                                      │
 * │                                                                                              │
 * │ So the labels stay and the figures are blocks. It still answers what the section is really   │
 * │ asking - "what do I get?" - by showing the interface, which is a truthful answer.             │
 * │                                                                                              │
 * │ The bars are deliberately NOT a rising ramp. A chart that climbs left to right under a sales │
 * │ pitch reads as a growth claim even with the axis stripped off, so the shape is flat-ish and  │
 * │ unordered: it says "a chart lives here", which is all it is entitled to say.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function ForOwners() {
  const Has = icon.has;

  return (
    <section className="gm-sec gm-owners" id="owners">
      <div className="gm-wrap gm-owners-in gm-reveal">
        <div>
          <p className="gm-eyebrow-k">{t('web.home.owners.eyebrow')}</p>
          <h2 className="gm-h2">{t('web.home.owners.title')}</h2>
          <p className="gm-lede">{t('web.home.owners.body')}</p>

          {/*
           * The four capabilities, as the reference's two-column tick list. Each is something the
           * gym dashboard actually does per the PRD - discovery, plan sales, check-in, reporting -
           * and not one of them is a number.
           */}
          <ul className="gm-checks">
            {(
              [
                'web.home.owners.point.discovered',
                'web.home.owners.point.sell',
                'web.home.owners.point.checkins',
                'web.home.owners.point.track',
              ] as const
            ).map((key) => (
              <li key={key}>
                <Has aria-hidden="true" className="h-[1.0625rem] w-[1.0625rem] shrink-0" />
                {t(key)}
              </li>
            ))}
          </ul>

          <Link href="/for-gyms" data-on-solid="true" className="gm-btn gm-btn-amber gm-btn-lg">
            {t('web.home.owners.cta')} <i aria-hidden="true">→</i>
          </Link>
        </div>

        <figure className="m-0">
          <div className="gm-dash">
            <div className="gm-dash-top">
              <span>{t('web.home.owners.preview.title')}</span>
              <span>{t('web.home.owners.preview.badge')}</span>
            </div>

            <div className="gm-dash-kpi">
              {(
                ['web.home.owners.preview.revenue', 'web.home.owners.preview.members'] as const
              ).map((key) => (
                <div key={key}>
                  <span>{t(key)}</span>
                  {/* Where the figure goes. A block, not a plausible number. */}
                  <b aria-hidden="true" className="gm-dash-slot" />
                </div>
              ))}
            </div>

            {/*
             * The heights are utility classes rather than an inline style, and literal rather than
             * interpolated. `style-src` carries a nonce, so a `style` attribute is dropped outright
             * and every bar would render at zero height; and Tailwind resolves classes by scanning
             * source TEXT, so `h-[${n}]` generates nothing. Both failures are silent, and both have
             * happened in this file's history.
             */}
            <div aria-hidden="true" className="gm-bars">
              <i className="h-[62%]" />
              <i className="h-[88%]" />
              <i className="h-[54%]" />
              <i className="h-[71%]" />
              <i className="h-[95%]" />
              <i className="h-[66%]" />
              <i className="h-[78%]" />
              <i className="h-[58%]" />
            </div>
          </div>

          {/*
           * A real caption. Nobody deciding whether to list their gym should have to work out
           * whether this is a screenshot of results or a drawing of a product.
           */}
          <figcaption className="gm-smallprint mt-[14px]">
            {t('web.home.owners.preview.caption')}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
