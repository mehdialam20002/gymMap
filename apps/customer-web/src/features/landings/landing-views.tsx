/**
 * The four landing surfaces — `SCR-WEB-008`, `SCR-WEB-009`, `FR-SRCH-13`.
 *
 * ┌─ A LANDING IS A PLACE, NOT A FILTERED VIEW ─────────────────────────────────────────────────┐
 * │ Each of these has its own title, its own description, its own sentence of copy and its own   │
 * │ outbound links — which is the entire difference between a page a search engine ranks and a   │
 * │ query string it treats as thin. The gyms come from the same `search()` the results page       │
 * │ runs, so the two can never disagree about what is listed where.                               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Link from 'next/link';

import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import type { CompareBase } from '../compare/compare.ts';
import { GymCard } from '../discovery/gym-card.tsx';
import { FixtureNotice } from '../discovery/search-results.tsx';
import { toSearchParams, EMPTY_QUERY } from '../discovery/search.ts';
import { GymPhoto } from '../discovery/gym-photo.tsx';
/*
 * `Promises` and `ClosingBand` come from the home feature, and the coupling is deliberate rather
 * than convenient: they are the site's trust spine and its call to action, not home-page
 * decoration, and a second copy of either would be a second place for the four rules to drift.
 * If a third surface needs them they move to `shared/`; two is not yet a pattern.
 */
import { ClosingBand, Promises } from '../home/chalk.tsx';
import { CITIES, type GymDetail } from '../discovery/fixtures/catalogue.ts';
import {
  activityIndex,
  activitySlug,
  cityIndex,
  type ActivityLanding,
  type CityLanding,
} from './landings.ts';

