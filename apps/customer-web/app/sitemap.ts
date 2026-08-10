/**
 * `/sitemap.xml` — it returned 404, so the landing pages `FR-SRCH-13` exists to create were
 * discoverable only by following internal links from the home page.
 *
 * `app/` is routing only (`F1`): `indexablePaths()` decides what belongs here, next to the reasons
 * each excluded route is excluded.
 *
 * NO `lastModified`. Every entry would carry the same build timestamp, which tells a crawler that
 * all forty pages changed at once, every deploy, forever - and a sitemap that cries wolf is
 * ignored on exactly the deploy where something did change. The field returns when the listings
 * have a real `updated_at` behind them.
 *
 * NO `priority` and no `changeFrequency` either. Google has said publicly it ignores both, and a
 * hand-assigned priority is a number nobody can ever verify.
 */

import type { MetadataRoute } from 'next';

import { absolute, indexablePaths } from '../src/shared/seo/site.ts';

export default function sitemap(): MetadataRoute.Sitemap {
  return indexablePaths().map((path) => ({ url: absolute(path) }));
}
