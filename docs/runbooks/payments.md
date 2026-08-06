# payments runbook

> **`NFR-MNT-09`** — every module carries a runbook naming its top failure modes, the signal each is
> detected by, the first action, and where it escalates. Companion to
> `apps/server/src/payments/README.md` §9.
>
> **No code exists in `payments/` yet.** The failure modes, signals and first actions below are
> derived from `Monitoring.md` §3.5 and §5, `Scalability.md` §8.3, `BusinessRules.md` §9 and
> `Epic_08.md` **D-08.13**. The dashboards and queries that make them executable arrive with the
> milestones named in **Dashboards and queries**.
>
> **This file is the module index.** `Monitoring.md` §5 routes individual alerts to topic runbooks —
> `runbooks/webhooks.md`, `runbooks/indeterminate-payment.md`, `runbooks/duplicate-payment.md`,
> `runbooks/payment-health.md`. Those four are written alongside the milestones below; this page
> holds the module-level view and points at them.

---

## Scope

`payments/` is the platform's only seam with a payment provider, and the only place a provider's
vocabulary is allowed to exist — `dependency-cruiser` fails the build on `razorpay`, `stripe`,
`rzp_` or `pi_` outside `payments/infrastructure/`. It owns `payments` and `payment_events`, the
`§C4.3` state machine, the `PaymentProvider` port and its adapters (**Razorpay Route** is the
Phase-1 India adapter; Stripe Connect exists as the reference implementation), the signature-verified
webhook receiver, and the two reconciliation jobs. Operationally it carries **invariant 5**:
*membership activation is webhook-driven, and a client-side success signal never activates a
membership*. That has a direct consequence for on-call — when this module is degraded, members have
paid and have nothing, which `Monitoring.md` calls *"the single worst support scenario"*. It carries
`BR-PAY-08` too: no card, CVV or bank credential exists anywhere in this module's schema or logs, so
any incident response that involves reading an instrument identifier out of a payload is already
wrong.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **`ALRT-11`** (dead-man, **S1**) — `sum(rate(webhook_events_total{provider="razorpay"}[30m])) == 0` for 30 min during 06:00–23:00 IST while `payment_attempts_total` in the same window is > 0. **`ALRT-10`** (**S1**) — `webhook_processing_lag_seconds{provider="razorpay"} > 120` for 2 min | Webhook channel down or lagging. Razorpay disabling our endpoint after repeated `5xx`; an expired or rotated webhook secret; our edge returning non-`2xx`; or — if ingress is healthy — our own async side, meaning the `payments` queue or the outbox relay | Split ingress from processing. **Ingress:** the provider's webhook delivery log and endpoint status; are we returning `2xx`? **Processing:** `queue_depth{queue="payments"}` and `outbox_oldest_unpublished_age_seconds`. Auto-scale the `payments` queue workers. `payment.reconcile` is the **stopgap that limits the damage, not the fix** — every payment in a silent window strands until it runs | Page primary on-call **and** Finance. 15 min → Technical Lead. `ALRT-10`'s 120 s threshold is also the declared **rollback trigger** for a release that touched this path |
| **`ALRT-12`** (**S1**) — `payment_indeterminate_oldest_age_seconds > 3600`, **or** `payment_indeterminate_current > 10` for 15 min. Age matters more than count: *"one payment stuck for four hours is a member with money taken and no membership"* | Payments left `PENDING` or `AUTHORISED` past the poll threshold and not resolving. A provider-side incident; a reconciler that is running but failing; or a genuine provider ambiguity the poll cannot settle | Run `payment.reconcile` manually against the affected window and compare the provider's `fetch_payment` result to our `payments` rows. A terminal provider state is applied **idempotently through the same path the webhook uses**, so a later webhook is a no-op. **Never auto-activate** an indeterminate payment: `§C4.3` has no edge to `CAPTURED` except through applied provider truth (`BR-PAY-06`) | Page Finance on-call + primary on-call. **Beyond 4 h each case is resolved by a named human with a recorded reason, and the member is notified** — the resolution action is audited |
| **`ALRT-30`** (**S1**) — `increase(webhook_verification_failures_total{reason="BAD_SIGNATURE"}[10m]) > 5`, **or any** `UNKNOWN_KEY_ID`. This is a **security** signal, not an ops one | Either a forgery attempt (`TA-8`, the provider impersonator) or a secret rotation performed on one side only. A forged `payment.captured` would mint a membership nobody paid for | Correlate the failures against the provider's secret-rotation history and check which secret version each side is using. Unverified webhooks are logged with provider, event id and reason at `warn` and discarded with `2xx` — deliberately, so a forger's retries stop. **Never disable verification to "restore service"**: the discard path *is* the control (`BR-PAY-05`, `K-11`) | Page the security owner **and** on-call. `Security.md` `IR-P5` is the incident procedure for a forged or replayed webhook. A confirmed forgery attempt is a security incident, not a payments incident, and leaves this runbook |

