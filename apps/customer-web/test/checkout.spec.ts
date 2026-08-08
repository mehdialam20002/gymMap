/**
 * `SCR-WEB-005` / `SCR-WEB-007` — the quote and what the flow promises.
 * `BR-PLN-03` (invariant 3), `BR-PAY-02` (invariant 5), `BR-FIN-01` (invariant 2).
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THREE INVARIANTS MEET ON THIS SCREEN, AND ALL THREE FAIL QUIETLY
 *
 *   2. A float in the tax line. Every total is off by paise, in a direction nobody notices
 *      until a settlement batch does not balance.
 *   3. A total the server would not agree with. `FR-CART-04` aborts on a mismatch, so the
 *      symptom is a member who cannot pay rather than a member who is overcharged — which is
 *      the right failure and still a failure.
 *   5. A page that says "payment successful". It teaches the member that the browser is what
 *      confirms a payment, and the whole point is that it is not.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { code } from './helpers.ts';
import { en } from '../src/shared/i18n/messages/en.ts';
import { CATALOGUE } from '../src/features/discovery/fixtures/catalogue.ts';
import { formatMinorExact } from '../src/features/discovery/search.ts';
import {
  TAX_BPS,
  TAX_COMPONENTS,
  checkoutHref,
  parseCheckout,
  quoteBalances,
  quoteForPlan,
} from '../src/features/checkout/quote.ts';

const EVERY_PLAN = CATALOGUE.flatMap((gym) => gym.plans.map((plan) => ({ gym, plan })));

// ═══════════════════════════════════════════════════════════════════════════
// Invariant 2 · integer paise, and the parts sum to the whole.
// ═══════════════════════════════════════════════════════════════════════════

test('every line of every quote is a bigint of paise', () => {
  for (const { gym, plan } of EVERY_PLAN) {
    const quote = quoteForPlan(plan);
    for (const [line, value] of Object.entries(quote)) {
      if (line === 'taxComponents') continue;
      assert.equal(typeof value, 'bigint', `${gym.name}/${plan.name}: ${line} is not a bigint`);
    }
    for (const component of quote.taxComponents) {
      assert.equal(typeof component.amountMinor, 'bigint', `${component.code} is not a bigint`);
    }
  }
});

test('every quote balances: net = gross − discount, total = net + tax, components = tax', () => {
  // The identity from `MASTER_PRD.md` §A6.3, asserted on real prices rather than on one example.
  for (const { gym, plan } of EVERY_PLAN) {
    const quote = quoteForPlan(plan);
    assert.ok(quoteBalances(quote), `${gym.name}/${plan.name} does not balance`);
  }
});

test('CGST and SGST sum EXACTLY to the tax, including where 18% lands on a half paise', () => {
  // Two independent 9% roundings can differ from one 18% rounding by a paise, and a tax line that
  // does not equal its own components is a filing problem rather than a display problem.
  // `1n` paise is the adversarial case: 18% of it is 0.18, and 9% twice is 0.09 twice.
  for (const netMinor of [1n, 3n, 5n, 7n, 11n, 49n, 99n, 1_49_900n, 2_49_900n, 21_99_900n]) {
    const quote = quoteForPlan({
      id: 'probe',
      name: 'probe',
      priceMinor: netMinor,
      durationDays: 30,
    });
    const parts = quote.taxComponents.reduce((total, c) => total + c.amountMinor, 0n);
    assert.equal(parts, quote.taxMinor, `components ≠ tax at ${String(netMinor)} paise`);
    assert.equal(quote.totalMinor, quote.netMinor + quote.taxMinor);
  }
});

test('the tax rate is basis points, not a percentage float', () => {
  // `0.18` is a float and 18% of ₹2,499 is where a float starts costing paise.
  assert.equal(typeof TAX_BPS, 'bigint');
  assert.equal(TAX_BPS, 1_800n);
  assert.equal(
    TAX_COMPONENTS.reduce((total, component) => total + component.bps, 0n),
    TAX_BPS,
    'the components do not add up to the rate they are components of',
  );
});

test('tax is EXCLUSIVE — the total is strictly more than the listed price', () => {
  // `LAUNCH_MARKET_INDIA.md` §11. An inclusive profile would make the total equal the plan price
  // and the whole breakdown a decoration.
  for (const { plan } of EVERY_PLAN) {
    const quote = quoteForPlan(plan);
    assert.ok(quote.totalMinor > quote.grossMinor, `${plan.name}: tax is not being added`);
    assert.equal(quote.totalMinor - quote.netMinor, quote.taxMinor);
  }
});

test('the quote module computes nothing else — no proration, no renewal discount', () => {
  // Anything this page invents is a figure the server's revalidation refuses, and the member
  // sees the abort rather than the offer.
  const quote = code('src/features/checkout/quote.ts');
  assert.ok(!/durationDays\s*[*/]/.test(quote), 'the quote is prorating by duration');
  assert.ok(!quote.includes('Number('), 'a bigint is being turned into a float');
  assert.ok(!/\bMath\./.test(quote), 'floating-point arithmetic reached the money path');
});

// ═══════════════════════════════════════════════════════════════════════════
// The URL, and the plan that does not belong to the gym.
// ═══════════════════════════════════════════════════════════════════════════

