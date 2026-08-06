# ordering

> **Charter (`MASTER_PRD.md` §C1.3).** `ordering/` — _carts, orders, eligibility, coupons._
>
> **Milestone ids in this file are cited from `docs/roadmap/Milestones_030-059.md`.**
> `docs/roadmap/README.md` §5 assigns different ids to the same titles. That disagreement is
> **`BLK-05`, recorded OPEN in `PHASES.md`**, and it is not resolved here. Where an id is cited the
> milestone **title** is given with it, because the title is the stable reference until `BLK-05`
> closes.

---

## 1. Bounded context

`ordering/` owns the answer to _"what is this person being charged, and are they allowed to be
charged it at all"_. It is the only module permitted to compute the `A6.3` money figures of a sale
— `G → D → N → T → B → C` — and the only module permitted to write them onto an `orders` row. That
ownership is what makes invariant 3 enforceable: because the price is fetched from
`PLAN_PRICING_PORT` inside the order transaction and never accepted from a request body, there is no
second place in the system where a sale's price could be decided differently. `ordering/` also owns
coupon evaluation, and therefore owns the `funding_source → commission_base_minor` resolution that
`settlements/` later reads but must never re-derive (`BR-CPN-05`, `BR-FIN-04`, `ModuleDependency.md`
§11.3). It does **not** own whether money actually moved — that is `payments/` — nor whether a
membership exists — that is `memberships/`.

## 2. PRD identifiers

