# plans

**Charter (`MASTER_PRD.md` §C1.3).** `plans, promotions, add-ons` — the sellable inventory.
Everything the marketplace shows and everything checkout charges originates here (`B5.5`).

---

## 1. Bounded context

Owns the answer to **"what does this plan cost, right now, and what does buying it entitle you
to"**. That is one decision, and it is invariant 3 of the whole system: _the price displayed is the
price charged_. `resolvePrice(plan, at, context) → PriceQuote` is the single function in the
repository that may turn a plan into money — pure, `Clock`-injected, no repository access, no I/O
(M-039). `discovery/`, `ordering/` and `billing/` reach it only through `PLAN_PRICING_PORT`; none of
them may compute a price, and none of them may reconstruct a `PriceQuote`, which has a private
constructor and no `fromJSON`. A `priceFingerprint()` — SHA-256 over
`(plan_id, price_minor, joining_fee_minor, promo_price_minor, promo_window, currency, plan_version)`
— is what makes `BR-PLN-03`'s checkout re-validation a comparison of two hashes rather than a
field-by-field diff someone will eventually get wrong.

The second owned decision is **entitlement shape**: `DURATION` versus `SESSION`, the access window,
the branch scope, the freeze and transfer allowances, stackability. `memberships/` and `attendance/`
consume those terms; they never redefine them. And the third is the plan lifecycle —
`DRAFT → PUBLISHED → ARCHIVED` — where `BR-PLN-04` makes archive the only exit and hard deletion
impossible while a membership references the row.

What this module deliberately does **not** own: the price a member actually paid. That is
`memberships.purchased_terms`, snapshotted at purchase, and it is authoritative over the `plans` row
absolutely (`BR-PLN-02`, `Schema.md` §6.1). A price change here is legal and expected; it simply has
no reach backwards.

## 2. PRD identifiers

