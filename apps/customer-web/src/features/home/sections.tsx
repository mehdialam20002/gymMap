/**
 * `SCR-WEB-001`'s content sections.
 *
 * ┌─ EVERY FIGURE ON THIS PAGE IS COUNTED, OR IT IS ABSENT ─────────────────────────────────────┐
 * │ The reference this page was designed against carries a statistics strip — 12,000+ gyms, 2M+ │
 * │ members, 4.8 average rating — and a floating card with member avatars. None of it is here.  │
 * │                                                                                             │
 * │ There are eight listings and no check-ins, so those numbers would be false statements made  │
 * │ by the platform to a consumer. The rating badge would be worse than false: `BR-REV-01` says │
 * │ a review requires a recorded check-in, and the page states that promise three sections down.│
 * │ Inventing a review count to sell the product whose selling point is real reviews is the one │
 * │ lie that discredits everything around it.                                                    │
 * │                                                                                             │
 * │ The city counts below ARE real — counted from the catalogue at render. When the catalogue   │
 * │ becomes an API they keep working, because they were never hard-coded.                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Image from 'next/image';
import Link from 'next/link';

import type { MessageKey } from '../../shared/i18n/index.ts';
import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { CITIES } from '../discovery/fixtures/catalogue.ts';
import { Section } from './section.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// Trust
// ─────────────────────────────────────────────────────────────────────────────

const TRUST = [
  {
    glyph: 'verified',
    title: 'web.home.trust.verified.title',
    body: 'web.home.trust.verified.body',
  },
  { glyph: 'pricing', title: 'web.home.trust.pricing.title', body: 'web.home.trust.pricing.body' },
  { glyph: 'reviews', title: 'web.home.trust.reviews.title', body: 'web.home.trust.reviews.body' },
  { glyph: 'secure', title: 'web.home.trust.payments.title', body: 'web.home.trust.payments.body' },
] as const satisfies readonly {
  glyph: keyof typeof icon;
  title: MessageKey;
  body: MessageKey;
}[];

/** Sits directly under the hero, on the band colour, before anything asks for a decision. */
export function TrustStrip() {
  return (
    <section className="border-b border-subtle bg-surface-subtle">
      <div className="gm-reveal mx-auto max-w-container px-inset-md py-region-sm">
        <ul className="grid gap-stack-lg sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((item) => {
            const Glyph = icon[item.glyph];
            return (
              <li key={item.title} className="flex gap-inline-sm">
                <Glyph
                  aria-hidden="true"
                  className="mt-px h-[1.5rem] w-[1.5rem] shrink-0 text-content-brand"
                />
                <div>
                  <h2 className="text-base font-semibold text-content">{t(item.title)}</h2>
                  <p className="mt-stack-2xs text-sm text-content-secondary">{t(item.body)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Goals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each goal is a real query. "Build strength" is `?category=Strength`, which the results page
 * already understands — so these are entry points rather than decoration, and they are crawlable
 * (`FR-SRCH-13`).
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
  const Next = icon.next;

  return (
    <Section
      eyebrow="web.home.eyebrow.goals"
      title="web.home.goals.title"
      body="web.home.goals.body"
      tone="subtle"
    >
      <ul className="grid gap-stack-md sm:grid-cols-2 lg:grid-cols-3">
        {GOALS.map((goal) => {
          const Glyph = icon[goal.glyph];
          return (
            <li key={goal.label}>
              <Link
                href={`/search?${goal.query}`}
                className="gm-card gm-card-interactive group flex items-center gap-inline-md rounded-card p-inset-lg"
              >
                <span className="flex h-[2.75rem] w-[2.75rem] shrink-0 items-center justify-center rounded-full bg-surface-brand-subtle">
                  <Glyph aria-hidden="true" className="h-[1.5rem] w-[1.5rem] text-content-brand" />
                </span>
                <span className="text-base font-semibold text-content">{t(goal.label)}</span>
                {/*
                 * `ml-auto` so the caret sits at the far edge and the tile reads as a row rather
                 * than a label floating in a wide box. Decorative — the whole tile is the link and
                 * its accessible name is the goal, so the caret must not add a second one.
                 */}
                <Next
                  aria-hidden="true"
                  className="ml-auto h-[1.25rem] w-[1.25rem] shrink-0 text-content-muted transition-colors duration-fast ease-standard group-hover:text-content-brand"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
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
    <Section eyebrow="web.home.eyebrow.how" title="web.home.how.title">
      {/*
       * Numbered, and the numbers earn it: this is a real sequence a member moves through in
       * order, so the ordinal carries information. An `<ol>` says the same thing to a screen
       * reader that the large numerals say to everyone else.
       */}
      <ol className="grid gap-stack-lg sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          /*
           * `relative` so the connector rail can hang off the right edge into the grid gap. The
           * rail is drawn by the LI rather than as its own grid item because an `<ol>` whose
           * children are not `<li>` is invalid, and a screen reader announcing "4 items" when the
           * list holds seven is a worse outcome than a slightly harder piece of CSS.
           */
          <li key={step.title} className="gm-card relative rounded-card p-inset-lg">
            <span
              aria-hidden="true"
              className="flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full border border-brand-subtle bg-surface-brand-subtle text-lg font-bold tabular-nums text-content-brand"
            >
              {String(index + 1).padStart(2, '0')}
            </span>

            {/*
             * The dashed rail between one step and the next.
             *
             * Only from `lg`, where the four cards are genuinely in one row. At `sm` the grid is
             * two-up, so step 2's rail would point right at empty space with step 3 sitting below
             * it — an arrow of travel that contradicts the reading order. Rendered only when there
             * IS a next step, so the sequence does not appear to continue past "Join".
             */}
            {index < STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className="gm-step-rail absolute left-full top-[calc(var(--gm-space-inset-lg)+1.625rem)] hidden w-stack-lg lg:block"
              />
            ) : null}

            <h3 className="mt-stack-md text-lg font-semibold text-content">{t(step.title)}</h3>
            <p className="mt-stack-2xs text-sm text-content-secondary">{t(step.body)}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cities
// ─────────────────────────────────────────────────────────────────────────────

export function Cities() {
  // `CITIES` is derived from the catalogue in the fixtures module, so the count is a fact about
  // the data rather than a number typed into a marketing page. A city with no listings is not in
  // the list at all, which is the correct behaviour and one nobody has to remember to implement.
  const cities = [...CITIES].sort((a, b) => b.count - a.count);

  return (
    <Section eyebrow="web.home.eyebrow.cities" title="web.home.cities.title">
      {/*
       * Photographic tiles, as the reference has them. Four columns rather than the reference's six
       * because there are four cities: a six-column grid would leave two dead cells, and stretching
       * four tiles across six tracks makes each one wider than it is tall, which is the one
       * proportion a city tile must not have.
       */}
      <ul className="grid gap-stack-md sm:grid-cols-2 lg:grid-cols-4">
        {cities.map((entry) => (
          <li key={entry.slug}>
            <Link
              href={`/search?city=${encodeURIComponent(entry.name)}`}
              className="gm-card gm-card-interactive group relative block h-[15.5rem] overflow-hidden rounded-card"
            >
              {/*
               * Intrinsic dimensions plus `h-full w-full object-cover`, and deliberately NOT
               * `fill`. `fill` is entirely an inline style — `position:absolute` and the four
               * offsets — so the CSP drops all of it and the image lands unpositioned and
               * unsized. `gym-card.tsx` already learned this; the classes are the same layout
               * from the stylesheet, where the policy cannot reach it.
               *
               * `text-transparent` stands in for the `color:transparent` Next writes inline, so
               * alt text does not paint over the frame while the bytes are in flight.
               */}
              <Image
                src={entry.photo}
                alt={t('web.home.cities.photoAlt').replace('{gym}', entry.photoAlt)}
                width={1200}
                height={675}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="h-full w-full object-cover text-transparent transition-transform duration-slow ease-standard group-hover:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                data-photo="true"
              />
              {/*
               * The scrim is what makes the label legible, so it is not decoration and it is not
               * optional. It runs from fully opaque `surface-media` at the bottom to transparent at
               * 62%, and the text sits inside the opaque part — `content-on-media` is proved against
               * `surface-media` in both themes, which is exactly why that token pair exists.
               *
               * A single translucent wash over the whole tile would have been simpler and would
               * have muddied the photograph for no gain, because the top of the tile carries no text.
               */}
              <span aria-hidden="true" className="gm-tile-scrim absolute inset-0" />
              <span className="absolute inset-x-0 bottom-0 flex flex-col gap-stack-2xs p-inset-md">
                <span className="text-lg font-bold text-content-on-media">{entry.name}</span>
                <span className="text-sm tabular-nums text-content-on-media">
                  {entry.count === 1
                    ? t('web.home.cities.countOne')
                    : t('web.home.cities.count').replace('{count}', String(entry.count))}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gym owners, and the close
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The owner dashboard, as a shape — the reference's rotated stat panel.
 *
 * ┌─ IT CARRIES NO FIGURES, AND THAT IS THE ENTIRE DESIGN OF IT ─────────────────────────────────┐
 * │ The reference fills this panel with `₹4.82L revenue +18.4%` and `1,284 members +12.8%`. Those │
 * │ are invented business results, printed next to a "list your gym" button, which makes them a   │
 * │ performance claim to a prospective seller rather than decoration. This file's header refuses   │
 * │ exactly that, and a screenshot of this section would outlive any disclaimer beside it.         │
 * │                                                                                              │
 * │ So the labels stay and the numbers are replaced by placeholder blocks. It still answers the    │
 * │ question the section is really asking — "what do I get?" — by showing the interface, which is  │
 * │ a truthful answer, and it is the same discipline the admin console's unbuilt screens use.      │
 * │                                                                                              │
 * │ The bars are deliberately NOT a rising ramp. A chart that climbs left-to-right under a sales   │
 * │ pitch is read as a growth claim even with the axis stripped off, so the shape is flat-ish and  │
 * │ unordered: it says "a chart lives here", which is all it is entitled to say.                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
/**
 * Everything about a bar except its height.
 *
 * ┌─ A PLAIN STRING CONSTANT, BECAUSE TAILWIND EXTRACTS BY READING SOURCE TEXT ──────────────────┐
 * │ These classes first lived inline in a template literal — `` `w-full max-w-[…] … ${height}` `` │
 * │ — and `max-w-[1.25rem]` and `rounded-t-[…]` were never generated, while `h-[62%]` from the    │
 * │ plain-string array below was. Grepping the built stylesheet is what settled it: the selectors │
 * │ were simply absent, so the bars kept their full width and square corners.                     │
 * │                                                                                              │
 * │ Tailwind finds candidates by scanning source TEXT, and it does not reliably see them inside a │
 * │ template that also contains an interpolation. A plain quoted string is read the same way the  │
 * │ array entries are — the concatenation at the call site is irrelevant, because extraction      │
 * │ happens at build time and never runs this code.                                               │
 * │                                                                                              │
 * │ Nothing warns about this. The class is in the DOM, the element renders, and the utility does  │
 * │ not exist — the same silent shape as the trailing-backslash bug two commits ago, which is why │
 * │ both were found by measuring the rendered value instead of reading the JSX.                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The radius is `rounded-t-sm` from the token scale rather than an arbitrary length: a corner
 * radius is a design-system decision, and an app inventing one is what `UI2` forbids.
 */
const BAR_SHAPE = 'w-full max-w-[1.25rem] rounded-t-sm bg-brand-solid';

function OwnerDashboardPreview() {
  /*
   * Heights as LITERAL utility classes, not `style={{ height }}`.
   *
   * ┌─ THE SUITE CAUGHT ME WRITING THE INLINE STYLE ──────────────────────────────────────────┐
   * │ The first version was `style={{ height: `${height}%` }}` over a numeric array, and       │
   * │ `shell.spec.ts` failed it by name: "no component sets an inline style, because the CSP   │
   * │ would silently drop it". It was right, and the failure would have been invisible in      │
   * │ review — `style-src` admits one hashed declaration, so every bar would have rendered at  │
   * │ zero height and the chart would simply not have been there.                              │
   * │                                                                                          │
   * │ They are literal strings rather than interpolated because Tailwind resolves classes by    │
   * │ scanning source TEXT: `h-[${n}%]` is a template it never sees the output of, so the       │
   * │ utility is never generated — the same silent nothing, one layer further back.             │
   * └──────────────────────────────────────────────────────────────────────────────────────────┘
   *
   * Unordered on purpose — see the note above the component.
   */
  const bars = [
    'h-[62%]',
    'h-[88%]',
    'h-[54%]',
    'h-[71%]',
    'h-[95%]',
    'h-[66%]',
    'h-[78%]',
    'h-[58%]',
  ];

  return (
    <figure className="m-0">
      {/*
       * `rotate-2` only from `lg`. On a phone the panel is nearly full-bleed, and a rotated
       * full-width card either clips its own corners or forces horizontal scroll — the reference
       * drops the rotation at its narrow breakpoint for the same reason.
       *
       * `motion-reduce:rotate-0` because a permanently skewed block of text is a legibility cost
       * for the same readers `RM1` protects, and the rotation carries no information.
       */}
      <div className="gm-card rounded-card p-inset-lg lg:rotate-2 motion-reduce:rotate-0">
        <div className="flex items-center justify-between border-b border-subtle pb-inset-sm">
          <span className="text-sm font-semibold text-content">
            {t('web.home.owners.preview.title')}
          </span>
          <span className="flex items-center gap-inline-2xs text-sm font-medium text-content-success">
            <span
              aria-hidden="true"
              className="h-[0.5rem] w-[0.5rem] rounded-full bg-success-solid"
            />
            {t('web.home.owners.preview.live')}
          </span>
        </div>

        <div className="mt-stack-md grid gap-stack-sm sm:grid-cols-2">
          {(['web.home.owners.preview.revenue', 'web.home.owners.preview.members'] as const).map(
            (key) => (
              <div key={key} className="rounded-control bg-surface-sunken p-inset-md">
                <span className="gm-eyebrow text-content-tertiary">{t(key)}</span>
                {/* Where the figure goes. A block, not a plausible number. */}
                <span
                  aria-hidden="true"
                  className="mt-stack-xs block h-[1.75rem] w-[7ch] rounded-control bg-surface-subtle"
                />
              </div>
            ),
          )}
        </div>

        {/*
         * `gap-inline-sm` and a capped bar width, because the first version used `w-full` with the
         * tightest gap and eight bars fused into one red slab — it read as a filled panel, not a
         * chart. Thin marks separated by the surface is the actual convention, and it is also what
         * makes the shape legible as a shape.
         *
         * `rounded-t` only: the radius belongs on the data END, and rounding the foot would lift
         * each bar off the baseline it is measured from.
         */}
        <div
          aria-hidden="true"
          className="mt-stack-sm flex h-[9rem] items-end justify-around gap-inline-sm rounded-control bg-surface-sunken p-inset-sm"
        >
          {bars.map((height) => (
            <span key={height} className={`${BAR_SHAPE} ${height}`} />
          ))}
        </div>
      </div>

      {/*
       * A real caption, not a tooltip. Somebody deciding whether to list their gym should not have
       * to guess whether they are looking at a screenshot of results or a drawing of a product.
       */}
      <figcaption className="mt-stack-sm text-sm text-content-on-media">
        {t('web.home.owners.preview.caption')}
      </figcaption>
    </figure>
  );
}

export function ForOwners() {
  const Has = icon.has;

  return (
    /*
     * A hairline top and bottom. `surface-media` is theme-INVARIANT — it has to be, because the
     * hero copy is proved legible against it in both themes — so in dark mode the band and the
     * page canvas are within a step or two of each other and the section stops reading as a band
     * at all. In light mode the borders are invisible against near-black and cost nothing.
     */
    <section className="relative overflow-hidden border-y border-subtle bg-surface-media">
      {/*
       * The reference's corner glow — an 800px blurred brand-red disc bleeding off the top right.
       * `overflow-hidden` on the section is what keeps it from adding horizontal scroll, and it is
       * `aria-hidden` and `pointer-events-none` because it is a lighting effect that must never
       * intercept a click aimed at the button beneath it.
       *
       * Built with `radial-gradient` rather than a blurred div: `filter: blur(120px)` on a large
       * element forces a full-size offscreen buffer and repaints it on every scroll frame, and this
       * band is tall. A gradient is composited once, and `MO4`'s transform-and-opacity-only rule
       * exists for exactly this class of cost.
       */}
      <span
        aria-hidden="true"
        className="gm-brand-glow pointer-events-none absolute -right-[16rem] -top-[16rem] h-[40rem] w-[40rem]"
      />

      <div className="gm-reveal relative mx-auto grid max-w-container items-center gap-region-sm px-inset-md py-region-md lg:grid-cols-2">
        <div className="max-w-prose">
          <p className="gm-eyebrow text-content-on-media-accent">{t('web.home.owners.eyebrow')}</p>
          <h2 className="mt-stack-sm text-3xl font-bold tracking-tight text-content-on-media sm:text-5xl">
            {t('web.home.owners.title')}
          </h2>
          <p className="mt-stack-sm text-base text-content-on-media">{t('web.home.owners.body')}</p>

          {/*
           * The four capabilities, as the reference's two-column tick list. Each one is a thing the
           * gym dashboard actually does per the PRD — discovery, plan sales, check-in, reporting —
           * and not one of them is a number, because a claim like "grow revenue 40%" would be the
           * invented statistic this file's header refuses.
           */}
          <ul className="mt-stack-lg grid gap-stack-xs sm:grid-cols-2">
            {(
              [
                'web.home.owners.point.discovered',
                'web.home.owners.point.sell',
                'web.home.owners.point.checkins',
                'web.home.owners.point.track',
              ] as const
            ).map((key) => (
              <li key={key} className="flex items-center gap-inline-xs">
                <Has
                  aria-hidden="true"
                  className="h-[1.125rem] w-[1.125rem] shrink-0 text-content-on-media-accent"
                />
                <span className="text-sm font-medium text-content-on-media">{t(key)}</span>
              </li>
            ))}
          </ul>

          {/*
           * This was a `<p>` while `/for-gyms` did not exist — the offer stated without a promise
           * of a page. The page exists now, so it is a link.
           *
           * Now the brand fill rather than an outline: it is the one thing this band asks for, and
           * the reference makes it the loudest control on the section. `data-on-solid` because the
           * ring sits against the brand fill, not against the band.
           */}
          <Link
            href="/for-gyms"
            data-on-solid="true"
            className="gm-hit-target mt-stack-lg inline-flex items-center rounded-control bg-brand-solid px-inset-lg py-inset-sm text-base font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover active:bg-brand-solid-active"
          >
            {t('web.home.owners.cta')}
          </Link>
        </div>

        <OwnerDashboardPreview />
      </div>
    </section>
  );
}

export function Closing() {
  return (
    // `bg-surface`, not `subtle`: the FAQ above it is the subtle band, and two in a row read as
    // one very tall section. The alternation is the only thing separating them.
    <section className="border-t border-subtle bg-surface">
      <div className="gm-reveal mx-auto max-w-container px-inset-md py-region-md text-center">
        <h2 className="mx-auto max-w-prose text-3xl font-bold tracking-tight text-content sm:text-5xl">
          {t('web.home.closing.title')}
        </h2>
        <Link
          href="/search"
          data-on-solid="true"
          className="gm-hit-target mt-stack-lg inline-flex items-center rounded-control bg-brand-solid px-inset-xl py-inset-sm text-base font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover active:bg-brand-solid-active"
        >
          {t('web.home.closing.cta')}
        </Link>
      </div>
    </section>
  );
}
