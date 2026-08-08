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
 */

import Link from 'next/link';

import { t } from '../../shared/i18n/index.ts';
import { CATEGORIES, CITIES } from './fixtures/catalogue.ts';
import { GymCard } from './gym-card.tsx';
import { search, toSearchParams, type SearchQuery, type Sort } from './search.ts';

const SORT_KEYS: Record<Sort, Parameters<typeof t>[0]> = {
  relevance: 'web.search.sort.relevance',
  'price-asc': 'web.search.sort.priceAsc',
  'price-desc': 'web.search.sort.priceDesc',
  rating: 'web.search.sort.rating',
  distance: 'web.search.sort.distance',
};

export function SearchResults({ query }: { readonly query: SearchQuery }) {
  const results = search(query);

  return (
    <div className="mx-auto max-w-container px-inset-md py-region-sm">
      <FixtureNotice />

      <h1 className="mt-stack-lg text-3xl font-bold tracking-tight text-content">
        {query.q === ''
          ? t('web.search.heading.any')
          : `${t('web.search.heading.query')} “${query.q}”`}
      </h1>
      <p className="mt-stack-2xs text-base text-content-secondary" aria-live="polite">
        {results.length === 0
          ? t('web.search.count.none')
          : `${String(results.length)} ${
              results.length === 1 ? t('web.search.count.one') : t('web.search.count.many')
            }`}
      </p>

      <SearchForm query={query} />

      <div className="mt-stack-lg grid gap-inline-xl lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Filters query={query} />

        <div className="min-w-0">
          <SortBar query={query} />

          {results.length === 0 ? (
            <EmptyState query={query} />
          ) : (
            <ul className="mt-stack-md flex flex-col gap-stack-md">
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
        className="min-w-0 flex-1 rounded-control border border-input bg-surface px-inset-md py-inset-sm text-md text-content placeholder:text-content-muted"
      />
      {query.city !== null && <input type="hidden" name="city" value={query.city} />}
      {query.category !== null && <input type="hidden" name="category" value={query.category} />}
      {query.sort !== 'relevance' && <input type="hidden" name="sort" value={query.sort} />}
      <button
        type="submit"
        data-on-solid="true"
        className="gm-hit-target rounded-control bg-brand-solid px-inset-lg py-inset-sm text-md font-semibold text-content-on-brand hover:bg-brand-solid-hover"
      >
        {t('web.search.action')}
      </button>
    </form>
  );
}

function Filters({ query }: { query: SearchQuery }) {
  return (
    <aside aria-label={t('web.search.filters.label')} className="flex flex-col gap-stack-lg">
      <FacetGroup
        title={t('web.search.filters.city')}
        anyLabel={t('web.search.filters.anyCity')}
        options={CITIES.map((city) => ({
          label: `${city.name} (${String(city.count)})`,
          value: city.slug,
        }))}
        selected={query.city}
        hrefFor={(value) => toSearchParams({ ...query, city: value })}
      />
      <FacetGroup
        title={t('web.search.filters.activity')}
        anyLabel={t('web.search.filters.anyActivity')}
        options={CATEGORIES.map((category) => ({ label: category, value: category }))}
        selected={query.category}
        hrefFor={(value) => toSearchParams({ ...query, category: value })}
      />
    </aside>
  );
}

function FacetGroup({
  title,
  anyLabel,
  options,
  selected,
  hrefFor,
}: {
  title: string;
  anyLabel: string;
  options: ReadonlyArray<{ label: string; value: string }>;
  selected: string | null;
  hrefFor: (value: string | null) => string;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold text-content">{title}</h2>
      <ul className="mt-stack-xs flex flex-col gap-stack-2xs">
        <li>
          <Facet href={hrefFor(null)} active={selected === null} label={anyLabel} />
        </li>
        {options.map((option) => (
          <li key={option.value}>
            <Facet
              // Clicking the active facet clears it, which is what a member expects from a
              // toggle. Two clicks to undo one is the commonest complaint about filter panels.
              href={hrefFor(selected === option.value ? null : option.value)}
              active={selected === option.value}
              label={option.label}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Facet({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      // `aria-current` and not colour alone. A filter whose only "on" signal is a background
      // tint is invisible to a screen reader and to anyone who cannot distinguish it (AX2).
      {...(active ? { 'aria-current': 'true' as const } : {})}
      className={`gm-hit-target block rounded-control px-inset-sm py-inset-xs text-base ${
        active
          ? 'bg-surface-brand-subtle font-semibold text-content-brand'
          : 'text-content-secondary hover:bg-surface-sunken hover:text-content'
      }`}
    >
      {label}
    </Link>
  );
}

function SortBar({ query }: { query: SearchQuery }) {
  return (
    <div className="flex flex-wrap items-center gap-inline-xs border-b border-subtle pb-inset-sm">
      <span className="text-sm font-medium text-content-muted">{t('web.search.sort.label')}</span>
      {(Object.keys(SORT_KEYS) as Sort[]).map((sort) => (
        <Link
          key={sort}
          href={toSearchParams({ ...query, sort })}
          {...(query.sort === sort ? { 'aria-current': 'true' as const } : {})}
          className={`gm-hit-target rounded-control px-inset-sm py-inset-2xs text-sm ${
            query.sort === sort
              ? 'bg-surface-brand-subtle font-semibold text-content-brand'
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
    query.category !== null && {
      label: `${t('web.search.empty.removeCategory')}: ${query.category}`,
      href: toSearchParams({ ...query, category: null }),
    },
    query.city !== null && {
      label: t('web.search.empty.everyCity'),
      href: toSearchParams({ ...query, city: null }),
    },
    query.q !== '' && {
      label: t('web.search.empty.clearTerm'),
      href: toSearchParams({ ...query, q: '' }),
    },
  ].filter((entry): entry is { label: string; href: string } => entry !== false);

  return (
    <div className="mt-stack-md rounded-card border border-subtle bg-surface-sunken p-inset-lg">
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
                className="gm-hit-target inline-block rounded-control border border-subtle px-inset-sm py-inset-xs text-base text-content-secondary hover:text-content"
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
