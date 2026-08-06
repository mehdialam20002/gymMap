# plans runbook

> **Status: stub.** `NFR-MNT-09` requires a runbook per module covering its top three failure modes.
> The three below are fixed by `PROJECT_CONSTITUTION.md` §18.5.1. The eight-field per-mode structure
> of `Monitoring.md` §9.1 — symptom, alert, blast radius, diagnose, mitigate, fix, verify, prevent —
> is filled in by the milestones named under **Dashboards and queries**; `RB2` requires every query
> here to have been **run**, and none can be before the tables exist.
>
> **No filename conflict here.** `Monitoring.md` §9.6 names this runbook `plans.md` and
> `FolderStructure.md` §8.3 row 9 requires `/docs/runbooks/<module>.md`. `plans/` is one of the few
> modules where the two documents already agree.

## Scope

`plans/` owns the sellable inventory — `plans`, `plan_branches`, `add_ons` — and, through them, the
single most consequential function in the codebase: **`resolvePrice(plan, at, context) → PriceQuote`**,
the only code permitted to turn a plan into money. It is pure, `Clock`-injected, and takes no
repository. `discovery/`, `ordering/` and `billing/` reach it only through `PLAN_PRICING_PORT` and
`PLAN_SUMMARY_PORT`; none of them may compute a price, and `PriceQuote` has a private constructor and
no `fromJSON` so none of them may reconstruct one. A `priceFingerprint()` — SHA-256 over
`(plan_id, price_minor, joining_fee_minor, promo_price_minor, promo_window, currency, plan_version)`
— makes `BR-PLN-03`'s checkout re-validation a comparison of two hashes rather than a field-by-field
diff someone eventually gets wrong. That rule is **invariant 3** of the whole system: *the price
displayed is the price charged*, and a mismatch **aborts** rather than silently charging either
figure.

The module also owns entitlement shape (`DURATION` versus `SESSION` as a database-enforced
discriminated union, access windows, branch scope, freeze and transfer allowances) and the plan
lifecycle `DRAFT → PUBLISHED → ARCHIVED`, where `BR-PLN-04` makes archive the only exit. It owns five
ports — `PLAN_COMMAND_PORT`, `PLAN_PRICING_PORT`, `PLAN_SUMMARY_PORT`, `PLAN_TERMS_PORT`,
`ACCESS_WINDOW_PORT` — and `PublicPlanPredicate`, and it consumes only `catalog/`'s
`BRANCH_QUERY_PORT` plus the universal `common/`, `tenancy/` and `audit/` edges. It owns **no `§C5`
job**, deliberately: promotional reversion is a comparison against `now()` inside `resolvePrice()`,
not a scheduled write, so there is nothing to fall behind and nothing to reconcile.

Two things it explicitly does **not** own. The price a member actually paid — that is
`memberships.purchased_terms`, snapshotted at purchase and authoritative over the `plans` row
absolutely (`BR-PLN-02`). And the figure the marketplace *shows* — that is
`search_documents.min_price_minor` in `discovery/`, a projection with a sixty-second freshness budget.
Telling those two apart is the first step in two of the three failure modes below.

**Blast radius when this module is down.** Nothing can be **bought**: `ordering/` cannot create an
order without a `PriceQuote`, so checkout fails closed — which is the correct direction, because the
alternative is charging an unverified amount. Search keeps working from the projection with the price
it last projected, and `BR-PLN-03`'s re-validation is exactly the control that stops that stale figure
becoming a charge. Existing memberships are unaffected: entitlement lives in `purchased_terms`, and
`attendance/` reads `ACCESS_WINDOW_PORT` for the access window only, so the door keeps opening.

