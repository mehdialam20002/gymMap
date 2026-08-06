# payments

> **Charter (`MASTER_PRD.md` §C1.3).** `payments/` — _provider port, adapters, intents, webhooks,
> reconciliation._
>
> **Milestone ids in this file are cited from `docs/roadmap/Milestones_030-059.md`.**
> `docs/roadmap/README.md` §5 assigns different ids to the same titles. That disagreement is
> **`BLK-05`, recorded OPEN in `PHASES.md`**, and it is not resolved here. Where an id is cited the
> milestone **title** is given with it, because the title is the stable reference until `BLK-05`
> closes.

---

## 1. Bounded context

`payments/` owns the answer to _"did money move, and can we prove it"_. It is the only module in the
system allowed to know that a payment provider exists: every Razorpay noun, every HMAC scheme, every
provider identifier and every raw callback body stops at
`payments/infrastructure/adapters/`, and a `dependency-cruiser` rule fails the build on the string
`razorpay`, `stripe`, `rzp_` or `pi_` anywhere else. It owns the transition of a payment through
`§C4.3`, and it owns the decision that a payment has reached a **terminal provider state** — a
decision no other module may take, infer or poll for. What it deliberately does **not** own is the
consequence: `payments/` never activates a membership, never issues an invoice and never writes a
ledger entry. Those are three separate consistency boundaries reached by three separate handlers of
`payment.captured`, which is invariant 5 (`BR-PAY-02`, ADR-0013) expressed as module structure
rather than as a convention.

## 2. PRD identifiers