| Class          | Identifiers                                                                                                                                                                                                           |
| :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional     | `FR-PLAN-01` … `FR-PLAN-09` (note the PRD spells the functional prefix `FR-PLAN-`, the rules `BR-PLN-`); `FR-SRCH-06` and `FR-DETL-03` are served by `monthlyEquivalent()` here                                       |
| Business rules | **`BR-PLN-01` … `BR-PLN-07`** — the module's whole reason to exist. `BR-PLN-03` is **invariant 3**; `BR-PLN-05` (staff-only never on a public surface) and `BR-PLN-07` (one active promotion) are enforced physically |
| Non-functional | `NFR-DQ-02` (money is integer minor units with an explicit ISO-4217 code — no `numeric`, no `float`), `NFR-USE-06` (the branch-scope confirmation must say what it is actually doing), `NFR-MNT-09`                   |
| State machine  | Not a `§C4` machine. `plan_status_enum` has four states and **three legal edges** (M-038); the machine is expressed once, in `domain/`                                                                                |
| `§C5` jobs     | **None owned.** See §8 — this is a design property, not a gap                                                                                                                                                         |
| Screens        | `SCR-DASH-005` (plan catalogue), `SCR-DASH-006` (plan editor, live preview, price confirmation)                                                                                                                       |
| Acceptance     | `AC-PLAN-01.1` … `-01.3` (promotion reverts itself), `AC-PLAN-02.1` … `-02.3` (price displayed = price charged)                                                                                                       |
| Epic           | `EP-05` — Plan Catalogue & Pricing Authority                                                                                                                                                                          |

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table           | Notes that matter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plans`         | Retention **R-FIN**, not R-OPS: an invoice line names a plan, and a dispute two years later must resolve it. `price_minor` / `joining_fee_minor` / `promo_price_minor` are `money_minor_nonneg` with an adjacent `currency`. `ck_plans__type_fields_present` makes the `DURATION`/`SESSION` discriminated union a database constraint, not only a Zod refinement. `visibility = 'STAFF_ONLY'` is **never** returned by a public API, and `idx_plans__gym_status_visibility` exists so the public query never has to filter it out after the fact. Soft-deleted — but the domain vocabulary is **archive**, not delete (`SD3`) |
| `plan_branches` | G-CRUD-D. **Open-world encoding: zero rows means all branches.** There is deliberately no `is_all_branches` boolean, because a boolean plus a list is two sources of truth, and under a closed-world reading _adding a new branch would silently un-sell every existing plan_. The consequence `NFR-USE-06` creates: removing the **last** row is a **widening**, not a narrowing, and the confirmation dialogue must say so in those words                                                                                                                                                                                   |
| `add_ons`       | Priced extras attached to a plan; `is_recurring` decides once-at-purchase versus per-renewal. Contributes to `G` in the `A6.3` figure set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

`ex_plans__one_active_promotion` is the physical form of `BR-PLN-07`:
`EXCLUDE USING gist (plan_id WITH =, tstzrange(promo_starts_at, promo_ends_at) WITH &&) WHERE (promo_price_minor IS NOT NULL)`.
A read-then-write check races under two concurrent editors; an exclusion constraint does not. The
`23P01` violation maps to `422 PROMOTION_OVERLAPS_EXISTING`, carrying the conflicting promotion's
label and dates so the owner can act (M-040).

**Not owned:** `memberships.purchased_terms` (→ `memberships/`), which overrides this table for any
membership already sold; `coupons` (→ `ordering/`), which are a discount on an order, not a price on
a plan.

**Delivering milestones:** M-037 (`plans`), M-038 (`plan_branches`, `add_ons`), M-040 (the exclusion
constraint).

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

`plans/` is not one of the four provider-only modules of `FolderStructure.md` §8.2, so
`controllers/`, `dto/` and `permissions.ts` are mandatory. It carries two audiences: the tenant plan
editor and one **public** controller, `GET /v1/gyms/:slug/plans` (`@Public()`, no tenant header,
scope `public`) — the public plan catalogue of `apis/Marketplace.md` §6 lives here rather than in
`discovery/`, because the price on it must come from the authority, not from a projection.

| Exported from `index.ts`         | Consumers                                                                | The question it answers                                                                                                                |
| :------------------------------- | :----------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| `PLAN_COMMAND_PORT`              | `onboarding/`                                                            | Wizard step 4 creates the first plan inside the application transaction (edge 10)                                                      |
| `PLAN_PRICING_PORT`              | `ordering/`                                                              | **Invariant 3.** The price is _fetched_, never trusted from the client; a mismatch aborts checkout (edge 14, `BR-PLN-03`, `BR-PAY-04`) |
| `PLAN_SUMMARY_PORT`              | `discovery/`, `billing/`                                                 | The "from ₹X" card price, and the line description on an invoice (edges 13, 32)                                                        |
| `PLAN_TERMS_PORT`                | `memberships/`                                                           | Freeze cap, stackability, access window, session allowance (edge 18, `BR-MEM-04`, `BR-MEM-05`, `BR-PLN-06`)                            |
| `ACCESS_WINDOW_PORT`             | `attendance/`                                                            | Check-in step 7: is the plan's access window satisfied — denial reason `OUTSIDE_PLAN_ACCESS_WINDOW` (edge 24)                          |
| `PublicPlanPredicate`            | the projection (M-042), the public catalogue, detail composition (M-050) | `status = 'PUBLISHED' AND visibility = 'PUBLIC' AND deleted_at IS NULL`, stated **once** so `BR-PLN-05` cannot be half-applied         |
| `plan.*` event payload **types** | `discovery/`, `notifications/`                                           | `E7`                                                                                                                                   |
| `plans.*` permission constants   | `iam/`'s `PermissionsGuard`; the dashboards via the generated client     |

Never exported: the `Plan` entity, the repositories, the DTOs, and **the implementation behind
`PLAN_PRICING_PORT`**. `index.ts` exports the token and the interface only (`ModuleDependency.md`
§7.1, M-039). Five ports on one L3 module is a lot; each exists because a different module needs a
different slice of the same aggregate, and giving them one fat port would let `attendance/` see a
price it has no business knowing.

Permission strings (`apis/Gym.md` §2.1 rows 24–30): `plans.plan.list`, `.create`, `.read`, `.update`,
`.publish`, `.archive`, `.duplicate`. `plans.plan.publish` is **owner-only** — a MANAGER may edit a
plan and may not put it on the marketplace.

There is deliberately **no `DELETE /v1/tenant/plans/:id`.** `BR-PLN-04` is enforced by the route's
absence; `PLAN_HAS_ACTIVE_MEMBERSHIPS` exists for a future bulk path that attempts one
(`apis/Gym.md` §1).

**Delivering milestones:** M-037 (`index.ts`, `PLAN_TERMS_PORT`), M-038 (`ACCESS_WINDOW_PORT`,
branch scope), M-039 (`PLAN_PRICING_PORT`, `PublicPlanPredicate`, the public catalogue route),
M-041 (the dashboard editor — see the BLK-05 note in §8).

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

| Provider   | Port                                                        | Why the answer must be synchronous                                                                                                                                                                   |
| :--------- | :---------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog/` | `BRANCH_QUERY_PORT`                                         | A plan's branch entitlement must reference branches that **exist and belong to the same gym** — a dangling `plan_branches` row is a plan that silently sells access to nothing (edge 4, `BR-PLN-06`) |
| `common/`  | `Money`, `Clock`, `IdGenerator`, outbox, the error registry | Universal edge. `Money` is the only arithmetic permitted on an amount; a lint rule forbids `number` for any field named like one                                                                     |
| `tenancy/` | `TenantContext`, the tenant-scoped Prisma client            | Universal edge                                                                                                                                                                                       |
| `audit/`   | `AUDIT_WRITE_PORT`                                          | `BR-DAT-01`: a price change is one of the most disputed facts in the system and is audited before/after                                                                                              |

