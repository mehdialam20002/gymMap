/**
 * The results view — `SCR-WEB-002`, `FR-SRCH-01` … `FR-SRCH-08`.
 *
 * ┌─ A SERVER COMPONENT, AND THE FILTERS ARE LINKS ─────────────────────────────────────────────┐
 * │ No `'use client'` anywhere in this file. Every control is an `<a>` to a different query      │
 * │ string, and the search box is a real GET `<form>` — so the page works before hydration,      │
 * │ works with JavaScript off, and every filtered view has a shareable, crawlable URL.           │
 * │                                                                                              │
 * │ That is what `FR-SRCH-13` is asking for. A filter panel built from `onChange` handlers       │
 * │ produces exactly one crawlable URL for the entire catalogue.                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ NO MODAL FILTER SHEET ON MOBILE, AND THAT IS THE DESIGN RATHER THAN THE SHORTFALL ─────────┐
 * │ The obvious mobile pattern is a "Filters" button opening a full-screen sheet. It needs       │
 * │ JavaScript to open at all, so on a phone with a slow connection — the exact visitor this     │
 * │ product is for — the filters are unreachable until the bundle lands.                          │
 * │                                                                                              │
 * │ Below `lg` each facet group instead becomes a horizontally scrolling row of chips: thumb-    │
 * │ reachable, one tap per filter with no open/apply/close round trip, and the count is visible  │
 * │ before the tap. Same DOM as the desktop sidebar, same links, no second copy for a crawler to │
 * │ index or a screen reader to read twice. `BP2` holds — the row scrolls inside its own         │
 * │ container, never the page.                                                                    │
 * │                                                                                              │
 * │ A sheet becomes worth building when the facet list is long enough that a chip row is a worse │
 * │ answer. With five groups it is not.                                                           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Link from 'next/link';

import type { MessageKey } from '../../shared/i18n/index.ts';
import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { GymCard } from './gym-card.tsx';
import { CITIES } from './fixtures/catalogue.ts';
import {
  EMPTY_QUERY,
  facets,
  formatMinor,
  hasActiveFilters,
  search,
  toSearchParams,
  type FacetOption,
  type SearchQuery,
  type Sort,
} from './search.ts';

const SORT_KEYS: Record<Sort, MessageKey> = {
  relevance: 'web.search.sort.relevance',
  'price-asc': 'web.search.sort.priceAsc',
  'price-desc': 'web.search.sort.priceDesc',
  rating: 'web.search.sort.rating',
  distance: 'web.search.sort.distance',
};

export function SearchResults({ query }: { readonly query: SearchQuery }) {
  const results = search(query);
  const groups = facets(query);

  return (
    /*
     * `gm-wrap` and the display face, so the results page and the page that sent you here are the
     * same product. The heading was `text-4xl` in the body face - correct before "Chalk & Iron",
     * and after it the one screen a member reaches from the hero looked like a different site.
     *
     * `gm-sec-tight` rather than `gm-sec`: a results page opens with its own controls, and 132px
     * of air above a search field reads as a page still loading.
     */
    <div className="gm-wrap gm-sec gm-sec-tight">
      <FixtureNotice />

      <p className="gm-eyebrow-k mt-[26px]">{t('web.search.eyebrow')}</p>
      <h1 className="gm-h2">
        {query.q === ''
          ? t('web.search.heading.any')
          : `${t('web.search.heading.query')} “${query.q}”`}
      </h1>
      {/*
       * `aria-live` on the COUNT and not on the list. A member changing a filter wants "6 gyms",
       * not six cards read out; the region is the smallest thing that answers "did that work".
       */}
      <p className="gm-lede" aria-live="polite">
        {results.length === 0
          ? t('web.search.count.none')
          : `${String(results.length)} ${
              results.length === 1 ? t('web.search.count.one') : t('web.search.count.many')
            }`}
      </p>

      <SearchForm query={query} />
      <ActiveFilters query={query} />

      {/*
       * ┌─ `minmax(0,1fr)` ON THE BASE TRACK TOO, NOT ONLY ON THE `lg` ONE ──────────────────────┐
       * │ The desktop template already said `minmax(0,1fr)` for the results column, and the      │
       * │ reason it says that is exactly the reason the base track needed it: an `auto` track     │
       * │ takes `min-content` as its MINIMUM, and a grid item's default `min-width: auto` lets    │
       * │ that minimum win over the container.                                                    │
       * │                                                                                        │
       * │ Below `lg` there was no template at all, so the single implicit track was `auto`.       │
       * │ Measured at 390px: the container was 358px and the track resolved to 1758px, so the     │
       * │ page scrolled sideways by 1400px on every phone. The filter rail's chip rows are what   │
       * │ set that min-content, and they have their own `overflow-x: auto` - which never got the  │
       * │ chance to scroll, because the track had already grown to fit them.                       │
       * │                                                                                        │
       * │ Horizontal scroll on a phone is the defect that hides best: the content still looks     │
       * │ right, and you only meet it by swiping.                                                 │
       * └────────────────────────────────────────────────────────────────────────────────────────┘
       */}
      <div className="mt-stack-lg grid grid-cols-[minmax(0,1fr)] gap-inline-xl lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Filters query={query} groups={groups} />

        <div className="min-w-0">
          <SortBar query={query} />

          {results.length === 0 ? (
            <EmptyState query={query} />
          ) : (
            /*
             * Two columns from `xl` only. The sidebar takes 17rem, so at `lg` a two-column grid
             * leaves each card around 300px — narrower than the phone layout, which is the point
             * at which a "wider screen" starts showing less.
             */
            <ul className="mt-stack-md grid gap-stack-md xl:grid-cols-2">
              {results.map((gym) => (
                <GymCard key={gym.id} gym={gym} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function FixtureNotice() {
  return (
    <p className="rounded-card border border-warning bg-surface-warning-subtle px-inset-md py-inset-sm text-base text-content-warning">
      {t('web.fixtureNotice')}
    </p>
  );
}

/** A real GET form. Preserves the other filters as hidden fields so searching does not reset them. */
function SearchForm({ query }: { query: SearchQuery }) {
  const Search = icon.search;

  return (
    <form
      action="/search"
      method="get"
      className="mt-stack-md flex max-w-form flex-wrap gap-inline-sm"
    >
      <label htmlFor="q" className="gm-visually-hidden">
        {t('web.search.field.label')}
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={query.q}
        placeholder={t('web.search.field.placeholder')}
        className="gm-search-slab min-w-0 flex-1 rounded-full border border-input bg-surface-raised px-inset-lg py-inset-sm text-md text-content placeholder:text-content-muted"
      />
      {/*
       * Every OTHER filter rides along as a hidden field. Without these, typing a new term
       * silently drops the city and price the member had already chosen — the form posts only
       * what it contains, and a GET form contains nothing it was not given.
       */}
      {query.city !== null && <input type="hidden" name="city" value={query.city} />}
      {/*
       * `radius` was missing from this list, and it is the one the HERO sets.
       *
       * A member picks "within 5 km" on the home page, lands here, types a term, and the distance
       * filter is silently gone - the form posts only what it contains, and this one did not
       * contain it. Every other filter was carried; the field added with `FR-SRCH-03` was not
       * added here with it.
       */}
      {query.radiusKm !== null && (
        <input type="hidden" name="radius" value={String(query.radiusKm)} />
      )}
      {query.category !== null && <input type="hidden" name="category" value={query.category} />}
      {query.amenity !== null && <input type="hidden" name="amenity" value={query.amenity} />}
      {query.maxPriceMinor !== null && (
        <input type="hidden" name="maxPrice" value={String(query.maxPriceMinor / 100n)} />
      )}
      {query.minRating !== null && (
        <input type="hidden" name="rating" value={String(query.minRating)} />
      )}
      {query.sort !== 'relevance' && <input type="hidden" name="sort" value={query.sort} />}
      <button type="submit" className="gm-btn gm-btn-amber">
        <Search aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
        {t('web.search.action')}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// What is currently narrowing the page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One removable chip per active filter, plus a clear-all.
 *
 * The facet panel already shows what is selected, and this row exists anyway: on a phone the
 * panel is a scrolling chip row three screens up by the time a member has read some results, so
 * "why am I seeing four gyms" has no answer visible. Stating the active set once, near the count
 * it explains, is the difference between a filter panel and a trap.
 */
function ActiveFilters({ query }: { query: SearchQuery }) {
  if (!hasActiveFilters(query)) return null;

  const chips: { key: string; label: string; href: string }[] = [];
  if (query.q !== '') {
    chips.push({
      key: 'q',
      label: `${t('web.search.filters.term')}: ${query.q}`,
      href: toSearchParams({ ...query, q: '' }),
    });
  }
  if (query.city !== null) {
    /*
     * The city's NAME, not its slug. The chip rendered `query.city` raw, so choosing "Bengaluru"
     * from the hero produced a chip reading "bengaluru" - and where a slug carries a hyphen it
     * would read "new-delhi". Every other chip on this row shows the label the reader picked; this
     * one showed the URL. The facet list already carries the pairing, so the lookup is a lookup.
     */
    const named = CITIES.find((city) => city.slug === query.city);
    chips.push({
      key: 'city',
      label: named?.name ?? query.city,
      href: toSearchParams({ ...query, city: null }),
    });
  }
  if (query.category !== null) {
    chips.push({
      key: 'category',
      label: query.category,
      href: toSearchParams({ ...query, category: null }),
    });
  }
  if (query.amenity !== null) {
    chips.push({
      key: 'amenity',
      label: query.amenity,
      href: toSearchParams({ ...query, amenity: null }),
    });
  }
  if (query.maxPriceMinor !== null) {
    chips.push({
      key: 'price',
      label: `${t('web.search.filters.price')} ${formatMinor(query.maxPriceMinor)}`,
      href: toSearchParams({ ...query, maxPriceMinor: null }),
    });
  }
  if (query.minRating !== null) {
    chips.push({
      key: 'rating',
      label: t('web.search.filters.ratingAndUp').replace('{rating}', query.minRating.toFixed(1)),
      href: toSearchParams({ ...query, minRating: null }),
    });
  }
  /*
   * The distance chip, which this row never had.
   *
   * Six filters had one and `radiusKm` did not - and it is the ONE filter the home page's hero can
   * set. A reader picks "Within 2 km", arrives here, and the catalogue is smaller for a reason with
   * no name on it and no way to undo it. `hasActiveFilters` was missing it too, so even the
   * "clear all" escape hatch was absent; both are fixed, and this is the half that names the cause.
   *
   * The string is the hero's own, deliberately. It is the same sentence the reader chose from, and
   * a second key holding the same phrase is two translations that have to agree forever.
   */
  if (query.radiusKm !== null) {
    chips.push({
      key: 'radius',
      label: t('web.home.hero.radiusWithin').replace('{km}', String(query.radiusKm)),
      href: toSearchParams({ ...query, radiusKm: null }),
    });
  }

  const Close = icon.close;

  return (
    <ul
      aria-label={t('web.search.filters.activeLabel')}
      className="mt-stack-md flex flex-wrap items-center gap-inline-xs"
    >
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            href={chip.href}
            className="gm-hit-target gm-tag gm-tag-on inline-flex items-center gap-inline-2xs"
          >
            {/*
             * The × is decorative and the accessible name says what the link does. "Bengaluru ×"
             * announced on its own is indistinguishable from the facet link that ADDS the filter,
             * two elements away on the same page.
             */}
            <span className="gm-visually-hidden">{t('web.search.filters.remove')}: </span>
            {chip.label}
            <Close aria-hidden="true" className="h-[0.875rem] w-[0.875rem]" />
          </Link>
        </li>
      ))}
      <li>
        {/* The sort survives a clear-all. It is a view preference, not a filter — resetting it
            would undo a choice the member did not ask to undo. */}
        <Link
          href={toSearchParams({ ...EMPTY_QUERY, sort: query.sort })}
          className="gm-hit-target inline-block rounded-control px-inset-sm py-inset-2xs gm-card-add text-sm font-semibold"
        >
          {t('web.search.filters.clearAll')}
        </Link>
      </li>
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Facets
// ─────────────────────────────────────────────────────────────────────────────

function Filters({ query, groups }: { query: SearchQuery; groups: ReturnType<typeof facets> }) {
  return (
    <aside
      aria-label={t('web.search.filters.label')}
      // Tighter below `lg`: five chip rows at desktop rhythm push the first result a full screen
      // down on a phone, and the rows are already visually separated by their own headings.
      className="gm-filter-rail flex min-w-0 flex-col gap-stack-sm lg:gap-stack-lg lg:self-start"
    >
      <FacetGroup
        title="web.search.filters.city"
        anyLabel="web.search.filters.anyCity"
        anyHref={toSearchParams({ ...query, city: null })}
        anyActive={query.city === null}
        options={groups.city}
      />
      <FacetGroup
        title="web.search.filters.activity"
        anyLabel="web.search.filters.anyActivity"
        anyHref={toSearchParams({ ...query, category: null })}
        anyActive={query.category === null}
        options={groups.category}
      />
      <FacetGroup
        title="web.search.filters.price"
        anyLabel="web.search.filters.anyPrice"
        anyHref={toSearchParams({ ...query, maxPriceMinor: null })}
        anyActive={query.maxPriceMinor === null}
        options={groups.price}
      />
      <FacetGroup
        title="web.search.filters.rating"
        anyLabel="web.search.filters.anyRating"
        anyHref={toSearchParams({ ...query, minRating: null })}
        anyActive={query.minRating === null}
        options={groups.rating}
      />
      <FacetGroup
        title="web.search.filters.facilities"
        anyLabel="web.search.filters.anyFacility"
        anyHref={toSearchParams({ ...query, amenity: null })}
        anyActive={query.amenity === null}
        options={groups.amenity}
      />
    </aside>
  );
}

function FacetGroup({
  title,
  anyLabel,
  anyHref,
  anyActive,
  options,
}: {
  title: MessageKey;
  anyLabel: MessageKey;
  anyHref: string;
  anyActive: boolean;
  options: readonly FacetOption[];
}) {
  return (
    <div>
      <h2 className="text-base font-semibold text-content">{t(title)}</h2>
      {/*
       * A ROW that scrolls below `lg`, a column at `lg` and up. One list, two layouts — the
       * mobile pattern is not a second component with its own copy of the links.
       *
       * `-mx-inset-md px-inset-md` bleeds the scroll container to the page edge so the last chip
       * does not appear clipped by an invisible boundary, which is the usual tell that a row
       * scrolls at all.
       */}
      <ul className="gm-scroll-row mt-stack-xs -mx-inset-md flex gap-inline-xs overflow-x-auto px-inset-md pb-inset-2xs lg:mx-0 lg:flex-col lg:gap-stack-2xs lg:overflow-visible lg:px-0 lg:pb-0">
        <li className="shrink-0">
          <Facet href={anyHref} active={anyActive} label={t(anyLabel)} />
        </li>
        {options.map((option) => (
          <li key={option.value} className="shrink-0">
            <Facet
              href={option.href}
              active={option.selected}
              label={option.label}
              count={option.count}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Facet({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}) {
  /*
   * An option that would return nothing is shown, greyed, and NOT linked.
   *
   * Hiding it makes the panel change shape as a member filters, so an option they used a moment
   * ago vanishes and reads as a bug. Linking it promises results and delivers an empty page.
   * Present-but-unavailable is the honest third answer, and `aria-disabled` says it to a screen
   * reader — which a colour change alone does not (`AX8`).
   */
  const unavailable = count === 0 && !active;

  const shared =
    'gm-hit-target flex items-center justify-between gap-inline-sm rounded-control px-inset-sm py-inset-xs text-base';

  if (unavailable) {
    return (
      <span aria-disabled="true" className={`${shared} cursor-default text-content-disabled`}>
        {label}
        <FacetCount count={count} />
      </span>
    );
  }

  return (
    <Link
      href={href}
      // `aria-current` and not colour alone. A filter whose only "on" signal is a background
      // tint is invisible to a screen reader and to anyone who cannot distinguish it (AX2).
      {...(active ? { 'aria-current': 'true' as const } : {})}
      className={`${shared} transition-colors duration-fast ease-standard ${
        active
          ? 'gm-pick-on font-semibold'
          : 'text-content-secondary hover:bg-surface-sunken hover:text-content'
      }`}
    >
      {label}
      <FacetCount count={count} />
    </Link>
  );
}

/**
 * The count is `aria-hidden`.
 *
 * "Bengaluru 3" read aloud is ambiguous — three what, and is the 3 part of the name? The number
 * is a scanning aid for a sighted member deciding where to click; a screen-reader user gets the
 * result count announced by the live region after the navigation, which is the same information
 * at the moment it is actually true.
 */
/**
 * The count beside a facet.
 *
 * `muted` used to select `content-disabled`, which measures 3.17:1 in the dark theme and 2.56:1 in
 * the light one - under `SC 1.4.3`'s 4.5 for text a member reads to decide whether a filter is
 * worth tapping. The colour was also carrying information the NUMBER already carries: a facet with
 * nothing behind it says so by being a zero, and does not need to be hard to read as well.
 *
 * `muted` still exists because the caller's own state depends on it; it no longer changes the ink.
 */
function FacetCount({ count }: { count: number | undefined }) {
  if (count === undefined) return null;
  return (
    <span aria-hidden="true" className="text-sm tabular-nums text-content-muted">
      {count}
    </span>
  );
}

function SortBar({ query }: { query: SearchQuery }) {
  return (
    /*
     * `py-inset-2xs` on the phone layout, not `pb-inset-sm` alone.
     *
     * `overflow-x-auto` makes this a scroll container below `sm`, and a scroll container clips at
     * its PADDING box - so the `gm-hit-target` expansion on each sort link was cut at the top,
     * where there was no padding at all, leaving about 33px of reachable height against AX3's 44.
     * Padding on both blocks sides gives the grown target somewhere to grow into. Above `sm` the
     * row is `overflow-visible` and nothing was ever clipped, which is why this only bit the phone.
     */
    <div className="gm-scroll-row -mx-inset-md flex items-center gap-inline-xs overflow-x-auto border-b border-subtle px-inset-md py-inset-sm sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pt-0">
      <span className="shrink-0 text-sm font-medium text-content-muted">
        {t('web.search.sort.label')}
      </span>
      {(Object.keys(SORT_KEYS) as Sort[]).map((sort) => (
        <Link
          key={sort}
          href={toSearchParams({ ...query, sort })}
          {...(query.sort === sort ? { 'aria-current': 'true' as const } : {})}
          className={`gm-hit-target shrink-0 rounded-control px-inset-sm py-inset-2xs text-sm transition-colors duration-fast ease-standard ${
            query.sort === sort
              ? 'gm-pick-on font-semibold'
              : 'text-content-secondary hover:text-content'
          }`}
        >
          {t(SORT_KEYS[sort])}
        </Link>
      ))}
    </div>
  );
}

/**
 * The empty state offers a way out, rather than only reporting failure.
 *
 * A member who filtered themselves into nothing needs the filter that did it removed, not an
 * apology. This is also the state most likely to be wrong once real data arrives, which is why
 * the fixture deliberately contains cities with one gym.
 */
function EmptyState({ query }: { query: SearchQuery }) {
  const relaxations = [
    query.minRating !== null && {
      label: t('web.search.empty.dropRating'),
      href: toSearchParams({ ...query, minRating: null }),
    },
    query.maxPriceMinor !== null && {
      label: t('web.search.empty.raisePrice'),
      href: toSearchParams({ ...query, maxPriceMinor: null }),
    },
    query.amenity !== null && {
      label: `${t('web.search.empty.removeFacility')}: ${query.amenity}`,
      href: toSearchParams({ ...query, amenity: null }),
    },
    query.category !== null && {
      label: `${t('web.search.empty.removeCategory')}: ${query.category}`,
      href: toSearchParams({ ...query, category: null }),
    },
    query.city !== null && {
      label: t('web.search.empty.everyCity'),
      href: toSearchParams({ ...query, city: null }),
    },
    /*
     * The distance radius, which was the one filter missing from this list.
     *
     * It is also the one the home page's hero can set, so the commonest route into an empty result
     * set was the route the escape hatch did not cover: the panel offered to discard the city or
     * the price a member had chosen deliberately, and not the radius that had actually emptied it.
     * Third and last place this omission hid - `hasActiveFilters` and the chip row were the others.
     */
    query.radiusKm !== null && {
      label: t('web.search.empty.anyDistance'),
      href: toSearchParams({ ...query, radiusKm: null }),
    },
    query.q !== '' && {
      label: t('web.search.empty.clearTerm'),
      href: toSearchParams({ ...query, q: '' }),
    },
  ].filter((entry): entry is { label: string; href: string } => entry !== false);

  return (
    <div className="gm-card mt-stack-md rounded-card p-inset-lg">
      <h2 className="text-lg font-semibold text-content">{t('web.search.empty.title')}</h2>
      <p className="mt-stack-2xs max-w-prose text-base text-content-secondary">
        {t('web.search.empty.body')}
      </p>

      {relaxations.length > 0 && (
        <ul className="mt-stack-md flex flex-wrap gap-inline-sm">
          {relaxations.map((relaxation) => (
            <li key={relaxation.label}>
              <Link
                href={relaxation.href}
                className="gm-hit-target inline-block rounded-control border border-subtle bg-surface px-inset-sm py-inset-xs text-base text-content-secondary transition-colors duration-fast ease-standard hover:border-strong hover:text-content"
              >
                {relaxation.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
