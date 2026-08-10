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
import { GymCard } from '../discovery/gym-card.tsx';
import { FixtureNotice } from '../discovery/search-results.tsx';
import { toSearchParams, EMPTY_QUERY } from '../discovery/search.ts';
import type { GymDetail } from '../discovery/fixtures/catalogue.ts';
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

export function CityLandingView({ landing }: { readonly landing: CityLanding }) {
  const others = cityIndex().filter((city) => city.slug !== landing.slug);

  return (
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

      <GymGrid gyms={landing.gyms} emptyKey="web.landing.city.empty" />

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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// An activity
// ─────────────────────────────────────────────────────────────────────────────

export function ActivityLandingView({ landing }: { readonly landing: ActivityLanding }) {
  const others = activityIndex().filter((activity) => activity.slug !== landing.slug);

  return (
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

      <GymGrid gyms={landing.gyms} emptyKey="web.landing.activity.empty" />

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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The two hubs
// ─────────────────────────────────────────────────────────────────────────────

export function CitiesIndex() {
  const Place = icon.place;

  return (
    <HubPage
      title={t('web.landing.cities.title')}
      intro={t('web.landing.cities.intro')}
      entries={cityIndex().map((city) => ({
        key: city.slug,
        href: `/gyms/${city.slug}`,
        label: city.name,
        note: countLabel(city.count),
        Glyph: Place,
      }))}
    />
  );
}

export function ExploreIndex() {
  const Strength = icon.strength;

  return (
    <HubPage
      title={t('web.landing.explore.title')}
      intro={t('web.landing.explore.intro')}
      entries={activityIndex().map((activity) => ({
        key: activity.slug,
        href: `/explore/${activity.slug}`,
        label: activity.name,
        note: countLabel(activity.count),
        Glyph: Strength,
      }))}
    />
  );
}

function HubPage({
  title,
  intro,
  entries,
}: {
  readonly title: string;
  readonly intro: string;
  readonly entries: readonly {
    key: string;
    href: string;
    label: string;
    note: string;
    Glyph: (typeof icon)[keyof typeof icon];
  }[];
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
              className="gm-card gm-card-interactive group flex items-center gap-inline-md rounded-card p-inset-lg"
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
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared pieces
// ─────────────────────────────────────────────────────────────────────────────

function GymGrid({
  gyms,
  emptyKey,
}: {
  readonly gyms: readonly GymDetail[];
  readonly emptyKey: Parameters<typeof t>[0];
}) {
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
          <GymCard key={gym.id} gym={gym} />
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