| Family                      | Identifiers                                                                                                                                                                                                       |
| :-------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional                  | `FR-CART-01` … `FR-CART-11` (`B5.9`) · `FR-CPN-01` … `FR-CPN-08` (`B5.17`) · `FR-REFR-01` … `FR-REFR-07` (`B5.18`, `S`/`C` priority — see §3)                                                                     |
| Business rules **owned**    | `BR-PLN-03` (invariant I3) · `BR-PAY-04` (invariant I3) · `BR-CPN-01` … `BR-CPN-05`                                                                                                                               |
| Business rules **co-owned** | `BR-PAY-03` (with `common/`) · `BR-PAY-09` (with `billing/`) · `BR-REF-01` (with `refunds/`) · `BR-MEM-04`, `BR-MEM-09` (with `memberships/`) · `BR-RFL-01` (with `crm/`) · `BR-WAL-01` (with `ledger/`, Phase 2) |
| Non-functional              | `NFR-MNT-01` (≥ 95% coverage on `domain/pricing/**`, the money-path floor) · `NFR-DQ-02` (currency adjacent to every amount) · `NFR-MNT-09` (§9)                                                                  |
| State machine               | **`§C4.2` Order** — `PENDING → AWAITING_PAYMENT → PAID`, with `FAILED`, `EXPIRED`, `CANCELLED`, `PARTIALLY_PAID` and `REFUNDED`                                                                                   |
| Background jobs             | **`§C5`** `order.expire`                                                                                                                                                                                          |
| API                         | `API-ORD` (`§C3.2`; `API_Catalog.md` §3.5 for the full row set, plus the `/tenant/orders*` and `/tenant/coupons*` rows in §3.9)                                                                                   |
| Screens                     | `SCR-WEB-005` Checkout · `SCR-WEB-007` Order Confirmation · `SCR-WEB-011` Orders & Invoices · `SCR-DASH-011` Sales & Orders · `SCR-DASH-012` Record Offline Sale · `SCR-DASH-016` Coupons                         |
| Acceptance                  | `AC-CART-01.*`, `AC-CART-02.*`, `AC-CPN-01.*`, `AC-PLAN-02.*` · `E2E-02`, `E2E-06`, `E2E-08`, `E2E-10`                                                                                                            |

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table                | `Schema.md` | Grants / retention                                                    | Why `ordering/` owns it                                                                                                                                                                                                                                                                            |
| :------------------- | :---------- | :-------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orders`             | §7.1        | G-CRUD + the §2.8.1 immutability trigger · R-FIN · **no soft delete** | The nine `A6.3` figures, `refund_policy_snapshot`, `tax_snapshot` and the globally-unique `idempotency_key` all land here. `trg_orders__freeze_money_after_paid` freezes every figure at `PAID`, with the single exception of `gateway_fee_minor` / `payable_to_gym_minor` moving once from `NULL` |
| `order_items`        | §7.2        | **G-APPEND** (no `DELETE` grant, even while `PENDING`) · R-FIN        | A removed line is a **new order**, because the idempotency key is on the order                                                                                                                                                                                                                     |
| `coupons`            | §7.3        | **HYBRID · P-HYBRID** · G-CRUD + soft delete                          | The discriminated RLS policy lets a tenant session _read_ a `PLATFORM` coupon and never write one; platform rows are written by `admin/` on the audited path                                                                                                                                       |
| `coupon_redemptions` | §7.3        | **G-APPEND** · R-FIN                                                  | `uq_coupon_redemptions__coupon_user_order` is how `BR-CPN-03`'s limits are enforced — by counting under a unique constraint, never read-then-write                                                                                                                                                 |

**Two assignments that are derived, not stated.** No document in `docs/` maps every table to a
module, so these two are recorded here as this module's reading and should be confirmed before the
milestone that creates them merges:

- **`attribution_events`** (`Schema.md` §4.11, G-APPEND, R-FIN). Assigned to `ordering/` because the
  writer named in the specification is `apps/server/src/ordering/application/services/attribution.service.ts`
  (M-052). `Schema.md` files the table under the _Tenancy & Identity_ group, which is a schema
  grouping and not a module assignment. **Open seam:** the write is triggered _"at first
  authenticated view from a discovery surface"_, and `ModuleDependency.md` §4 marks
  `discovery → ordering` as **—** in both directions. No document names the mechanism that carries
  the trigger. Flagged rather than invented.
- **`referrals`** (`Schema.md` §11.3, **IDENTITY**-scoped — no `tenant_id`). Assigned to `ordering/`
  on the strength of `BR-RFL-01`'s owner field (`ordering/` + `crm/`) and `ModuleDependency.md` §8.2
  naming `ordering/` as the publisher of `referral.qualified`. **It has no delivering milestone.**
  `Milestones_090-119.md` **R-M15** records `D-02` (referrals and wallet) as _taken_: _"referrals and
  wallet get no code at all"_, only the absence assertions of `BR-WAL-01-N1`.

`wallet_entries` (`BR-WAL-01`) is **not** an `ordering/` table — `ledger/` publishes
`wallet.credited` and owns the append-only store; `ordering/` only applies credit in the fixed
pricing sequence coupon → wallet → gateway, and that is Phase 2.

**Delivering milestones.** `M-051` _"`orders` and `order_items` — the nine `A6.3` figures and the
`C4.2` machine"_ · `M-054` _"`coupons`, `coupon_redemptions`, `Coupon.evaluate()` and the `BR-CPN-04`
cap"_. `attribution_events` arrives with `M-052` _"Server-side amount computation —
`OrderPricingService` and the snapshot set"_.

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

`ordering/` is **not** one of the four provider-only modules of `FolderStructure.md` §8.2. It has
`controllers/` (member-facing and tenant-facing, audience-prefixed) and therefore a mandatory
`permissions.ts`.

| Exported symbol                                                                                                                                | Kind                   | Consumers                                                                                                                                                                                                                                                                           | Authority                   |
| :--------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------- |
| `ORDER_SNAPSHOT_PORT` + `OrderSnapshotPort`                                                                                                    | Port token + interface | `memberships/` (edge 19 — purchased terms, `BR-REF-02`) · `refunds/` (edge 37 — the policy that applies is the stored one) · `billing/` (edge 30 — the invoice restates the order exactly) · `support/` (edge 45) · `reporting/` (edge 46) · `admin/` (edge 47)                     | `ModuleDependency.md` §3.2  |
| `ORDER_QUERY_PORT` + `OrderQueryPort`                                                                                                          | Port token + interface | `payments/` (edge 29 — the total an intent is created against) · `settlements/` (edge 43 — `coupon_funding_source` selects the commission base) · `reporting/`, `admin/`                                                                                                            | `ModuleDependency.md` §3.2  |
| `OrderCreatedPayload`, `OrderPaidPayload`, `OrderCancelledPayload`, `OrderExpiredPayload`, `CouponRedeemedPayload`, `ReferralQualifiedPayload` | **Types only**         | Every consumer in §6, so a handler can be typed without importing this module's domain (`ModuleDependency.md` §8.1 **E7**)                                                                                                                                                          | `FolderStructure.md` §9.2   |
| `ORDERING_PERMISSIONS`                                                                                                                         | Constant               | `iam/`'s `PermissionsGuard`; the `B3.2` matrix. Members: `ordering.order.create` · `.read` · `.list` · `.validate` · `.cancel` · `ordering.coupon.apply` · `.remove`. Tenant: `ordering.order.create_offline` · `.collect_balance` · `ordering.coupon.list` · `.create` · `.update` | `API_Catalog.md` §3.5, §3.9 |
| Read-model view types                                                                                                                          | Types only             | The same consumers; a view owned by `ordering/`, never the aggregate                                                                                                                                                                                                                | `FolderStructure.md` §3.4.3 |

**Never exported, and each for a named reason:** the `Order` aggregate and the `C4.2` machine
(`no-cross-module-domain` — a second module able to construct an `Order` is a second place a price
can be set); `PriceQuote` (it carries the `M-039` fingerprint and cannot be constructible from a
DTO — `BR-PLN-03`); `OrderRepository` and `CouponRepository` (`no-cross-module-repository`); every
`*.dto.ts`; every Prisma model or delegate.

**Delivering milestones.** `M-051` creates `index.ts`, `ordering.module.ts`, `permissions.ts`, this
README, `types/` and `ports/order-snapshot.port.ts` — the last _"declared here, consumed by
`memberships/` in Sprint 7"_.

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

| From       | Port                                                                                                                     | Why the answer must be synchronous                                                                                                                                                                                                                                                                                                                    |
| :--------- | :----------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plans/`   | `PLAN_PRICING_PORT`                                                                                                      | **Invariant 3.** The authoritative price and its fingerprint are resolved _inside_ the transaction that creates the order and again inside the one that creates the payment intent. An eventually-consistent price is a price that was correct at some other moment, which is precisely what `BR-PLN-03` forbids (edge 14; `BR-PAY-04`, `FR-CART-04`) |
| `catalog/` | `BRANCH_QUERY_PORT`, `GYM_STATUS_PORT`                                                                                   | An order against a suspended or unapproved gym must fail **before** a payment intent exists. Learning it from an event would mean the intent already exists (edge 15; `BR-GYM-01`)                                                                                                                                                                    |
| `crm/`     | `MEMBER_QUERY_PORT`                                                                                                      | `FR-CART-07` eligibility — age minimum, gender policy, existing relationship — is a precondition of the order, evaluated in the same transaction (edge 16)                                                                                                                                                                                            |
| `staff/`   | `STAFF_QUERY_PORT`                                                                                                       | Offline-sale attribution: `BR-PAY-09` requires a named, accountable human on every `PARTIALLY_PAID` order, and `collected_by_staff_id` is written in the same statement (edge 17; `FR-CART-09`, `SCR-DASH-012`)                                                                                                                                       |
| `common/`  | `Money`, `Result`, the error taxonomy, the `IdempotencyInterceptor`, the outbox port, `Clock`, `ReferenceDataRepository` | Universal edge. `BR-PAY-03`'s interceptor must run before the use case, not after                                                                                                                                                                                                                                                                     |
| `tenancy/` | `TenantContext`, `TenantGuard`, the tenant-scoped Prisma client                                                          | Universal edge. `A-01`: no repository touches the raw client                                                                                                                                                                                                                                                                                          |
| `audit/`   | `AUDIT_WRITE_PORT`                                                                                                       | Order creation is audited with the full computed breakdown (`BR-PAY-04` audit field)                                                                                                                                                                                                                                                                  |