| Family                      | Identifiers                                                                                                                                                                                                                          |
| :-------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional                  | `FR-PAY-01` … `FR-PAY-12` (`B5.10`)                                                                                                                                                                                                  |
| Business rules **owned**    | `BR-PAY-02` (invariant **I5**) · `BR-PAY-05` · `BR-PAY-06` · `BR-PAY-08`                                                                                                                                                             |
| Business rules **co-owned** | `BR-PAY-03` (with `common/` — the interceptor is `common/`'s, the payment-affecting endpoints are ours) · `BR-PAY-07` (with `refunds/`) · `BR-MEM-10` (with `memberships/` — tokenised auto-renewal mandates)                        |
| Non-functional              | `NFR-PERF-05` (intent creation p95 ≤ 1.5 s, **our** time, gateway excluded) · `NFR-SEC-03` (PCI DSS scoped to SAQ-A; RBI card-tokenisation binds independently) · `NFR-MNT-01` (≥ 95% coverage on `payments/**`) · `NFR-MNT-09` (§9) |
| State machine               | **`§C4.3` Payment** — `CREATED → PENDING → AUTHORISED → CAPTURED → [REFUNDED \| PARTIALLY_REFUNDED]`, with `FAILED` and `CANCELLED` branches                                                                                         |
| Background jobs             | **`§C5`** `payment.reconcile` · `payment.duplicate-detect`                                                                                                                                                                           |
| API                         | `API-PAY` (`§C3.2`; `API_Catalog.md` §3.6 — **four rows, and the absence of a fifth is the control**) plus `GET /tenant/payments` in §3.9                                                                                            |
| Screens                     | `SCR-WEB-006` Payment · `SCR-ADM-006` Finance: Orders & Payments                                                                                                                                                                     |
| Acceptance                  | `AC-PAY-01.1` … `01.3`, `AC-PAY-02.1` … `02.3` · `BAC-04` · `E2E-02`, `E2E-08`                                                                                                                                                       |
| Decisions                   | `ADR-0013` (webhook-driven activation) · `ADR-0016` (idempotency) · `ADR-0018` (`PaymentProvider` port; **Razorpay Route** is the Phase-1 India adapter) · `EP-08`                                                                   |
| Security                    | `TA-8` (provider impersonator) · `TB-6` (Zone 0 → Zone 2 webhook trust boundary) · `K-11` (webhook secrets) · `SEC-A04-004`, `SEC-A08-001` … `004`                                                                                   |

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table            | `Schema.md` | Grants / retention                                                                                 | Why the shape matters                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :--------------- | :---------- | :------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payments`       | §7.4        | RLS · P-STD · **R-FIN** · G-CRUD                                                                   | One attempt to move money for one order through one provider. `uq_payments__provider_intent (provider, provider_intent_id)` prevents the same _intent_ being recorded twice; `idx_payments__order_status (order_id, status)` is what lets `payment.duplicate-detect` find two `CAPTURED` rows on one order in a single index scan. `raw_payload` is **redacted before persistence** — no PAN, CVV or bank credential column exists anywhere in the schema (`BR-PAY-08`) |
| `payment_events` | §7.4        | RLS · P-STD · R-FIN · **G-APPEND** plus `GRANT UPDATE (processed_at)` (grant class **G-COMPLETE**) | The deduplicated, replay-protected log of the provider's callbacks. **`uq_payment_events__provider_event_id` is globally unique, not tenant-prefixed** — the webhook arrives carrying an event id _and nothing else_, before a tenant is resolvable. `ck_payment_events__verified_only` means an unverified webhook is logged and discarded, never persisted as an event                                                                                                |

**`BR-PAY-02` is structural in these two tables.** Activation is driven by a `payment_events` row;
the client's redirect touches no column here. The globally-unique `provider_event_id` is what makes
the webhook exactly-once, and it is the mechanism `AC-PAY-02.1` (browser closed before redirect)
depends on.

**Delivering milestones.** `M-057` _"`payments`, `payment_events` and
`POST /v1/orders/:ref/payment-intent`"_ creates both tables, their RLS policies and their grants in
one migration file (roadmap rule **R-6**).

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

`payments/` has `controllers/`, and it is the **only** module in the tree permitted a
`controllers/webhooks/` directory (`FolderStructure.md` §8) — signature-verified and unauthenticated,
with `@Public()` carrying a declared `compensatingControl` so CI gate `PG-1` recognises it as
deliberate.

| Exported symbol                                                                     | Kind                   | Consumers                                                                                                                                                                                                    | Authority                   |
| :---------------------------------------------------------------------------------- | :--------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------- |
| `PAYMENT_QUERY_PORT` + `PaymentQueryPort`                                           | Port token + interface | `billing/` (edge 31 — an invoice is issued on capture and names the payment) · `settlements/` (edge 40 — the **actual reported** gateway fee, which `BR-FIN-06` forbids estimating) · `reporting/`, `admin/` | `ModuleDependency.md` §3.2  |
| `PAYMENT_REFUND_PORT` + `PaymentRefundPort`                                         | Port token + interface | `refunds/` (edge 35 — the gateway refund must succeed **before** the `C4.5` machine advances)                                                                                                                | `ModuleDependency.md` §3.2  |
| `PAYOUT_PORT` + `PayoutPort`                                                        | Port token + interface | `settlements/` (edge 40 — the Razorpay Route payout call)                                                                                                                                                    | `ModuleDependency.md` §3.2  |
| `PaymentCapturedPayload`, `PaymentFailedPayload`, `PaymentDuplicateDetectedPayload` | **Types only**         | The consumers in §6, so a handler is typed without importing this module's domain (`E7`)                                                                                                                     | `ModuleDependency.md` §8.1  |
| `PAYMENTS_PERMISSIONS`                                                              | Constant               | `payments.intent.create` · `payments.intent.retry` · `payments.payment.read` · `payments.payment.list`. The webhook row carries **no** permission — it authenticates by signature                            | `API_Catalog.md` §3.6, §3.9 |

**Never exported, and the first one is the important one.** `PaymentProvider` — the seven-capability
port of `FR-PAY-01` (`createIntent`, `capture`, `refund`, `getStatus`, `verifyWebhook`,
`createConnectedAccount`, `payout`) — is declared at `payments/ports/payment-provider.port.ts` by
`M-055`, but **no row in `ModuleDependency.md` §3.2 lets any other module inject it**, and §3.2's
closure rule (_"if a port is not in this table, the edge does not exist"_) makes it internal. Its two
implementations, the Razorpay Route adapter and the Stripe reference adapter, exist so the
abstraction has more than one implementer; neither leaves `infrastructure/adapters/`. Also never
exported: the `Payment` aggregate, the `§C4.3` machine, the provider error taxonomy's raw inputs,
the repositories, every DTO, every Prisma model.

**A note on the missing fifth API row.** `API_Catalog.md` §3.6: _"There is no fifth row, and its
absence is the control."_ `BR-PAY-02`'s authoritative enforcement layer is `L12-CI` — an assertion
over the generated OpenAPI document proving **no endpoint exists** that transitions a membership to
`ACTIVE` from a client signal (`SEC-A04-004`). Adding a "confirm payment" endpoint to this module's
public surface would break the rule by making it representable.

**Delivering milestones.** `M-055` _"The `PaymentProvider` port, the Stripe reference adapter, the
contract suite"_ creates `index.ts`, `payments.module.ts`, `permissions.ts` and this README ·
`M-056` _"The Razorpay Route adapter and the deterministic sandbox"_ · `M-057` (the intent
controller) · `M-058` (the webhook controller).

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

| From         | Port                                                                                                                      | Why the answer must be synchronous                                                                                                                                                                                                                                                                                                                                            |
| :----------- | :------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ordering/`  | `ORDER_QUERY_PORT`                                                                                                        | An intent is created against **the total the server computed**, read inside the intent transaction. The same port answers `BR-PAY-02-N2`: a webhook whose captured amount differs from the order is refused with `PAYMENT_AMOUNT_MISMATCH` and activates nothing — a comparison that cannot be made against an eventually-consistent copy (edge 29; `BR-PAY-04`, `FR-PAY-01`) |
| `common/`    | `Money`, the error taxonomy, the `IdempotencyInterceptor` and its store, the outbox port, `Clock`, `feature-flag.port.ts` | Universal edge. `Idempotency-Key` is **required** on the intent and retry rows, and the interceptor runs before the use case                                                                                                                                                                                                                                                  |
| `tenancy/`   | `TenantContext`, the tenant-scoped Prisma client                                                                          | Universal edge — with one deliberate asymmetry: the webhook route resolves its tenant **from the persisted `payments` row it correlates to**, never from the callback body (`§C1.4` step 1: _"the tenant is never taken from a client-supplied header or body parameter"_, and a provider is a client here)                                                                   |
| `audit/`     | `AUDIT_WRITE_PORT`                                                                                                        | Every payment state transition is audited; `payment_events` additionally holds the raw redacted provider event (`BR-PAY-02` audit field)                                                                                                                                                                                                                                      |
| _(internal)_ | `PaymentProvider`                                                                                                         | The gateway itself. Implemented by `razorpay-route.payment-provider.adapter.ts`, the Stripe reference adapter, and the deterministic sandbox adapter                                                                                                                                                                                                                          |

`payments/` imports **nothing** from `catalog/`, `plans/`, `staff/`, `crm/`, `memberships/`,
`billing/`, `settlements/` or `refunds/`. The two that a reasonable engineer would reach for are
worth naming: `payments → memberships` ("activate it right here in the webhook handler") is an
upward `L5 → L4` edge that would also merge two consistency boundaries, so a membership failure would
roll back a captured payment (`ModuleDependency.md` §4.2); and `payments → settlements` is forbidden
outright by ADR-0029.

**Delivering milestone.** `M-057` wires `ORDER_QUERY_PORT` into `create-payment-intent.use-case.ts`,
which re-validates through `M-053`'s guard before calling the provider.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

Every payload carries `tenant_id` and `occurred_at`, carries no personal datum (`E5`), and its
outbox row is written inside the same transaction as the state change (`E2`).

| Event                        | Payload beyond the common fields                                   | Known consumers                                                                                                                                                        | Notes                                                                                                                                                                                                                                                                                                                          |
| :--------------------------- | :----------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payment.captured`           | `payment_id`, `order_id`, `amount_minor`, `method`, `provider_ref` | `memberships/` (activation — invariant 5) · `billing/` (invoice issuance) · `ledger/` (the money facts) · `ordering/` (order → `PAID`, per `ModuleDependency.md` §5.4) | **The single most consequential event in the system.** `ModuleDependency.md` §8.4 traces the whole chain: Razorpay webhook → capture → `payment.captured` → `memberships/` handler → `membership.activated` → `attendance/` + `crm/` + `notifications/`. The customer's browser may close at any point and the chain completes |
| `payment.failed`             | `payment_id`, `order_id`, `failure_code`, `attempt`                | `ordering/`, `notifications/`                                                                                                                                          | `failure_code` is a **mapped, closed enum** from `StateMachines.md` §15, never the provider's raw string                                                                                                                                                                                                                       |
| `payment.duplicate-detected` | `payment_id`, `original_payment_id`                                | `refunds/`, `notifications/`                                                                                                                                           | Emitted by the `payment.duplicate-detect` job; `refunds/` performs the auto-refund through the standard refund path so commission reversal (`BR-REF-05`) and the credit note (`FR-INV-09`) happen correctly                                                                                                                    |

**A failing handler never rolls back this module** (`E6`). Retry with backoff, then dead-letter with
an alert — a `memberships/` outage must not un-capture a payment.

**Delivering milestones.** `M-058` (event persistence and dispatch) · `M-059`
_"Webhook-exclusive activation, `payment.reconcile`, `payment.duplicate-detect`"_.

## 7. Consumed events

**None.** — and the absence is deliberate rather than incidental.

`payments/` appears in the consumer column of **no** row in `ModuleDependency.md` §8.2. Everything
that changes a payment's state arrives by exactly one of two synchronous paths: a signature-verified
provider callback, or a call from a module below it in the graph (`ordering/` creating an intent,
`refunds/` invoking `PAYMENT_REFUND_PORT`, `settlements/` invoking `PAYOUT_PORT`). An inbound domain
event would be a **third** way to move a payment, and `BR-PAY-02` and `BR-PAY-05` both depend on
there being exactly one — _"a rule of the form 'X never happens' is best proved by X being
unrepresentable"_. Concretely: `application/handlers/` in this module holds handlers for **provider**
events dispatched off `payment_events` (`payment-captured`, `payment-failed`, `payment-authorised`,
`refund-processed` — `M-058`), which are not domain events and carry no outbox row on the way in.

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

| `§C5` job                  | Queue      | Class  | Schedule     | Conc | Scope | Lock key                                          | Expected | Alert                                 |
| :------------------------- | :--------- | :----: | :----------- | :--: | :---: | :------------------------------------------------ | :------- | :------------------------------------ |
| `payment.reconcile`        | `payments` | **P0** | Every 15 min |  1   | `PL`  | `payment.reconcile:platform:{15minBucket}`        | **45 s** | **7 min**, or depth > 10 after 45 min |
| `payment.duplicate-detect` | `payments` | **P0** | Every 15 min |  1   | `PL`  | `payment.duplicate-detect:platform:{15minBucket}` | **20 s** | **3 min**, or depth > 10 after 45 min |

**`payment.reconcile`** polls every payment left `PENDING` or `AUTHORISED` past the threshold,
applies a terminal provider state **idempotently through the same path the webhook uses**, and
escalates a still-indeterminate payment to Finance rather than resolving it. There is no edge in the
`§C4.3` machine from an indeterminate state to `CAPTURED` other than through applied provider truth,
and the escalation queue's "resolve" action requires a human with a reason (`BR-PAY-06`).

**`payment.duplicate-detect`** finds orders carrying more than one `CAPTURED` payment in one index
scan of `idx_payments__order_status`, keeps the earliest, and refunds the rest through `refunds/`
with reason `DUPLICATE_PAYMENT`. Re-running it issues no second refund. `FR-PAY-08` sets the target
at **one hour**, tighter than `BR-PAY-07`'s _"one business day"_ — `BusinessRules.md` §21 `CR-07`
records that discrepancy and resolves it in favour of the tighter figure.

Both jobs run under **`PL` scope** — `PlatformPrismaService` under an explicit, audited elevation
(ADR-0005, ADR-0006) — because the candidate scan crosses tenants by design. Trust layer 3 for both
is `payment_events (provider_event_id)` unique: a second execution is a no-op at the database, not
at the application (`Scalability.md` §8.3.1).

`payments/` has **no** `data.retention-sweep` child: both its tables are `R-FIN`, and
`SoftDeleteStrategy.md` §11.2's `R-FIN` branch is a deliberate no-op in Phase 1.

**Delivering milestone.** `M-059` ships both processors with their locks, idempotency and alert
tests.

## 9. Top three failure modes (`NFR-MNT-09`)

`Epic_08.md` **D-08.13** names six runbook entries; these are the three carrying **S1** alerts.

|  #  | Failure                                                                                                                                                            | Signal                                                                                                                                                                                                                                                          | First action                                                                                                                                                                                                                                                                                                                                |
| :-: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|  1  | **Webhook channel silent or lagging** — members have paid and have no membership. Invariant **I5** is breaking                                                     | `ALRT-11` (dead-man): `sum(rate(webhook_events_total{provider="razorpay"}[30m])) == 0` for 30 m during 06:00–23:00 IST while `payment_attempts_total` in the same window is > 0. `ALRT-10`: `webhook_processing_lag_seconds{provider="razorpay"} > 120` for 2 m | Is our endpoint returning `2xx` to Razorpay? Check the provider's webhook delivery log and endpoint status — Razorpay disables an endpoint after repeated `5xx`. If ingress is healthy it is our async side: `queue_depth{queue="payments"}` and `outbox_oldest_unpublished_age_seconds`. **`payment.reconcile` is the stopgap**, not a fix |
|  2  | **Indeterminate payments ageing past the threshold** — money taken, outcome unknown, and each case is a person with a statutory-adjacent refund expectation        | `ALRT-12`: `payment_indeterminate_oldest_age_seconds > 3600`, **or** `payment_indeterminate_current > 10` for 15 m. Age matters more than count                                                                                                                 | Run `payment.reconcile` manually against the affected window and compare the provider's `fetch_payment` to our `payments` rows. Beyond 4 h each case is resolved by a human, with a reason, and the member is notified. **Never auto-activate an indeterminate payment** (`BR-PAY-06`)                                                      |
|  3  | **Webhook signature verification failing** — either a forgery attempt or a one-sided secret rotation, and a forged capture would mint a membership nobody paid for | `ALRT-30`: `increase(webhook_verification_failures_total{reason="BAD_SIGNATURE"}[10m]) > 5`, **or any** `UNKNOWN_KEY_ID`. This is a **security** signal, not an ops one                                                                                         | Correlate against the provider's secret-rotation history and check which secret version is in use on each side. **Never disable verification to "restore service"** — the discard path is the control (`BR-PAY-05`)                                                                                                                         |

**Runbook:** `/docs/runbooks/payments.md` — which indexes the topic runbooks `Monitoring.md` §5 names
for these alerts: `runbooks/webhooks.md`, `runbooks/indeterminate-payment.md`,
`runbooks/duplicate-payment.md`, `runbooks/payment-health.md`.