/** `{count} gyms`, with the singular the fixture actually produces. */
function countLabel(count: number): string {
  return `${String(count)} ${count === 1 ? t('web.landing.count.one') : t('web.landing.count.many')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// A city
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a landing needs beyond its own copy, so the two views state it once.
 *
 * ADR-0050: the selection is a prop because it is already in the URL, and the base is the landing
 * itself so a toggle returns the reader to the page they were reading. Neither route carries a
 * filter of its own, so the base is the bare path - `/gyms/bengaluru`, `/explore/yoga` - and the
 * canonical each route hardcodes is that same string, which is why `?gym=` adds no indexable
 * address (`FR-SRCH-13`).
 */
interface LandingCompare {
  readonly selected: readonly GymDetail[];
  readonly base: CompareBase;
}

export function CityLandingView({
  landing,
  selected,
  base,
}: { readonly landing: CityLanding } & LandingCompare) {
  const others = cityIndex().filter((city) => city.slug !== landing.slug);

  return (
    <>
      <div className="gm-wrap gm-sec gm-sec-tight">
        <FixtureNotice />

        <nav aria-label={t('web.chrome.breadcrumb.landmark')} className="gm-crumbs mt-stack-lg">
          <Link href="/cities" className="gm-hit-target hover:underline">
            {t('web.landing.cities.title')}
          </Link>
          {' / '}
          <span aria-current="page" className="text-content">
            {landing.name}
          </span>
        </nav>

        <h1 className="mt-stack-sm gm-h2">
          {t('web.landing.city.title').replace('{city}', landing.name)}
        </h1>
        <p className="mt-stack-sm max-w-prose text-base text-content-secondary">
          {t('web.landing.city.intro').replace('{city}', landing.name)}
        </p>

        <GymGrid
          gyms={landing.gyms}
          emptyKey="web.landing.city.empty"
          selected={selected}
          base={base}
        />

        {landing.gyms.length > 0 && (
          <p className="mt-stack-lg">
            <Link
              href={toSearchParams({ ...EMPTY_QUERY, city: landing.slug })}
              className="gm-card-add text-base font-semibold"
            >
              {t('web.landing.city.seeAll').replace('{count}', String(landing.gyms.length))}
            </Link>
          </p>
        )}

        {/*
         * The cross-links are the point. A landing with no way out of it is a leaf, and a leaf is
         * how a crawler decides a section is shallow — these are also the two questions a member
         * asks next: "what else is here" and "where else can I do this".
         */}
        {landing.activities.length > 0 && (
          <ChipSection
            title={t('web.landing.city.activities').replace('{city}', landing.name)}
            chips={landing.activities.map((activity) => ({
              key: activity,
              label: activity,
              href: `/explore/${activitySlug(activity)}`,
            }))}
          />
        )}

        <ChipSection
          title={t('web.landing.city.otherCities')}
          chips={others.map((city) => ({
            key: city.slug,
            label: `${city.name} · ${countLabel(city.count)}`,
            href: `/gyms/${city.slug}`,
          }))}
        />
      </div>

      <Promises />
      <ClosingBand />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// An activity
// ─────────────────────────────────────────────────────────────────────────────

export function ActivityLandingView({
  landing,
  selected,
  base,
}: { readonly landing: ActivityLanding } & LandingCompare) {
  const others = activityIndex().filter((activity) => activity.slug !== landing.slug);

  return (
    <>
      <div className="gm-wrap gm-sec gm-sec-tight">
        <FixtureNotice />

        <nav aria-label={t('web.chrome.breadcrumb.landmark')} className="gm-crumbs mt-stack-lg">
          <Link href="/explore" className="gm-hit-target hover:underline">
            {t('web.landing.explore.title')}
          </Link>
          {' / '}
          <span aria-current="page" className="text-content">
            {landing.name}
          </span>
        </nav>

        <h1 className="mt-stack-sm gm-h2">
          {t('web.landing.activity.title').replace('{activity}', landing.name)}
        </h1>
        <p className="mt-stack-sm max-w-prose text-base text-content-secondary">
          {t('web.landing.activity.intro').replace('{activity}', landing.name)}
        </p>

        <GymGrid
          gyms={landing.gyms}
          emptyKey="web.landing.activity.empty"
          selected={selected}
          base={base}
        />

        {landing.cities.length > 0 && (
          <ChipSection
            title={t('web.landing.activity.cities').replace('{activity}', landing.name)}
            chips={landing.cities.map((city) => ({
              key: city.slug,
              label: `${city.name} · ${countLabel(city.count)}`,
              // Straight to the results page with BOTH filters, because "yoga in Bengaluru" is one
              // query rather than a place — a landing per activity-city pair would be hundreds of
              // near-identical pages, which is the thin-content problem these pages avoid.
              href: toSearchParams({ ...EMPTY_QUERY, city: city.slug, category: landing.name }),
            }))}
          />
        )}

        <ChipSection
          title={t('web.landing.activity.other')}
          chips={others.map((activity) => ({
            key: activity.slug,
            label: `${activity.name} · ${countLabel(activity.count)}`,
            href: `/explore/${activity.slug}`,
          }))}
        />
      </div>

      <Promises />
      <ClosingBand />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The two hubs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ┌─ THESE TWO PAGES WERE A HEADING, A LINE AND A GRID ────────────────────────────────────────┐
 * │ Measured: `/cities` 994px and `/explore` 1,194px against the home page's 11,251. Both are   │
 * │ the crawlable entry points `FR-SRCH-13` exists to create, and both arrived at a title, one  │
 * │ sentence, a row of tiles and the footer - a page that looks unfinished to a reader and      │
 * │ thin to a crawler, which is the one audience they were built for.                            │
 * │                                                                                             │
 * │ What they gained is content each page can support and no other page can: the cross-link      │
 * │ band that answers the question the tiles raise (from a city, what is on offer; from an       │
 * │ activity, where it is), then the four rules, then the call to action. Nothing invented -     │
 * │ every count and every name is read from the catalogue, and the two shared bands are the      │
 * │ site's own, not a second copy written for these pages.                                      │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function CitiesIndex() {
  const Place = icon.place;
  const cities = cityIndex();

  return (
    <>
      <HubPage
        title={t('web.landing.cities.title')}
        intro={t('web.landing.cities.intro')}
        entries={cities.map((city) => {
          const cover = CITIES.find((entry) => entry.slug === city.slug);
          return {
            key: city.slug,
            href: `/gyms/${city.slug}`,
            label: city.name,
            note: countLabel(city.count),
            Glyph: Place,
            ...(cover
              ? { cover: { id: cover.slug, photo: cover.photo, photoAlt: cover.photoAlt } }
              : {}),
          };
        })}
      >
        {/* Every activity anybody actually offers, from the same catalogue the tiles count. */}
        <ChipSection
          title={t('web.landing.cities.activities')}
          chips={activityIndex().map((activity) => ({
            key: activity.slug,
            label: `${activity.name} · ${countLabel(activity.count)}`,
            href: `/explore/${activity.slug}`,
          }))}
        />
      </HubPage>

      <Promises />
      <ClosingBand />
    </>
  );
}

export function ExploreIndex() {
  return (
    <>
      <HubPage
        title={t('web.landing.explore.title')}
        intro={t('web.landing.explore.intro')}
        entries={activityIndex().map((activity) => ({
          key: activity.slug,
          href: `/explore/${activity.slug}`,
          label: activity.name,
          note: countLabel(activity.count),
          Glyph: activityGlyph(activity.name),
        }))}
      >
        <ChipSection
          title={t('web.landing.explore.cities')}
          chips={cityIndex().map((city) => ({
            key: city.slug,
            label: `${city.name} · ${countLabel(city.count)}`,
            href: `/gyms/${city.slug}`,
          }))}
        />
      </HubPage>

      <Promises />
      <ClosingBand />
    </>
  );
}

/**
 * A glyph per activity, because the explore hub drew the SAME dumbbell on all ten tiles.
 *
 * `ExploreIndex` passed `icon.strength` for every entry, so a grid built to help somebody choose
 * between yoga and boxing gave them ten identical icons and made the whole page read as filler.
 * An icon that is the same everywhere carries no information and costs the space of one that would.
 *
 * The map is explicit and the fallback is honest: `has` is the generic "this is offered" tick, used
 * where the set has no glyph of its own rather than reaching for a loosely related one. A wrong
 * icon is worse than a neutral one.
 */
function activityGlyph(name: string): (typeof icon)[keyof typeof icon] {
  const BY_NAME: Readonly<Record<string, keyof typeof icon>> = {
    Strength: 'strength',
    Gym: 'strength',
    Cardio: 'cardio',
    CrossFit: 'pulse',
    Yoga: 'yoga',
    Pilates: 'yoga',
    Boxing: 'boxing',
    Swimming: 'swimming',
    'Group classes': 'group',
    'Personal training': 'has',
  };
  return icon[BY_NAME[name] ?? 'has'];
}

function HubPage({
  title,
  intro,
  entries,
  children,
}: {
  readonly title: string;
  readonly intro: string;
  readonly entries: readonly {
    key: string;
    href: string;
    label: string;
    note: string;
    Glyph: (typeof icon)[keyof typeof icon];
    /** A cover for the tile. Cities have one; activities are a concept and do not. */
    cover?: { readonly id: string; readonly photo: string; readonly photoAlt: string };
  }[];
  readonly children?: React.ReactNode;
}) {
  const Next = icon.next;

  return (
    <div className="gm-wrap gm-sec gm-sec-tight">
      <FixtureNotice />

      <h1 className="mt-stack-lg gm-h2">{title}</h1>
      <p className="mt-stack-sm max-w-prose text-base text-content-secondary">{intro}</p>

      <ul className="mt-stack-xl grid gap-stack-md sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <li key={entry.key}>
            <Link
              href={entry.href}
              className={`gm-card gm-card-interactive group rounded-card ${
                entry.cover ? 'block overflow-hidden' : 'flex items-center gap-inline-md p-inset-lg'
              }`}
            >
              {/*
               * A photograph where the subject has one. A city is a place and the catalogue already
               * carries a cover for it - the home page's city grid has used them all along, while
               * this page, which is the INDEX of the same cities, drew a grey pin on white. The
               * activities keep the glyph, because an activity is a concept and a stock photograph
               * of somebody doing yoga would be the decoration this rebuild keeps removing.
               */}
              {entry.cover ? (
                <GymPhoto
                  gym={entry.cover}
                  sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                  className="aspect-video"
                />
              ) : null}
              <span
                className={entry.cover ? 'flex items-center gap-inline-md p-inset-lg' : 'contents'}
              >
                <span className="flex h-[2.75rem] w-[2.75rem] shrink-0 items-center justify-center rounded-full gm-glyph-ring">
                  <entry.Glyph
                    aria-hidden="true"
                    className="h-[1.5rem] w-[1.5rem] text-content-on-media-accent"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-content">{entry.label}</span>
                  <span className="mt-stack-2xs block text-sm tabular-nums text-content-secondary">
                    {entry.note}
                  </span>
                </span>
                <Next
                  aria-hidden="true"
                  className="ml-auto h-[1.25rem] w-[1.25rem] shrink-0 text-content-muted transition-colors duration-fast ease-standard group-hover:text-content-on-media-accent"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared pieces
// ─────────────────────────────────────────────────────────────────────────────

function GymGrid({
  gyms,
  emptyKey,
  selected,
  base,
}: {
  readonly gyms: readonly GymDetail[];
  readonly emptyKey: Parameters<typeof t>[0];
} & LandingCompare) {
  if (gyms.length === 0) {
    return (
      <p className="gm-card mt-stack-xl max-w-prose rounded-card p-inset-lg text-base text-content-secondary">
        {t(emptyKey)}
      </p>
    );
  }

  /*
   * A level 2 the page was missing. Both landings go `h1` -> gym cards, and every `GymCard` emits
   * an `h3`, so the outline read h1 -> h3 -> h3 -> h3 and only reached a real `h2` at the chip
   * sections right at the bottom. Hidden rather than drawn: the `h1` immediately above already
   * says "Gyms in Mumbai", so a visible "Listings" would be repetition on screen - but the outline
   * is a separate artefact and it needs the rung.
   */
  return (
    <>
      <h2 className="gm-visually-hidden">{t('web.landing.listingsHeading')}</h2>
      <ul className="mt-stack-xl grid gap-stack-lg sm:grid-cols-2 xl:grid-cols-3">
        {gyms.map((gym) => (
          <GymCard key={gym.id} gym={gym} selected={selected} base={base} />
        ))}
      </ul>
    </>
  );
}

function ChipSection({
  title,
  chips,
}: {
  readonly title: string;
  readonly chips: readonly { key: string; label: string; href: string }[];
}) {
  if (chips.length === 0) return null;

  return (
    <section className="mt-region-sm border-t border-subtle pt-stack-lg">
      <h2 className="gm-h2">{title}</h2>
      <ul className="mt-stack-md flex flex-wrap gap-inline-xs">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              className="gm-card gm-lift gm-hit-target inline-block rounded-control px-inset-md py-inset-xs text-base text-content-secondary hover:text-content"
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