**The other three entries `D-08.13` requires** — duplicate-detector false positive
(`ALRT-18`, `{resolution="MANUAL_REVIEW"}` is the higher-severity variant and means idempotency did
**not** contain it), provider incident (`ALRT-13`, `thirdparty_circuit_state{dependency="DEP-01"} == 2`),
and secret rotation — are held in `runbooks/webhooks.md` and `runbooks/duplicate-payment.md`.
`ALRT-09` (payment success rate below the `KPI-19` 92% line) is the commercial alert and lives in
`runbooks/payment-health.md`.

**One adjacent alert that will look like `payments/` and is not.** `ALRT-35` — Redis eviction on the
instance holding idempotency records — turns a client retry into a **second charge**. It is
`common/`'s idempotency store failing, and it surfaces here as duplicate payments an hour later.

## Dashboards and queries

_To be populated by `M-055` ("The `PaymentProvider` port, the Stripe reference adapter, the contract
suite"), `M-056` ("The Razorpay Route adapter and the deterministic sandbox"), `M-057` ("`payments`,
`payment_events` and `POST /v1/orders/:ref/payment-intent`"), `M-058` ("The webhook receiver") and
`M-059` ("Webhook-exclusive activation, `payment.reconcile`, `payment.duplicate-detect`")._

Intended content, so the shape is agreed before the panels exist:

- **The payments half of dashboard 2, "The two paths that matter"** (`Monitoring.md` §10) — success
  rate against the 92% line, `payment_intent_duration_seconds` p95 against `NFR-PERF-05`'s 1.5 s,
  `webhook_processing_lag_seconds`, and webhook events per minute. `payment_intent_duration_seconds`
  and `payment_provider_call_duration_seconds` are **drawn as separate series**, so a provider
  slowdown is never mistaken for ours.
- **Failure-code breakdown** — `payment_attempts_total` grouped by `failure_code` (a mapped, closed
  enum of ≤ 25 values from `StateMachines.md` §15). `ALRT-09`'s diagnosis rule: *a single dominant
  code means a provider method outage — UPI vs card vs netbanking; a flat spread means us.*
- **Webhook outcome panel** — `webhook_events_total` by `outcome`
  (`PROCESSED` / `DUPLICATE_IGNORED` / `UNKNOWN_TYPE` / `FAILED` / `DEAD_LETTERED`), with the
  dead-man window shaded.
- **Duplicate-payment query** — named in `ALRT-18` because correction **C-2** removed `tenant_id`
  from the metric: `SELECT * FROM payments WHERE order_ref IN (SELECT order_ref FROM payments GROUP BY order_ref HAVING count(*) FILTER (WHERE status='CAPTURED') > 1);`
  followed by a check of whether an `Idempotency-Key` was present on the originating requests.
- **Indeterminate-payment query** — payments in `PENDING` or `AUTHORISED` with
  `reconciled_at IS NULL` past the threshold, ordered by age, which is the manual work queue
  `ALRT-12` escalates into.
- **Activation-trace assertion** — invariant **I5** is monitored as a *trace shape*, not only a
  metric: an activation must always be parented to a `webhook.process` span and **never** to an HTTP
  request from a browser (`Monitoring.md` §1, invariant table).
- **Sandbox parity check** — the deterministic sandbox adapter's four outcomes (success, failure,
  timeout, duplicate) exercised against the same panels in non-production, so the dashboard is known
  to move before an incident requires it to.

## Known incidents

_None yet._
