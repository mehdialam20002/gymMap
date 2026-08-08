/**
 * The order quote — `BR-PLN-03`, `FR-CART-04`, `MASTER_PRD.md` §A6.3, `LAUNCH_MARKET_INDIA.md` §11.
 *
 * ┌─ INVARIANT 3: THE PRICE DISPLAYED IS THE PRICE CHARGED ─────────────────────────────────────┐
 * │ `FR-CART-04` revalidates this quote on the server at checkout and ABORTS on a mismatch —     │
 * │ it does not quietly charge either figure. So this module exists to make one arithmetic, in   │
 * │ one place, that both sides run. Two implementations of the same sum is the mismatch.          │
 * │                                                                                              │
 * │ It is deliberately a PURE FUNCTION over integer paise with no clock, no environment and no   │
 * │ I/O, so the day the orders endpoint lands it moves to the server unchanged and the page       │
 * │ consumes the persisted figures instead. `§A6.3` is explicit that a figure on a settlement     │
 * │ statement is never recomputed at display time; a pre-purchase quote is the one moment the     │
 * │ arithmetic legitimately happens, because the order it will be persisted on does not exist    │
 * │ yet.                                                                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ EVERY LINE IS A `bigint` OF PAISE ─────────────────────────────────────────────────────────┐
 * │ Invariant 2. Not one `number`, not one division that is not `roundHalfEven`, and not one     │
 * │ rupee value anywhere in the module. `@gymmap/utils` owns the arithmetic — `multiplyByBps`    │
 * │ multiplies before it divides, and `allocate` splits so the parts sum EXACTLY to the whole,   │
 * │ which is what stops CGST + SGST differing from the tax by a paise.                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { allocate, multiplyByBps, sum } from '@gymmap/utils';

import { findGym } from '../discovery/search.ts';
import type { GymDetail, PlanSummary } from '../discovery/fixtures/catalogue.ts';
import type { RawParams } from '../discovery/search.ts';

/**
 * India's launch profile — `LAUNCH_MARKET_INDIA.md` §11 via `Admin.md`: GST 18%, levied as
 * CGST 9% + SGST 9%, EXCLUSIVE of the listed price.
 *
 * Basis points rather than a percentage: `0.18` is a float and 18% of ₹2,499 is where a float
 * starts costing paise. `1_800n` bps is exact and is the same unit the settlement tables use.
 */
export const TAX_BPS = 1_800n;

/** The two halves the tax is reported as. They must sum to the tax, which `allocate` guarantees. */
export const TAX_COMPONENTS = [
  { code: 'CGST', bps: 900n },
  { code: 'SGST', bps: 900n },
] as const;

export interface TaxComponent {
  readonly code: string;
  readonly bps: bigint;
  readonly amountMinor: bigint;
}

export interface Quote {
  /** The listed plan price. `G` in §A6.3. */
  readonly grossMinor: bigint;
  /** `D`. Always zero until coupons exist (`FR-CART-*`); present so the shape does not change. */
  readonly discountMinor: bigint;
  /** `N = G − D`. */
  readonly netMinor: bigint;
  /** `T = tax_profile(N)`. Exclusive, so it is ADDED to the net. */
  readonly taxMinor: bigint;
  /** CGST and SGST, summing exactly to `taxMinor`. */
  readonly taxComponents: readonly TaxComponent[];
  /** What the member pays: `N + T`. */
  readonly totalMinor: bigint;
}

/**
 * Prices one plan.
 *
 * No quantity, no proration and no renewal discount — none of those exist in the PRD's Phase 1
 * cart, and inventing one here would produce a total the server's revalidation refuses.
 */
export function quoteForPlan(plan: PlanSummary): Quote {
  const grossMinor = plan.priceMinor;
  const discountMinor = 0n;
  const netMinor = grossMinor - discountMinor;

  // Computed on the NET, and the components are then split out of that one figure rather than
  // each being computed from the net independently. Two independent 9% roundings can differ from
  // one 18% rounding by a paise, and a tax line that does not equal its own components is a
  // filing problem rather than a display problem.
  const taxMinor = multiplyByBps(netMinor, TAX_BPS);
  const shares = allocate(
    taxMinor,
    TAX_COMPONENTS.map((component) => component.bps),
  );
  const taxComponents = TAX_COMPONENTS.map((component, index) => ({
    code: component.code,
    bps: component.bps,
    amountMinor: shares[index] ?? 0n,
  }));

  return {
    grossMinor,
    discountMinor,
    netMinor,
    taxMinor,
    taxComponents,
    totalMinor: netMinor + taxMinor,
  };
}

/** The identity every quote must satisfy. Exported so the page and the suite check the same thing. */
export function quoteBalances(quote: Quote): boolean {
  return (
    quote.netMinor === quote.grossMinor - quote.discountMinor &&
    quote.totalMinor === quote.netMinor + quote.taxMinor &&
    sum(quote.taxComponents.map((component) => component.amountMinor)) === quote.taxMinor
  );
}

// ---------------------------------------------------------------------------
// What the URL names.
// ---------------------------------------------------------------------------

export interface CheckoutSelection {
  readonly gym: GymDetail | null;
  readonly plan: PlanSummary | null;
  readonly quote: Quote | null;
}

/** `/checkout?gym=<citySlug>/<gymSlug>&plan=<planId>` — the same key format compare uses. */
export function checkoutHref(
  gym: { citySlug: string; slug: string },
  plan: { id: string },
): string {
  const params = new URLSearchParams({ gym: `${gym.citySlug}/${gym.slug}`, plan: plan.id });
  return `/checkout?${params.toString()}`;
}

const first = (value: string | string[] | undefined): string | null => {
  if (value === undefined) return null;
  const single = Array.isArray(value) ? value[0] : value;
  return single === undefined || single.trim() === '' ? null : single.trim();
};

/**
 * Resolves a checkout out of the URL.
 *
 * A plan id that does not belong to the named gym resolves to NOTHING rather than to that plan.
 * Plan ids are unique across the catalogue today; accepting one without checking its gym is how
 * `?gym=cheap-gym&plan=<expensive-gym's-plan-id>` becomes a way to buy at the wrong price, and it
 * is the exact class of defect `FR-CART-04`'s server-side revalidation exists to catch. Catching
 * it here too means the member sees a coherent page instead of an abort.
 */
export function parseCheckout(params: RawParams): CheckoutSelection {
  const key = first(params['gym']);
  const planId = first(params['plan']);

  const slash = key === null ? -1 : key.indexOf('/');
  const gym =
    slash === -1 || key === null ? null : findGym(key.slice(0, slash), key.slice(slash + 1));
  const plan =
    gym === null ? null : (gym.plans.find((candidate) => candidate.id === planId) ?? null);

  return { gym, plan, quote: plan === null ? null : quoteForPlan(plan) };
}