`plans/ → iam/` is **`—`** in the `ModuleDependency.md` §4 matrix, which is worth noticing: this
module never asks who the actor is. Authorisation is the guard's job; the aggregate's job is the
invariant.

> **Conflict, recorded not resolved.** M-038 specifies
> `apps/server/src/plans/ports/plan-membership-count.port.ts` — the port `ArchivePolicy` consults for
> active and pending membership counts, with a Sprint-3 adapter returning zeroes and a real adapter
> "in Sprint 7". But `plans → memberships` is **`—`** in the §4 matrix (forbidden in both directions,
> upward L3→L4), so no adapter in `plans/infrastructure/` can legally obtain that count. Two things
> are also off in the file path itself: `ports/` at the module root is for interfaces the module
> **exports**, and a consumed interface belongs in `application/ports/` (`FolderStructure.md` §8).
> The zero-returning Sprint-3 adapter is consistent with the matrix; the Sprint-7 replacement is not,
> and needs an owner decision — most likely `memberships/` pushing a count via event, or the archive
> preview moving to `reporting/`. `BR-PLN-04` itself is already safe without it: the FK from
> `memberships` refuses the hard delete, and the route does not exist.

**Delivering milestones:** M-037, M-038, M-039.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

Every payload carries `tenant_id` and `occurred_at` and no personal datum (`E5`); the outbox row is
written inside the state-changing transaction (`E2`).

| Event                | Payload beyond the two universals                           | Known consumers                                                               |
| :------------------- | :---------------------------------------------------------- | :---------------------------------------------------------------------------- |
| `plan.published`     | `plan_id`, `gym_id`                                         | `discovery/`                                                                  |
| `plan.archived`      | `plan_id`, `gym_id`                                         | `discovery/`                                                                  |
| `plan.price-changed` | `plan_id`, `old_price_minor`, `new_price_minor`, `currency` | `discovery/`, `notifications/` (`FR-FAV-04` — a favourited gym changed price) |

All three carry **integer minor units**, never a formatted string and never a float. All three exist
for the same reason: the projection in `discovery/` must be invalidated within the 60-second budget,
and `notifications/` must be able to tell a member the old and new figure without importing this
module.

`plan.price-changed` is the event that makes `ALRT-19` interpretable. A burst of it during trading
hours is the expected precursor to a spike in `checkout_revalidation_total{outcome="ABORTED"}` —
which is `BR-PLN-03` **working**, not failing.

**Delivering milestones:** M-038 (`plan.published` / `.archived`), M-040 (`plan.price-changed` and
the promotion-window edge cases).

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

**None**, other than the platform-wide `config.changed` and `flag.changed` broadcasts from `admin/`
(idempotency keys `config_key` + `version` and `flag_key` + `version`).

