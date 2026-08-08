/**
 * `SCR-WEB-004` — compare. Server-rendered (`§C1.1`, `FR-SRCH-13`, ADR-0019).
 *
 * `app/` is routing only (`F1`): read the URL, hand it to the feature.
 */

import type { Metadata } from 'next';

import { t } from '../../src/shared/i18n/index.ts';
import type { RawParams } from '../../src/features/discovery/search.ts';
import { parseCompare } from '../../src/features/compare/compare.ts';
import { ComparePage } from '../../src/features/compare/compare-page.tsx';

export function generateMetadata({ searchParams }: { searchParams: RawParams }): Metadata {
  const { gyms } = parseCompare(searchParams);
  const names = gyms.map((gym) => gym.name).join(' vs ');

  return {
    title: names === '' ? `${t('web.compare.title')} · GymMap` : `${names} · GymMap`,
    description: t('web.compare.metaDescription'),
    /*
     * A comparison is a member's working document, not a page anyone should land on from a
     * search engine: the URL space is every subset of the catalogue up to size four, and each one
     * is thin, near-duplicate content assembled from pages that already rank on their own.
     *
     * `follow` stays on, because the links OUT of it — to each gym — are exactly what should be
     * crawled. This is the one surface on the site where `FR-SRCH-13` argues against indexing.
     */
    robots: { index: false, follow: true },
  };
}

export default function Compare({ searchParams }: { searchParams: RawParams }) {
  return <ComparePage selection={parseCompare(searchParams)} />;
}