test('a checkout link round-trips to the same gym and plan', () => {
  for (const { gym, plan } of EVERY_PLAN) {
    const href = checkoutHref(gym, plan);
    const qs = new URLSearchParams(href.slice(href.indexOf('?') + 1));
    const parsed = parseCheckout(Object.fromEntries(qs));
    assert.equal(parsed.gym?.id, gym.id);
    assert.equal(parsed.plan?.id, plan.id);
    assert.equal(parsed.quote?.grossMinor, plan.priceMinor);
  }
});

test('a plan id belonging to ANOTHER gym resolves to nothing, not to that plan', () => {
  // Plan ids are unique across the catalogue today. Accepting one without checking its gym is how
  // `?gym=<cheap gym>&plan=<expensive gym's plan>` becomes a way to buy at the wrong price — the
  // exact class of defect `FR-CART-04`'s server-side revalidation exists to catch.
  const cheap = CATALOGUE.find((gym) => gym.plans.length > 0)!;
  const other = CATALOGUE.find((gym) => gym.id !== cheap.id && gym.plans.length > 0)!;

  const parsed = parseCheckout({
    gym: `${cheap.citySlug}/${cheap.slug}`,
    plan: other.plans[0]!.id,
  });
  assert.equal(parsed.gym?.id, cheap.id, 'the gym should still resolve');
  assert.equal(parsed.plan, null, "another gym's plan was accepted");
  assert.equal(parsed.quote, null, 'a quote was produced for a plan that is not on offer');
});

test('junk in the checkout URL produces an empty selection, not an exception', () => {
  for (const gym of ['', '   ', '/', 'mars/nowhere', '../../etc/passwd']) {
    const parsed = parseCheckout({ gym, plan: 'p-001' });
    assert.equal(parsed.plan, null, `"${gym}" produced a plan`);
  }
  assert.equal(parseCheckout({}).quote, null);
});

// ═══════════════════════════════════════════════════════════════════════════
// Invariants 3 and 5, as promises made on the screen.
// ═══════════════════════════════════════════════════════════════════════════

test('the breakdown ADDS UP on screen, to the paise', () => {
  // `formatMinor` drops the paise on purpose — nobody quotes a monthly fee to the paise. On a
  // breakdown that is a visible bug: 18% of ₹21,999 splits into two GST lines of ₹1,979.91, and
  // rounded down the column read 21,999 + 1,979 + 1,979 = 25,957 beside a total of ₹25,958.
  // A member checking the arithmetic on the screen where they are about to be charged found it
  // off by a rupee.
  const checkout = code('src/features/checkout/checkout.tsx');
  assert.ok(!/\bformatMinor\(/.test(checkout), 'the rounding formatter is back on the breakdown');
  assert.match(checkout, /formatMinorExact\(/);

  // And the exact formatter really does carry them.
  assert.equal(formatMinorExact(21_99_900n), '₹21,999.00');
  assert.equal(formatMinorExact(1_97_991n), '₹1,979.91');
});

test('the checkout page STATES that the total is revalidated server-side', () => {
  // The guarantee is worth nothing to a member who does not know it exists, and a marketplace
  // where the price moves between the listing and the card is what this product differentiates
  // against.
  assert.match(en['web.checkout.priceProof'], /server/i);
  assert.match(en['web.checkout.priceProof'], /stopped|abort|not.*charged/i);
  assert.match(code('src/features/checkout/checkout.tsx'), /web\.checkout\.priceProof/);
});

test('BR-PAY-02 — nothing in this flow announces a successful payment', () => {
  // Every product states webhook-driven activation as an engineering rule and then ships a page
  // saying "Payment successful!", which teaches the member that the BROWSER is the confirmation.
  // A lost connection then reads as a lost membership.
  const forbidden =
    /\b(payment successful|payment complete|you are now a member|order confirmed)\b/i;
  for (const [key, value] of Object.entries(en)) {
    if (!key.startsWith('web.confirmation.') && !key.startsWith('web.checkout.')) continue;
    assert.ok(
      !forbidden.test(value),
      `${key} announces a result the browser cannot know: "${value}"`,
    );
  }
  // And it says the opposite, explicitly.
  assert.match(en['web.confirmation.webhook.body'], /server/i);
  assert.match(en['web.confirmation.webhook.title'], /server/i);
});

test('the checkout surface ships no client state and takes no payment', () => {
  for (const file of [
    'src/features/checkout/checkout.tsx',
    'src/features/checkout/confirmation.tsx',
    'src/features/checkout/quote.ts',
  ]) {
    const text = code(file);
    assert.ok(!text.includes("'use client'"), `${file} became a client component`);
    assert.ok(!text.includes('fetch('), `${file} talks to something`);
    assert.ok(!text.includes('localStorage'), `${file} reaches for localStorage`);
  }
});

test('neither checkout page is offered to a search engine', () => {
  // A checkout is one member's transaction in progress. Unlike compare, its outbound links are
  // not worth crawling either.
  for (const route of ['app/checkout/page.tsx', 'app/checkout/confirmation/page.tsx']) {
    assert.match(code(route), /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/, route);
  }
});