That is a real property and it is worth stating why. `ModuleDependency.md` §8.2 lists fifty-two
domain events; not one names `plans/` as a consumer, and the §4 matrix column `pln` is `—` for every
other module. A plan changes because **an owner changed it**. Nothing downstream — not a sale, not a
refund, not a membership expiring — may reach back and alter what is on offer. If a future
requirement makes a plan react to a downstream fact, that is a boundary change requiring an
amendment, not a new handler.

**Delivering milestones:** n/a. The `config.changed` / `flag.changed` handler is the common broadcast
mechanism (M-116), not module-specific work.

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

**None.** No `§C5` job carries the `plans` queue in `Scalability.md` §8.3.1, and no BullMQ processor
is owned here.

The absence is deliberate and is the single most reusable idea in this module. `FR-PLAN-03` requires
promotional pricing to revert to list price automatically when its window ends, and
`AC-PLAN-01.1` requires it to happen _"without any action from me"_. The obvious implementation is a
scheduled job that writes `price_minor` back. That job would be wrong in three ways: it would mutate
a row at a moment nobody asked it to, it would be a source of drift if it ever failed or ran twice,
and it would make the effective price depend on scheduler health.

Instead, **reversion is a comparison, not a scheduled write** (M-040). `resolvePrice()` takes an
instant and returns `promo_price_minor` when the half-open window `[start, end)` contains it and
`price_minor` otherwise. The promotion ends because time passed, not because a worker woke up. There
is nothing to fall behind, nothing to alert on, and nothing to reconcile.

**Delivering milestones:** M-040 records the decision; there is no job to build.

> **Milestone-numbering caveat (`BLK-05`, open).** `PHASES.md` records that `roadmap/README.md` §5 and
> the `Milestones_*.md` detail files assign different work to the same ids. Every `M-NNN` cited in
> this README is from the **`Milestones_*.md` detail files** (the backend scheme). `M-041` is one of
> the ids the two schemes disagree about; treat its number as provisional until the owner declares
> which document is normative.

## 9. Top three failure modes (`NFR-MNT-09`)

Declared in `PROJECT_CONSTITUTION.md` §18.5.1.

|  #  | Failure mode                                  | Signal                                                                                                                                                                                                          | First action                                                                                                                                                                                                                                                                                                                                                                     |
| :-: | :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Promotional window failing to revert**      | `rate(checkout_revalidation_total{outcome="ABORTED", change_type="PRICE"})` spiking at a window boundary (**`ALRT-19`**, S2 at 2%, page above 10%); owners reporting the marketplace still shows an ended offer | Separate the two candidates immediately: is the **authority** wrong (`resolvePrice()` returning the promo price outside the window — a domain defect, hotfix) or is the **projection** stale (`search_documents.min_price_minor` not reindexed — `ALRT-36`, and a `discovery/` incident)? Checkout re-validating against `plans` means money is still correct in the second case |
|  2  | **Price change during an in-flight checkout** | The same `ALRT-19` metric, but spread across the day rather than clustered at a boundary                                                                                                                        | This is `BR-PLN-03` **working**. Aborting is the correct behaviour; the alert exists because a _rate_ means prices are moving under live customers. Group by tenant — one owner bulk-editing during trading hours explains it, and the fix is a product conversation about `AC-PLAN-02.2`'s re-confirmation flow, not a code change                                              |
|  3  | **Archive attempted with active memberships** | `PLAN_HAS_ACTIVE_MEMBERSHIPS` error rate above zero; owner reports that a plan will not archive                                                                                                                 | Confirm the affected-membership count the two-phase preview showed (`{confirm:false}` writes nothing and must echo the same block as `{confirm:true}`). `BR-PLN-04` permits archive and forbids hard delete — if the operation being refused is an archive rather than a delete, the policy is over-strict and that is the defect                                                |

**Runbook: [`/docs/runbooks/plans.md`](../../../../docs/runbooks/plans.md)** ·
owner **Backend Lead (plans)** · primary alert `ALRT-19` (`runbooks/plans.md` §Price stability).

This is the one module whose runbook filename is the **same** in `Monitoring.md` §9.6 and under
`FolderStructure.md` §8.3's `<module>.md` rule. No conflict here.
