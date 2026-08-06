# ordering runbook

> **`NFR-MNT-09`** — every module carries a runbook naming its top failure modes, the signal each is
> detected by, the first action, and where it escalates. Companion to
> `apps/server/src/ordering/README.md` §9.
>
> **No code exists in `ordering/` yet.** The failure modes, signals and first actions below are
> derived from `Monitoring.md` §3.5 and §5, `Scalability.md` §8.3, and `Epic_07.md` **D-07.16**. The
> dashboards and queries that make them executable arrive with the milestones named in
> **Dashboards and queries**.

---

## Scope

`ordering/` converts intent into a priced, server-computed order and holds it there until money
either arrives or does not. It owns `orders`, `order_items`, `coupons` and `coupon_redemptions`;
it computes the `A6.3` figures `G → D → N → T → B → C` and freezes them at `PAID`; it evaluates
eligibility (`FR-CART-07`) and coupons (`BR-CPN-01` … `BR-CPN-05`); and it runs `order.expire` every
five minutes to release the coupon holds of abandoned checkouts. Operationally it sits on two
invariants: **invariant 3** — the price displayed is the price charged, with a mismatch aborting
rather than silently charging either figure — and the half of **`BR-PAY-03`** that lives in the
`orders (idempotency_key)` unique index. It does **not** own whether money moved (`payments/`),
whether a membership exists (`memberships/`), or what the invoice says (`billing/`); an incident that
looks like ordering but is really one of those three is common enough to be worth checking first.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **`ALRT-20`** — `queue_oldest_job_age_seconds{queue="ordering"}` past its **25 s** envelope, `queue_depth{queue="ordering"} > 50` for 15 min, or `queue_active_workers == 0` while depth > 0. Corroborating: `order_expired_total` flat across several 5-minute buckets | `order.expire` stalled. Worker tier down or scaled to zero; the queue paused in Bull Board; a poisoned job re-queued in a loop; or Redis pressure (`ALRT-35`) starving the BullMQ keyspace | Bull Board (`A-30`, admin-only): is the queue paused, are workers alive, is one job type dominating? Restart or unpause, then let the processor drain its buckets. **Do not release coupon holds by hand** — releasing them is the job's job, and a manual `UPDATE` on `orders` collides with the §2.8.1 immutability trigger | Ticket to Backend Lead (ordering). Zero active workers on a non-empty queue **always pages** (`ALRT-20`). If the stall exceeds one full coupon campaign window, notify the affected tenant's account owner before they report it |
| **`ALRT-19`** — `rate(checkout_revalidation_total{outcome="ABORTED"}[15m]) / rate(checkout_revalidation_total[15m]) > 0.02` for 15 min | Prices are moving under live checkouts. Grouped by `change_type`: `PRICE` → a plan edit or a promotion-window boundary; `COUPON_EXPIRED` / `COUPON_EXHAUSTED` → a campaign hitting its cap; `PLAN_ARCHIVED` → an archive that should have been blocked; `ELIGIBILITY_LOST` → a concurrent membership or a gym suspension mid-flow | Group by `change_type` first — the shape names the cause. Then localise to the tenant and plan. **Aborting is correct behaviour** (`BR-PLN-03`): the fix is upstream, in `plans/`, not here. Never disable the `M-053` transition guard to "restore conversion" | Ticket to Backend Lead (plans) + Product. **Page if the abort ratio exceeds 10%** — at that level a tenant's entire checkout funnel is down. Gym-visible: the affected tenant should be told which of their own edits caused it |
| Rising `checkout_revalidation_total{change_type="COUPON_EXHAUSTED"}`, and a rate of `422 COUPON_LIMIT_REACHED` on `POST /orders/:orderRef/coupon`, ahead of the campaign's planned burn | A live coupon reports itself exhausted early. Two distinct causes with the same symptom: (a) genuine — the campaign is more popular than modelled; (b) **`redemption_count` drift** — stale `PENDING` orders are holding capacity against `total_limit` because `order.expire` is behind, which is failure mode 1 wearing a marketing costume | Reconcile `coupons.redemption_count` against `count(*)` on `coupon_redemptions` for that coupon. Equal → genuine exhaustion, and the decision is the tenant's. Unequal → check `order.expire` health before touching anything. **`funding_source` is immutable after first use** (`BR-CPN-05`): raising the cap is a legitimate edit, changing who funds it is not | Ticket to Backend Lead (ordering); notify the tenant's account owner, because a campaign that stops early is revenue they planned for. A `redemption_count` gap that does not close after `order.expire` recovers is a defect, not an operational event — raise it as one |

**Two adjacent alerts that will look like `ordering/` and are not.** `ALRT-35` (Redis eviction on the
instance holding idempotency records) presents as duplicate orders but is a money-correctness alert
in an infrastructure costume — `BR-PAY-03`'s interceptor lives in `common/`. `ALRT-10` / `ALRT-11`
(webhook lag or dead-man) present as orders stuck in `AWAITING_PAYMENT`; the order is fine and
`payments/` is not.

## Dashboards and queries

_To be populated by `M-051` ("`orders` and `order_items` — the nine `A6.3` figures and the `C4.2`
machine"), `M-053` ("`BR-PLN-03` re-validation as a state-machine guard") and `M-054` ("`coupons`,
`coupon_redemptions`, `Coupon.evaluate()`")._

Intended content, so the shape is agreed before the panels exist:

- **Order funnel panel** — `order_state_transitions_total{from,to}` rendered as the `§C4.2` machine,
  which `Monitoring.md` §3.5 notes is *"also the funnel's server-side truth"*. The
  `AWAITING_PAYMENT → PAID` edge against `AWAITING_PAYMENT → EXPIRED` is the conversion figure
  `KPI-11` is measured on.
- **Re-validation panel** — `checkout_revalidation_total` split by `outcome` and stacked by
  `change_type`, with the `ALRT-19` 2% line drawn and the 10% page line drawn above it.
- **`order.expire` health strip** — `order_expired_total` per bucket,
  `queue_oldest_job_age_seconds{queue="ordering"}` against its 25 s envelope, and
  `job_last_success_timestamp_seconds` for the processor.
- **Coupon-drift query** — the reconciliation of `coupons.redemption_count` against
  `count(*) FROM coupon_redemptions`, per coupon, for coupons with a non-null `total_limit`. Named
  here because `Monitoring.md` correction **C-2** removed `tenant_id` from metric labels: *"the
  metric detects, the query localises."*
- **Stale-`PENDING` query** — orders past `expires_at` still in `PENDING`, grouped by tenant, which
  is both the `order.expire` backlog and the coupon-hold exposure in one result set.
- **Money-path assertion** — `SUM(order_items.line_total_minor)` per order against
  `orders.gross_minor`. `Schema.md` §7.2 states this is asserted at order creation and by
  `finance.reconcile`, **not** by a constraint, so it needs a standing query here.

## Known incidents

_None yet._
