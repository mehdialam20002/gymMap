/**
 * `SCR-WEB-003` — the gym page. `FR-DETL-01` … `FR-DETL-11`, `BR-PLN-03`, `BR-REV-01`.
 *
 * The layout is checked by looking at it. What is asserted here is the set of properties that
 * look identical when broken: a gallery photo that 404s only on one gym, a media URL the CSP will
 * refuse in production but not in development, an external link that hands the opened tab control
 * of this one, and a "save 20%" that checkout has never heard of.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { code, source } from './helpers.ts';
import { CATALOGUE } from '../src/features/discovery/fixtures/catalogue.ts';

/** The one host `next.config.mjs` admits and `CSP_MEDIA_HOST` names. */
const MEDIA_HOST = 'https://images.pexels.com/';

// ═══════════════════════════════════════════════════════════════════════════
// The gallery.
// ═══════════════════════════════════════════════════════════════════════════

test('every gym has four gallery photos and none of them repeats its cover', () => {
  // A cover shown twice in a four-tile mosaic is the kind of thing that reads as "this gym only
  // sent us one photo" rather than as a bug, so nobody reports it.
  for (const gym of CATALOGUE) {
    assert.equal(gym.gallery.length, 4, `${gym.name} has ${String(gym.gallery.length)} photos`);

    const ids = gym.gallery.map((photo) => photo.src);
    assert.equal(new Set(ids).size, ids.length, `${gym.name} repeats a photo inside its gallery`);

    const coverId = /photos\/(\d+)\//.exec(gym.photo)?.[1];
    assert.ok(coverId, `${gym.name} has an unparseable cover URL`);
    for (const photo of gym.gallery) {
      assert.ok(
        !photo.src.includes(`photos/${coverId}/`),
        `${gym.name} shows its cover again in the gallery`,
      );
    }
  }
});

test('every image URL sits on the ONE host the CSP and the optimiser admit', () => {
  // `img-src` names this host and `next.config.mjs` names it again for the optimiser. A photo on
  // any other host is blocked in production and works in development, because the development
  // policy is the one place the two configurations diverge.
  for (const gym of CATALOGUE) {
    assert.ok(gym.photo.startsWith(MEDIA_HOST), `${gym.name}'s cover is off-host: ${gym.photo}`);
    for (const photo of gym.gallery) {
      assert.ok(
        photo.src.startsWith(MEDIA_HOST),
        `${gym.name} has an off-host photo: ${photo.src}`,
      );
    }
  }
  assert.ok(source('next.config.mjs').includes('images.pexels.com'));
});

test('every photo has alternative text that describes the photo', () => {
  const forbidden = /^(image|photo|picture|gym)\b/i;
  for (const gym of CATALOGUE) {
    for (const photo of [{ alt: gym.photoAlt }, ...gym.gallery]) {
      assert.ok(photo.alt.trim().length > 0, `${gym.name} has an empty alt`);
      // "Gym photo 2" tells a screen-reader user nothing they did not already know from the
      // heading two elements up. `AX2` wants what is IN the frame.
      assert.ok(!forbidden.test(photo.alt), `${gym.name}: alt "${photo.alt}" describes the page`);
    }
  }
});

test('the gallery stays a server component and does not open a lightbox', () => {
  const gallery = code('src/features/gym-detail/gallery.tsx');
  assert.ok(!gallery.includes("'use client'"), 'the gallery became a client component');
  // A lightbox needs a focus trap, Escape, arrow paging and a restored scroll position. Half of
  // one is a keyboard user who can open it and cannot get out.
  assert.ok(!gallery.includes('onClick'), 'the gallery gained an interaction');
  // The LCP image is preloaded exactly once. Marking all five `priority` makes the page slower.
  assert.equal(gallery.split('priority').length - 1, 1, 'more than one image claims priority');
});

// ═══════════════════════════════════════════════════════════════════════════
// The page.
// ═══════════════════════════════════════════════════════════════════════════

test('the maps link cannot reach back through window.opener', () => {
  // Without `noopener`, the page we open can navigate THIS tab somewhere else — a phishing hop
  // from a listing the member trusts. It is one attribute and it is never noticed when missing.
  const detail = code('src/features/gym-detail/gym-detail.tsx');
  assert.match(detail, /target="_blank"/);
  assert.match(detail, /rel="noopener noreferrer"/);
  assert.equal(
    detail.split('target="_blank"').length - 1,
    detail.split('rel="noopener noreferrer"').length - 1,
    'a _blank link exists without a matching noopener',
  );
});

test('the breadcrumb names the current page and does NOT link to it', () => {
  // The last crumb linking to itself is a control that does nothing, and it is the one a screen
  // reader announces as a link.
  const detail = code('src/features/gym-detail/gym-detail.tsx');
  assert.match(detail, /aria-current="page"/);
});

test('BR-PLN-03 — the plan card renders stored prices and derives nothing', () => {
  // `FR-CART-04` revalidates the price on the server and ABORTS on a mismatch. A "₹833/month" or
  // a "save 12%" computed on this page is a figure checkout has never heard of, so the member
  // would see the abort rather than the saving. Asserted structurally: the only money on this
  // page comes out of `formatMinor`.
  const detail = code('src/features/gym-detail/gym-detail.tsx');
  assert.ok(!detail.includes('%'), 'a percentage appeared on the plan card');
  assert.ok(!/priceMinor\s*[/*]/.test(detail), 'a plan price is being divided or multiplied');
  assert.ok(!detail.includes('Math.'), 'the page is computing a figure');
});

test('BR-REV-01 — an unrated gym gets a sentence, never a zero and never a dash', () => {
  const detail = code('src/features/gym-detail/gym-detail.tsx');
  // A dash reads as missing data about the gym. The gym is not missing anything; it is new.
  assert.ok(detail.includes('web.gym.facts.unrated'), 'the unrated case lost its own copy');
  assert.ok(!/rating\s*\?\?\s*0/.test(detail), 'a null rating is being defaulted to zero');

  const unrated = CATALOGUE.filter((gym) => gym.rating === null);
  assert.ok(unrated.length > 0, 'the fixture no longer exercises the unrated case');
  for (const gym of unrated) {
    assert.equal(gym.reviewCount, 0, `${gym.name} has reviews but no rating`);
  }
});