**Kill switches** (`ADR-0026`). The plan editor and its live preview can be degraded. **Nothing on the
pricing path is flaggable**: `resolvePrice()`, the fingerprint, the `BR-PLN-03` re-validation guard and
the `BR-PLN-05` public-surface exclusion are invariants, and `CLAUDE.md` §9.7 forbids making money
rules feature-flag-disableable. There is also **no `DELETE /v1/tenant/plans/:id`** — `BR-PLN-04` is
enforced by the route's absence, not by a check that could be relaxed.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **1 — Promotional window failing to revert.** `rate(checkout_revalidation_total{outcome="ABORTED", change_type="PRICE"})` spiking **at a window boundary** (**`ALRT-19`**, S2 above 2% for 15 m). Symptom: owners report the marketplace still advertises an ended offer; buyers hit an abort at the last step of checkout | Either the **authority** is wrong — `resolvePrice()` returning `promo_price_minor` outside the half-open `[start, end)` window, most often an inclusive end comparison or a timezone applied on one side only — or the **projection** is stale, and `search_documents` simply has not been reindexed | Separate the two before anything else, because they are different incidents with different owners. Call `resolvePrice()` for the affected plan at `now()`: if it returns the promotional figure after the window closed, it is a **domain defect and a hotfix**. If it returns the list price, the authority is correct and the marketplace is showing a stale projection — that is `ALRT-36` and a `discovery/` incident. **Money is still correct in the second case**: checkout re-validates against `plans`, which is why the customer sees an abort rather than a wrong charge | Ticket to Backend Lead (plans) + Product; **page if the abort ratio exceeds 10%**. Gym-visible. A promotional window misfiring can abort *every* checkout at one tenant, so group by tenant early |
| **2 — Price change during an in-flight checkout.** The same `ALRT-19` metric, but **spread across the day** rather than clustered at a boundary. Symptom: buyers are told the price changed and are asked to re-confirm | This is `BR-PLN-03` **working**, not failing. Aborting is the specified behaviour. The alert exists because a sustained *rate* means prices are moving under live customers | Group `checkout_revalidation_total` by `change_type` first: `PRICE` is a plan edit or a promo boundary, `COUPON_EXHAUSTED` is a campaign hitting its cap (`ordering/`, not here), `PLAN_ARCHIVED` is an archive that should have been blocked, `ELIGIBILITY_LOST` is `crm/`. Then group `PRICE` by tenant — one owner bulk-editing during trading hours explains almost every occurrence. **Do not "fix" this by relaxing the guard**; the fix is a product conversation about `AC-PLAN-02.2`'s re-confirmation flow and about warning owners before they edit a live price | Ticket to Backend Lead (plans) + Product. Escalate only if the abort rate is spread across many tenants at once, which would indicate the *fingerprint* is unstable rather than the prices moving — a far more serious defect, because it would abort correct checkouts |
| **3 — Archive attempted with active memberships.** `PLAN_HAS_ACTIVE_MEMBERSHIPS` error rate above zero; an owner reports that a plan will not archive. Symptom: a plan the gym has stopped selling stays visible in the catalogue | The archive **preview** and the archive **commit** disagreed about the affected-membership count; or the policy is refusing an *archive* when `BR-PLN-04` only forbids a hard **delete**; or the count is being read through the Sprint-3 zero-returning adapter and something later replaced it inconsistently (see the `plans/` README §5 conflict note) | Confirm what is actually being refused. `BR-PLN-04` permits **archive** and forbids **hard delete** while any membership references the row; if the refused operation is an archive, the policy is over-strict and *that* is the defect. Then re-run the two-phase preview: `{confirm:false}` writes nothing and must echo the **same** affected-membership block as `{confirm:true}` — a divergence between the two is the bug, not the archive itself. There is no `DELETE` route to reach for | Ticket to Backend Lead (plans). Not gym-visible beyond the one owner, and never a page: nothing is charged wrongly and no membership is affected. Escalate to the Technical Lead only if the membership-count source is in question, because that is the unresolved `plans → memberships` boundary conflict and needs a `DECISION_LOG.md` entry rather than a patch |