**One matrix cell with no port behind it.** `ModuleDependency.md` §4 marks `ordering → iam` as **●**,
but §3.2 — which states _"If a port is not in this table, the edge does not exist"_ — declares no
`ordering → iam` row. Treated here as **no edge**: the buyer's identity reaches `ordering/` through
`crm/`'s `MEMBER_QUERY_PORT`. Raise it as a documentation defect rather than adding an import.

**Delivering milestones.** `M-052` wires `PLAN_PRICING_PORT` into `OrderPricingService`; `M-053`
_"`BR-PLN-03` re-validation as a state-machine guard → `422 PLAN_PRICE_CHANGED`"_ makes the second
resolution a **guard on the `C4.2` transition**, not a callable step — a transition registered
without its guard fails at module construction.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

Every payload additionally carries `tenant_id` and `occurred_at`, carries **no** personal datum
(`E5`, `BR-DAT-06`), and its outbox row is written **inside** the same interactive transaction as the
state change (`E2`, ADR-0017).

| Event                               | Payload beyond the common fields                                                                           | Known consumers                            | Notes                                                                                                                  |
| :---------------------------------- | :--------------------------------------------------------------------------------------------------------- | :----------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| `order.created`                     | `order_id`, `order_ref`, `plan_id`, `net_minor`, `currency`                                                | `notifications/`                           | `FR-CART-10` abandoned-checkout recovery reads from here; the reminder itself is Sprint 9                              |
| `order.paid`                        | `order_id`, `gross_minor`, `tax_minor`, `discount_minor`, `commission_base_minor`, `coupon_funding_source` | `ledger/`, `billing/`, `memberships/`      | The one payload that carries the resolved commission base, so `ledger/` never re-derives it (`BR-FIN-04`, `BR-CPN-05`) |
| `order.cancelled` / `order.expired` | `order_id`, `reason_code`                                                                                  | `memberships/`, `notifications/`           | `order.expired` is what releases the coupon hold downstream (`FR-CART-05`)                                             |
| `coupon.redeemed`                   | `coupon_id`, `order_id`, `discount_minor`, `funding_source`                                                | `ledger/`, `notifications/`                |                                                                                                                        |
| `referral.qualified`                | `referral_id`, `referrer_user_id`, `credit_minor`                                                          | `ledger/` (wallet entry), `notifications/` | **No Phase-1 code** — `D-02` is taken (§3)                                                                             |

