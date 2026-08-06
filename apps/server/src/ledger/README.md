# ledger

> Charter (`MASTER_PRD.md` §C1.3): **append-only financial ledger, balances.**

---

## 1. Bounded context

`ledger/` owns the _fact_ of a money movement and the derivation of every balance in the system from
those facts. No other module may state a balance; another module may only append an entry and read
the derivation. `BR-FIN-01` — _"all balances are derived from the append-only ledger; no balance is
ever stored as a directly-mutable figure"_ — is not a policy this module follows but a **boundary
property** it is shaped to make unrepresentable: `ledger/` imports `common/` and `tenancy/` and
nothing else (ADR-0029, `ModuleDependency.md` §0 C-1), so it physically cannot reach into an order
or a payment to "check" a figure and derive a balance from a mutable row. Corrections are
compensating entries, never edits — and that too is structural rather than disciplined: the
application role holds no `UPDATE` (beyond one column) and no `DELETE` privilege on `ledger_entries`,
and the deploy fails if one ever appears.

## 2. PRD identifiers

| Class          | Identifiers                                                                                                                                                                                                                                                                                              |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business rules | **`BR-FIN-01`** (with its `BR-FIN-01-N1`/`-N2` negative and `BR-FIN-01-P1` positive cases), `BR-FIN-04` (commission never on tax), `BR-FIN-05` (rate effective at the moment of sale), `BR-FIN-06` (no `GATEWAY_FEE` entry exists until the provider reports one), `BR-PAY-01`, `BR-REF-05`, `BR-TEN-01` |
| Non-functional | `NFR-DQ-02` (integer minor units with an adjacent currency), `NFR-DQ-03`, `NFR-MNT-09`                                                                                                                                                                                                                   |
| Data model     | `§C2.2` `ledger_entries`; `§C1.5` Money and the transactional outbox                                                                                                                                                                                                                                     |
| Commercial     | `A6.3` (the eight persisted figures the entries mirror)                                                                                                                                                                                                                                                  |
| State machine  | **None.** No `§C4` machine belongs here. A ledger entry has no lifecycle — it is a fact, and a fact that could transition would not be one                                                                                                                                                               |
| `§C5` jobs     | **None.** See §8                                                                                                                                                                                                                                                                                         |
| Gates          | Invariant 2 (_money is an append-only ledger of integer minor units_), `BAC-07`, `E11.4`, ADR-0015, ADR-0029                                                                                                                                                                                             |

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ledger_entries` | The sole source of every balance. `RLS · P-STD · R-FIN · G-LEDGER`. Twelve `entry_type` values at `M-087` — `SALE`, `COMMISSION`, `GATEWAY_FEE`, `TAX`, `REFUND`, `COMMISSION_REVERSAL`, `CHARGEBACK`, `CHARGEBACK_REVERSAL`, `RESERVE_HOLD`, `RESERVE_RELEASE`, `PAYOUT`, `ADJUSTMENT` — plus `COMMISSION_TAX` and `COMMISSION_TAX_REVERSAL` added inert at `M-089` pending `REG-02`. Not partitioned: every query is `(tenant_id, occurred_at)`-scoped and `R-FIN` means nothing is ever deleted |

The grant shape **is** the enforcement, so it belongs in this README and not only in the migration:

```sql
-- illustrative — not committed code
GRANT INSERT ON ledger_entries TO app_append;
GRANT SELECT ON ledger_entries TO app_rw, app_platform_ro;
GRANT UPDATE (settlement_batch_id) ON ledger_entries TO app_rw;  -- once, NULL -> value
-- Absent and asserted absent by CI-02, CI-09 and infra/scripts/ledger-grant-assertion.sh:
--   UPDATE on any other column, and DELETE, for every application role.
```

`settlement_batch_id` is the one updatable column — Deviation **D-05** in `Schema.md` §16.1 — guarded
by `ck_ledger_entries__batch_assign_once` in a `BEFORE UPDATE` trigger so the transition is
`NULL → value` exactly once. `amount_minor` is always non-negative and `direction` carries the sign,
because a signed amount plus a direction is two representations of one fact and they will disagree.

`ENGINEERING_PLAN.md` §4.3 additionally lists `wallet_entries` under this module. **That table must
not exist in Phase 1**: `ERD.md` §13.3 and `Schema.md` §16.2 both forbid it — _"it would be a second
money system"_, and a wallet balance would itself have to be derived, which makes a wallet a second
**ledger scope**, not a table. Phase 1 ownership is one table.

**Delivering milestones** — `M-087` (the table, the twelve entry types, the grants, the deploy-time
assertion and the `ban-balance-columns` check), `M-089` (the two inert India entry types),
`M-101` (`COMMISSION_TAX_REVERSAL` reversing at the original rounding).

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

**`ledger/` has no `controllers/` directory, and the reason is specific to this module.**
`FolderStructure.md` §8.2: `BR-FIN-01` makes balances _derived_, never mutated — **a write endpoint
on the ledger is the exact API that would let something adjust a balance.** Reads reach the outside
world through `reporting/` and `settlements/`, which are accountable for what they show. This is a
different reason from the other three exempt modules: `common/` has no controllers because it is a
mechanism library rather than a bounded context; `tenancy/` has none because exposing tenant context
over HTTP is precisely the `§11.3` failure; `audit/` has none because its _writer_ must not be
reachable from the administration UI. Only here is the absence of the endpoint the enforcement of a
money rule.

Because there are no controllers, `permissions.ts` is **not** mandatory (`FolderStructure.md` §8.1).

| Exported symbol                  | Kind                                                                                            | Consumers                                                          |
| :------------------------------- | :---------------------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| `LEDGER_APPEND_PORT` + interface | Command port — **append-only by signature**; the interface declares no `update` and no `delete` | `refunds/` (●)                                                     |
| `LEDGER_READ_PORT` + interface   | Read-model port; `entriesForPeriod()`, derived balance                                          | `refunds/` (●), `settlements/` (●), `reporting/` (●), `admin/` (●) |
| `LedgerEntryAppendedPayload`     | Event payload type                                                                              | `settlements/`, `reporting/`                                       |

The append-only signature is defence in depth **behind** the absent privilege, not the enforcement —
`M-087`'s note is explicit that a `$executeRaw` two modules away, a regenerated table with default
grants, or a hotfix run as the migration role each bypass the interface and none looks wrong in
review. Relatedly, no method name under `ledger/infrastructure/**` may begin with `update` or
`delete`: the method name is the affordance, and if it exists someone will call it.

> **One open naming question.** `API_Catalog.md` lists `GET /me/wallet` guarded by
> `ledger.wallet.read`. A permission constant in the `ledger` namespace implies a `ledger/permissions.ts`,
> which implies controllers. `BR-WAL-01` is priority **`C`**, `wallet_entries` is deliberately absent
> (`Epic_20.md`, `ERD.md` §13.3), and the Phase-1 referral reward is a coupon. Until that endpoint is
> scoped, this module ships without `permissions.ts`, and any move to ship it reopens §4 of this file.

**Delivering milestones** — `M-087` (module shell, both ports, the entity, the `TenantBalance` value
object).

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

**Two, and deliberately only two.**

| From       | What is injected                                                                                                           | Why synchronous                                                                                                                                                                                                                                                                                 |
| :--------- | :------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `common/`  | `Money`, `Clock`, `IdGenerator`, the outbox port, the error taxonomy, and `ReferenceDataRepository` for `commission_rules` | `commission_rules` is platform-global reference data (`§C2.3`) read through `common/persistence/reference-data.repository.ts` under constitution §11.5 **BR4** — **never** by importing `admin/`, which would be an upward L5→L7 edge and would collapse the DAG (`ModuleDependency.md` §0 C-3) |
| `tenancy/` | `TenantContext`, `TenantId`, the tenant-scoped Prisma client                                                               | An entry is written inside the interactive transaction that already set `app.tenant_id`; there is no other client to use (ADR-0005, A-01)                                                                                                                                                       |

Everything else arrives as an **event** (§7). This is the whole point of `ledger/` being the lowest
rank in L5: the fewer things it can see, the more obviously `settlements/` must read from it rather
than from orders (`ModuleDependency.md` §11.3).

> **`audit/` is not consumed, and that is deliberate.** `ModuleDependency.md` §3.1 lists `ledger/`
> among the five modules that do **not** inject `AUDIT_WRITE_PORT`. `ledger_entries` is already
> append-only and `R-FIN`-retained; a parallel audit row for each insert would be a second immutable
> history of the same fact, and two immutable histories can still disagree.

**Delivering milestones** — `M-087`.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event                   | Payload beyond `tenant_id`, `occurred_at`                    | Known consumers              | Note                                                                                                                                                                                                                   |
| :---------------------- | :----------------------------------------------------------- | :--------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ledger.entry-appended` | `ledger_entry_id`, `entry_type`, `direction`, `amount_minor` | `settlements/`, `reporting/` | The outbox row is written inside the same transaction as the entry (`E2`)                                                                                                                                              |
| `wallet.credited`       | `wallet_entry_id`, `user_id`, `amount_minor`                 | `notifications/`             | Catalogued in `ModuleDependency.md` §8.2 but **unreachable in Phase 1**, because `wallet_entries` deliberately does not exist. Do not implement a stub emitter for it: `ERD.md` §13.3 — _"a stub table is not a seam"_ |

**Delivering milestones** — `M-087` (`ledger.entry-appended`). `wallet.credited` has no delivering
milestone in `M-001` … `M-120`, consistent with the wallet being Phase 2.

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

`ModuleDependency.md` §0 C-1 fixes the design: _"facts reach the ledger as events … handled by
`ledger/application/handlers/`."_ Each handler is idempotent on the key below (`E3`).

| Event                | Publisher      | Handler idempotency key                                                                             |
| :------------------- | :------------- | :-------------------------------------------------------------------------------------------------- |
| `order.paid`         | `ordering/`    | `order_id`                                                                                          |
| `coupon.redeemed`    | `ordering/`    | `coupon_redemption_id`                                                                              |
| `referral.qualified` | `ordering/`    | `referral_id` — Phase 1 delivers the reward as a **coupon**, so this handler writes no wallet entry |
| `payment.captured`   | `payments/`    | `payment_id`                                                                                        |
| `refund.completed`   | `refunds/`     | `refund_id`                                                                                         |
| `settlement.paid`    | `settlements/` | `batch_id`                                                                                          |
| `reserve.released`   | `settlements/` | `reserve_id`                                                                                        |

> **The one exception to "facts arrive as events".** `refunds/` appends its reversal entries
> **synchronously, inside its own transaction**, through `LEDGER_APPEND_PORT` — an intentional shared
> unit of work that `BR-REF-05` currently relies on and that `ModuleDependency.md` §12.2 records as
> one of two blockers on extracting this module. `refund.completed` therefore arrives _as well_, for
> the consumers that need the completed fact rather than the entries.

**Delivering milestones** — `M-087` (the handler surface and the same-transaction writer),
`M-101` (the reversal entries appended by `refunds/`).

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

**None.** No `§C5` job belongs to `ledger/`, and `Scalability.md` §8.3.1 places none of the
twenty-four in a `ledger` queue. The reason is not an oversight: a job is a _scheduled decision_, and
this module takes no decisions. Every entry is written in the same transaction as the state change
that caused it, so there is nothing to sweep up later; and a balance is a **query**, not a
recomputation, so there is nothing to precompute. The feature flag `mig.ledger.balance-projection` is
registered **off** precisely to keep it that way, and a structure test proves the settlement build
path never imports a projection (`M-087` AC 11). `M-087`'s closing note names the materialised
balance introduced later "for the dashboard" as the second trap: it will be correct for months, then
diverge, and at that moment there is no way to determine which number is right.

The deploy-time privilege check (`infra/scripts/ledger-grant-assertion.sh`, `M-087`) runs on **every
deploy in every environment** and fails the deploy. It is a pipeline step, not a job, and it is
listed here so nobody converts it into one.

**Delivering milestones** — none, by design.

## 9. Top three failure modes (`NFR-MNT-09`)

The three declared for `ledger/` in `PROJECT_CONSTITUTION.md` §18.5.1.

|  #  | Failure mode                                         | Signal                                                                                                                                                                                                                                                            | First action                                                                                                                                                                                                                                                                                      |
| :-: | :--------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|  1  | **Entry write failure inside a capture transaction** | `ALRT-17` (S1) on `ledger_balance_mismatch_total`; upstream, `ALRT-10` webhook lag or `ALRT-33` database health with deadlocks concentrated on ledger writes                                                                                                      | Establish whether the capture also failed. The entry and its cause share one transaction (`M-087` AC 8), so a failure should leave **neither** — a captured payment with no `SALE` entry means the atomicity was broken and that is the incident, not the missing row                             |
|  2  | **Balance derivation slow at scale**                 | `db_transaction_duration_seconds` p99 on the derivation query; `ALRT-33` pool saturation; `settlement.build-batches` approaching its 10 min (Y1) / 100 min (10×) envelope, since its candidate scan is the one query that crosses a tenant's whole ledger history | Confirm `idx_ledger_entries__unbatched` — the partial index on `(tenant_id, occurred_at) WHERE settlement_batch_id IS NULL` — is being used. It exists specifically because that scan would otherwise degrade linearly forever. **Do not add a materialised balance** to fix this; see §8         |
|  3  | **Reversal without a matching original**             | `ALRT-17`; `ledger_entries_written_total{entry_type="COMMISSION_REVERSAL"}` without a corresponding `COMMISSION`; the nightly `ops.orphan-scan` over `reference_id` (`Schema.md` §9.1)                                                                            | Identify the originating `reference_id` before writing anything. `BR-REF-05` requires the reversal to be computed at the **order's** stored rate and the **original** rounding — a reversal recomputed at today's rate is `BR-REF-05-N1` and is a different, worse defect than a missing original |

`db_append_only_grant_violations_total` and `gym.ledger.grant_violation` are separate from all three:
their only acceptable value is **0**, and any increment means code exists that believes it may
rewrite history. That pages immediately under `ALRT-17`.

**Runbook:** [`/docs/runbooks/ledger.md`](../../../../docs/runbooks/ledger.md)