## Dashboards and queries

_To be populated by **M-037** (the `plans` table and the type union), **M-038** (`plan_branches`,
`add_ons`, the status machine and the archive path), **M-039** (`resolvePrice()`, `PriceQuote` and the
fingerprint), **M-040** (promotional pricing and the `BR-PLN-07` exclusion constraint) and **M-041**
(the editor, the live preview and the price confirmation)._

Intended content, named now so those milestones have a target:

- **Panel — price stability.** `checkout_revalidation_total` split by `outcome`
  (`UNCHANGED` / `CHANGED_ACCEPTED` / `ABORTED`) and by `change_type`
  (`PRICE` / `COUPON_EXPIRED` / `COUPON_EXHAUSTED` / `PLAN_ARCHIVED` / `ELIGIBILITY_LOST`), with the
  `ALRT-19` 2% ticket line and 10% page line drawn. Overlay `plan.price-changed` event volume: a
  burst of that event is the **expected precursor** to an abort spike, and seeing the two together is
  what tells a responder the system is working rather than breaking.
- **Panel — promotion windows.** Promotions starting or ending in the next 24 hours, per tenant, and
  the abort rate in the ±15 minutes around each boundary. Failure mode 1 is a boundary phenomenon;
  a time series without the boundaries marked on it cannot show that.
- **Panel — catalogue composition.** Plans by `status` and `visibility`, per tenant, feeding the
  `BR-GYM-02` precondition that a gym has ≥1 published public plan. A tenant whose only `PUBLISHED`
  plans are `STAFF_ONLY` is invisible on the marketplace and will not know why.
- **Query — `STAFF_ONLY` absence contract.** The `BR-PLN-05` assertion from the *other* direction:
  every plan reachable through a public response path, checked to contain no row with
  `visibility = 'STAFF_ONLY'`, and the generated OpenAPI document checked to contain no
  `visibility` field on any public response schema at all. A client cannot be trusted to hide what it
  should never have received, and a serialisation change can re-open this without touching a query.
- **Query — projection versus authority.** For each plan, `resolvePrice()` at `now()` against
  `search_documents.lowest_monthly_equiv_minor` and `min_price_minor`. A non-empty result is either a
  reindex lag (`ALRT-36`, `discovery/`) or an authority defect (here), and the query is the fastest
  way to say which. This is the first step of failure mode 1, written down.
- **Query — overlapping promotions that should be impossible.** `BR-PLN-07` is enforced physically by
  `ex_plans__one_active_promotion`, a GiST exclusion constraint over
  `(plan_id, tstzrange(promo_starts_at, promo_ends_at))` where `promo_price_minor IS NOT NULL`. This
  query looks for overlaps anyway. It should always return zero rows; a non-zero result means the
  constraint was dropped by a migration, which is a much larger finding than the overlap itself.
- **Query — plans blocking archive.** Plans with an archive refusal, joined to the count of
  `ACTIVE` and `PENDING` memberships referencing them, so the preview figure and the commit figure
  can be compared side by side. This is the diagnostic for failure mode 3.
- **Query — money-column integrity.** Any `plans` money column that is not integer minor units with
  an adjacent ISO-4217 `currency`, per `NFR-DQ-02` and `DB2`. This should be structurally impossible
  (`money_minor_nonneg`), and the query exists to prove the domain kept it so after every migration.
- **Data recovery note.** `plans` is retention class **R-FIN**, not R-OPS: an invoice line names a
  plan and a dispute two years later must resolve it. Rows are **soft-deleted**, and the domain
  vocabulary is **archive**, never delete — so recovery is an unset of `deleted_at`, not a restore.
  A price is never "corrected in place" for a membership already sold: `memberships.purchased_terms`
  is the authority for anything already bought (`BR-PLN-02`), so a wrong historic price is fixed
  forward on the plan and left alone on the membership.

## Known incidents

_None yet._