**Delivering milestones.** `M-051` (`order.created`, `order.cancelled`/`.expired`) · the `order.paid`
emission lands with the `payment.captured` handler in the `M-057` … `M-059` chain · `M-054`
(`coupon.redeemed`).

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

A handler in `application/handlers/` imports **nothing** from the publishing module; the serialised
payload typed in `packages/types` is the entire contract, and `dependency-cruiser`'s
`handler-no-publisher-import` rule enforces it from the filename alone.

| Event              | Publisher   | Handler idempotency key  | What the handler does                                                                                                                                                                                                                                                                                    |
| :----------------- | :---------- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payment.captured` | `payments/` | `payment_id`             | Advances the order `AWAITING_PAYMENT → PAID` (`§C4.2`) and emits `order.paid`. **This handler is the reason `ordering/` must not import `payments/`:** `payments → ordering` is a legal downward edge, so the reverse import would close a genuine compile-time cycle (`ModuleDependency.md` §5.4, §9.2) |
| `payment.failed`   | `payments/` | `payment_id` + `attempt` | Records the attempt and leaves the order re-payable while unexpired (`FR-PAY-06`)                                                                                                                                                                                                                        |

**A discrepancy worth knowing about.** `ModuleDependency.md` §8.2's consumer column for
`payment.captured` lists `memberships/`, `billing/` and `ledger/` — not `ordering/`. §5.4 of the same
document names the file `ordering/application/handlers/payment-captured.handler.ts` explicitly, and
§8.2 declares its consumer column _informational_. The handler exists; the catalogue row is
incomplete.

**Delivering milestones.** `M-058` _"The webhook receiver — signature, dedup, replay, `§C4.3`,
durable-first `2xx`"_ creates the order-independent, idempotent handler set that these two are
dispatched from.

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

| `§C5` job      | Queue      | Class  | Schedule    | Conc |  Scope  | Lock key (`Scalability.md` §8.10 grammar) | Expected | Alert                                |
| :------------- | :--------- | :----: | :---------- | :--: | :-----: | :---------------------------------------- | :------- | :----------------------------------- |
| `order.expire` | `ordering` | **P1** | Every 5 min |  1   | `PL→TS` | `order.expire:platform:{5minBucket}`      | **3 s**  | **25 s**, or depth > 50 after 15 min |

Expiring stale `PENDING` orders past `expires_at` (30 minutes, `FR-CART-05`) and releasing their
coupon holds. Idempotent: a re-run finds nothing left past the threshold, and the `§C4.2` transition
guard makes `EXPIRED → EXPIRED` a non-transition. Consequence of falling behind, per
`Scalability.md` §8.3.2: _"stale `PENDING` orders hold coupon capacity against `total_limit`, so a
live coupon appears exhausted"_ — and the buyer is blocked from re-purchasing the same plan.

`data.retention-sweep` fans a child job into every owning module's queue, but **`ordering/` has no
child**: every table it owns is `R-FIN`, and `SoftDeleteStrategy.md` §11.2's `R-FIN` branch is a
deliberate no-op until FY 2034-35.

**Delivering milestone.** `M-051` ships `jobs/order-expire.processor.ts` with its lock, idempotency
and alert tests.

## 9. Top three failure modes (`NFR-MNT-09`)

These are `Epic_07.md` **D-07.16**'s three, with the signal each is actually detected by.

|  #  | Failure                                                                                                                                                            | Signal                                                                                                                                                                                  | First action                                                                                                                                                                                                                                     |
| :-: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **`order.expire` stalled** — coupon holds are never released, so a live campaign reports itself exhausted and buyers are blocked from re-purchasing                | `ALRT-20`: `queue_oldest_job_age_seconds{queue="ordering"}` past its 25 s envelope, or `queue_active_workers == 0` while `queue_depth > 0`. Corroborate with `order_expired_total` flat | Bull Board: is the queue paused, are workers alive? Then run the processor manually for the affected buckets before touching coupon rows by hand — the release is the job's job                                                                  |
|  2  | **Re-validation aborts spiking** (invariant I3) — prices are moving under live checkouts, so `422 PLAN_PRICE_CHANGED` is being returned correctly but constantly   | `ALRT-19`: `rate(checkout_revalidation_total{outcome="ABORTED"}[15m]) / rate(checkout_revalidation_total[15m]) > 0.02` for 15 m                                                         | Group by `change_type`. `PRICE` → a plan edit or a promotion-window boundary. `COUPON_EXHAUSTED` → a campaign at its cap. `PLAN_ARCHIVED` → an archive that should have been blocked. **Do not disable the guard** — aborting is the requirement |
|  3  | **Coupon exhausted earlier than expected** — the `total_limit` is reached ahead of the campaign's plan, or `redemption_count` has drifted from the redemption rows | `checkout_revalidation_total{change_type="COUPON_EXHAUSTED"}` rising, and a rate of `422 COUPON_LIMIT_REACHED` on `POST /orders/:orderRef/coupon`                                       | Reconcile `coupons.redemption_count` against `count(*)` on `coupon_redemptions` for that coupon. A gap means holds from expired orders were never released — which is failure mode 1 wearing a marketing costume                                 |

**Runbook:** `/docs/runbooks/ordering.md`
