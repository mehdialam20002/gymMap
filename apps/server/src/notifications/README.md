# notifications

**Charter (`MASTER_PRD.md` §C1.3):** _templates, channels, preferences, delivery log._

---

## 1. Bounded context

`notifications/` owns the answer to **"is this message actually sent, to this recipient, on this
channel, right now, from which template version?"** No other module may decide a channel, resolve a
recipient's address, evaluate a preference, apply quiet hours, or choose a template body. Publishing
modules emit a domain fact — `payment.failed`, `membership.renewal-due`, `settlement.paid` — and stop
there; the decision to turn a fact into a message, and the decision not to, both live here. That
separation is what `ModuleDependency.md` §4.2 protects when it forbids `notifications/ → memberships/`:
a module that imported twelve publishers to render their templates would become the module nobody can
change.

Two consequences follow and are load-bearing. First, **suppression is evaluated per message inside the
dispatcher, never at list build** (`M-111` AC 1) — a member who opts out at 10:00 is not still receiving
a campaign assembled at 09:00. Second, **the dispatcher resolves the latest `APPROVED` template
version, not the latest version** (`M-112` AC 4, `LAUNCH_MARKET_INDIA.md` §8) — editing an India SMS
template starts a TRAI DLT approval process without stopping the messages already flowing.

Layer **L7** (`ModuleDependency.md` §2.1, "fan-out surfaces … read widely by design and are read by
nothing"). It is also the only tenant-scoped module exempted from the universal `→ audit/` edge
(§3.1): a delivery is recorded in `notification_log`, not in `audit_log` (`BusinessRules.md`
line 626 — _"dispatch is recorded in `notification_log`, not `audit_log`"_).

## 2. PRD identifiers

| Class                           | Identifiers                                                                                                                                                                                                                                                                                                                                                                        |
| :------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional                      | `FR-NOTF-01` … `FR-NOTF-08` (`B5.19`); `FR-USER-04` (preference surface); `FR-NOTF-03` also drives the `/admin/config/templates` pair                                                                                                                                                                                                                                              |
| Business rules                  | `BR-MEM-11` (T−15/−7/−3/−1 ladder), `BR-MEM-14` (24-hour gym-closure notice), `BR-TEN-06` (`PAST_DUE` notices), `BR-DAT-06` (no personal datum in a log, trace or analytics event), `BR-PAY-07`, `BR-REF-08`, `BR-GYM-06` (the three that make a notice non-suppressible) — **there is no `BR-NOTF-*` family; the module is governed by other modules' rules plus its own `FR-`s** |
| Non-functional                  | `NFR-SCAL-05` (worker tier), `NFR-AVL-03` (notification loss must not stop check-in, purchase or payment), `NFR-PRV-02` (timestamped revocable consent), `NFR-PRV-04` (category-scoped retention, rule `SC-R03`), `NFR-MNT-06`, `NFR-MNT-09`, `NFR-USE-08`                                                                                                                         |
| `§C4`                           | **None of the nine.** The TRAI DLT template-approval machine is the _twelfth_ state-machine file and is explicitly outside `§C4` — `StateMachines.md` §1.2: _"it governs notification templates, not a domain entity"_. It lives at `notifications/domain/sms-template-approval.state-machine.ts` (`FolderStructure.md` line 139)                                                  |
| `§C5`                           | Job 19 `notification.dispatch`                                                                                                                                                                                                                                                                                                                                                     |
| Errors (`API_Catalog.md` §6.13) | `TRANSACTIONAL_OPT_OUT_NOT_PERMITTED` (422) · `TEMPLATE_PENDING_DLT_APPROVAL` (409) · `TEMPLATE_VERSION_CONFLICT` (409) · `CHANNEL_NOT_AVAILABLE` (422) · `PUSH_SUBSCRIPTION_INVALID` (400)                                                                                                                                                                                        |
| Screens                         | `SCR-WEB-014` (channel × category matrix), `SCR-DASH-021`, the shared notification centre on all three surfaces                                                                                                                                                                                                                                                                    |
| Flags                           | `ops.notifications.dispatch` (kill-switch, `PERMANENT`), `rel.notifications.quiet-hours`, `rel.notifications.web-push`                                                                                                                                                                                                                                                             |
| Decisions                       | `A-19` (vendors open), `A-08` (polling, not Socket.IO), ADR-0017 (outbox + consumer idempotency)                                                                                                                                                                                                                                                                                   |

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table                             | Spec              | Tenancy · retention · grants                                                                                                              | Note                                                                                                                                                                                                                                                                                                                                   |
| :-------------------------------- | :---------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notification_log`                | `Schema.md` §11.1 | **HYBRID · P-HYBRID** (`tenant_id` null for a platform-originated message) · R-OPS with **category-scoped** retention (`SC-R03`) · G-CRUD | Y1 **20,075,000** rows at 55,000/day — the largest table after `attendance`. Held at ≈2.0 GB steady state because `OPERATIONAL` rows expire at 90 days while `TRANSACTIONAL` rows follow `NFR-PRV-04`. Monthly partitioning is **pre-planned, not applied**, with the trigger at 100 M rows (`M-109` AC 9)                             |
| `notification_preferences`        | `Schema.md` §4.9  | **IDENTITY** · R-OPS · G-CRUD                                                                                                             | Grouped under §4 for schema review; the module map is `§C1.3` and the permissions are `notifications.preference.read` / `.update` (`API_Catalog.md` USER rows). `TRANSACTIONAL` and `SECURITY` are non-suppressible **in the dispatcher, deliberately not as a `CHECK`** — a withdrawn consent must still be storable as an audit fact |
| `push_subscriptions`              | `M-109` migration | RLS + grants ship in the same migration (R-6)                                                                                             | Web push only; `rel.notifications.web-push` off removes the channel entirely                                                                                                                                                                                                                                                           |
| `notification_template_overrides` | `M-109` migration | Tenant-owned, policy in the same migration                                                                                                | **Email and in-app only.** There is no SMS override capability anywhere in the API or the UI, asserted structurally (`M-109` AC 7, `AC-NOTF-04.1`–`04.3`)                                                                                                                                                                              |

> ⚠ **Ownership conflict — resolve before code, record in `DECISION_LOG.md`.**
> `notification_templates` (`Schema.md` §12.4) sits in the twelve **Platform Reference** tables whose
> preamble states they are _"written **only** by `admin/` through the audited, reason-required path"_.
> But `M-109` creates the table in the notifications sprint, `M-112` places
> `publish-template.use-case.ts` in `notifications/application/use-cases/`, and `FolderStructure.md`
> line 139 places the DLT approval machine in `notifications/domain/`. A table belongs to exactly one
> module (`FolderStructure.md` §8.3 row 3); these two statements cannot both stand.

**Delivering milestones.** `M-109` (all four migrations, `notification_log` hybrid RLS, `cost_minor`
recorded at send) · `M-111` (preferences, quiet hours, caps) · `M-112` (template versioning and DLT).

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

`notifications/` **has controllers** — it is not one of the four provider-only modules of
`FolderStructure.md` §8.2, so `controllers/`, `dto/` and `permissions.ts` are all mandatory here.

| Exported symbol                                                                                                      | Consumers                                                                                                               | Why                                                                                                                                                                                                                                                             |
| :------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The four channel **ports** — `email` · `sms` · `in-app` · `web-push` (`M-018` places them at `notifications/ports/`) | Bound inside this module; the Mailpit and CI-stub adapters satisfy the same contract suite as the four concrete vendors | `FR-NOTF-01`, `A-19`. Nine sprints of feature code send through a stub before a vendor exists; `M-109` swaps adapters with **unchanged port signatures**                                                                                                        |
| A delivery/cost **query port**                                                                                       | `reporting/` (● in the `ModuleDependency.md` §4 matrix, row `reporting`, column `ntf`) and `admin/` (row `admin`)       | `FR-NOTF-08` cost report; the `support-load` and payment-health platform reports. The token name is not fixed by any current document                                                                                                                           |
| `type NotificationFailedPayload`                                                                                     | `reporting/`                                                                                                            | `E7` — a consumer types its handler without importing this module's domain                                                                                                                                                                                      |
| `NOTIFICATION_PERMISSIONS`                                                                                           | The three SPAs via the OpenAPI client                                                                                   | `FR-RBAC-01`. Registry entries in `API_Catalog.md`: `notifications.notification.list` · `.mark_read` · `.mark_all_read` · `notifications.push_subscription.create` · `.delete` · `notifications.preference.read` · `.update` · `notifications.cost_report.read` |

**Never exported:** the rendered body, any recipient address, the `Notification` aggregate, the
template resolver. `M-112` AC 4 makes the last one structural — a structure test forbids **any** other
module reading `notification_templates.body`; the dispatcher's only path to a body is
`TemplateVersionResolver`.

> ⚠ **Conflict — resolve before code.** `M-109` plans
> `notifications/controllers/webhooks/provider-status.webhook.controller.ts`, while
> `FolderStructure.md` §7.3 annotates `controllers/webhooks/` as _"`payments/` only"_ and
> `API_Catalog.md` §7 states _"One route: `POST /v1/webhooks/payments/:provider`. It is the only
> inbound integration surface in Phase 1."_ A signature-verified provider **status callback** is
> either a second webhook surface or something else; the specification does not say which.

**Delivering milestones.** `M-018` (the four ports and the stub adapter) · `M-109` (concrete adapters,
admin cost controller) · `M-110` (notification centre) · `M-111` (preferences controller).

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

| From       | Port                                                                                                                       | Why the answer is needed synchronously                                                                                                                                                                                                                                                                                                        |
| :--------- | :------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `iam/`     | `USER_CONTACT_PORT` (`ModuleDependency.md` §3.2 edge **44**)                                                               | The recipient's channel addresses and preferences are resolved **at send time, never earlier** (`FR-NOTF-05`, `BR-DAT-06`). Resolving earlier means either caching an address — a privacy exposure with a stale copy — or evaluating a preference against a state the member has since changed, which is exactly the `AC-USER-01.1` complaint |
| `common/`  | outbox contract, `Clock`, `IdGenerator`, idempotency store, rate-limit registry, error taxonomy, `ReferenceDataRepository` | `§3.1` universal edge                                                                                                                                                                                                                                                                                                                         |
| `tenancy/` | `TenantContext`, the tenant-scoped Prisma client                                                                           | `§3.1` universal edge. `notification_log` is **HYBRID**: platform rows carry a null `tenant_id` and the policy is `tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::uuid`                                                                                                                                                   |

**`audit/` is deliberately absent.** `ModuleDependency.md` §3.1 lists the `→ audit/` edge as applying
to _"18 modules … all but `common/`, `tenancy/`, `audit/`, `notifications/`, `ledger/`"_. `M-112` AC 10
nonetheless requires every template create, edit, publish, DLT transition, tenant override and
preference change to be audited. Both hold, because the `@Audited()` **decorator and interceptor live
in `common/decorators`** (`FolderStructure.md` §7.2) and inject `AUDIT_WRITE_PORT` themselves — a
controller in this module carries the decorator without importing `audit/`.

**Nothing upward.** `notifications/ → memberships/` to "look up the plan name for the reminder text"
is the named coupling mistake of §4.2; the `membership.renewal-due` payload carries the scalar facts
the template needs.

**Delivering milestones.** `M-109`, `M-110`, `M-111`.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event                 | Payload beyond `tenant_id` + `occurred_at`   | Known consumers | Consumer idempotency key      |
| :-------------------- | :------------------------------------------- | :-------------- | :---------------------------- |
| `notification.failed` | `notification_id`, `channel`, `failure_code` | `reporting/`    | `notification_id` + `attempt` |

One event, out of the fifty-two in `ModuleDependency.md` §8.2. That is the correct shape for a
terminal fan-out surface: it consumes broadly and publishes almost nothing, which is what keeps the
event graph's cycles harmless. `E5` applies without exception here of all places — the payload names
a channel and a failure code, **never the address that failed**.

**Delivering milestones.** `M-110` (dispatcher, poison path and alerting).

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

The largest consumer in the system: **37 of the 52 catalogue rows** name `notifications/` as a
consumer. `M-110` wires the `B5.19` baseline of **24 events → 31 distinct message types**, each
declaring its channel set, category and template key in `notifications/domain/event-catalogue.ts`.
One handler per publishing module, each importing **nothing** from the publisher beyond its event
contract.

| Event                                      | Publisher      | Handler idempotency key (`§8.2`)                  |
| :----------------------------------------- | :------------- | :------------------------------------------------ |
| `user.registered`                          | `iam/`         | `user_id`                                         |
| `user.email-verified`                      | `iam/`         | `user_id`                                         |
| `impersonation.started` / `.ended`         | `iam/`         | `impersonation_id`                                |
| `application.submitted`                    | `onboarding/`  | `application_id` + `version`                      |
| `application.approved`                     | `onboarding/`  | `application_id`                                  |
| `application.rejected` / `.info-requested` | `onboarding/`  | `application_id` + `version`                      |
| `gym.approved`                             | `catalog/`     | `gym_id` + `occurred_at`                          |
| `gym.suspended`                            | `catalog/`     | `gym_id` + `occurred_at`                          |
| `plan.price-changed`                       | `plans/`       | `plan_id` + `revision`                            |
| `staff.invited` / `.deactivated`           | `staff/`       | `staff_id` + `occurred_at`                        |
| `order.created`                            | `ordering/`    | `order_id`                                        |
| `order.cancelled` / `.expired`             | `ordering/`    | `order_id`                                        |
| `coupon.redeemed`                          | `ordering/`    | `coupon_redemption_id`                            |
| `referral.qualified`                       | `ordering/`    | `referral_id`                                     |
| `payment.failed`                           | `payments/`    | `payment_id` + `attempt`                          |
| `payment.duplicate-detected`               | `payments/`    | `payment_id`                                      |
| `membership.created`                       | `memberships/` | `membership_id`                                   |
| `membership.activated`                     | `memberships/` | `membership_id` + `activation_seq`                |
| `membership.frozen` / `.unfrozen`          | `memberships/` | `freeze_id`                                       |
| `membership.expired`                       | `memberships/` | `membership_id` + `end_date`                      |
| `membership.renewal-due`                   | `memberships/` | `membership_id` + `days_before_expiry`            |
| `membership.suspended-for-sharing`         | `memberships/` | `membership_id` + `occurred_at`                   |
| `attendance.sharing-suspected`             | `attendance/`  | `scan_run_id` + `membership_id`                   |
| `review.published`                         | `reviews/`     | `review_id`                                       |
| `wallet.credited`                          | `ledger/`      | `wallet_entry_id`                                 |
| `invoice.issued`                           | `billing/`     | `invoice_id`                                      |
| `credit-note.issued`                       | `billing/`     | `credit_note_id`                                  |
| `subscription.past-due`                    | `billing/`     | `tenant_id` + `billing_period`                    |
| `refund.requested` / `.approved`           | `refunds/`     | `refund_id` + `status`                            |
| `refund.completed`                         | `refunds/`     | `refund_id`                                       |
| `dispute.opened` / `.resolved`             | `refunds/`     | `dispute_id` + `status`                           |
| `settlement.batch-built`                   | `settlements/` | `batch_id`                                        |
| `settlement.paid`                          | `settlements/` | `batch_id`                                        |
| `settlement.failed`                        | `settlements/` | `batch_id` + `attempt`                            |
| `reserve.released`                         | `settlements/` | `reserve_id`                                      |
| `export.completed`                         | `reporting/`   | `export_job_id`                                   |
| `ticket.created` / `.resolved`             | `support/`     | `ticket_id` + `status`                            |
| `config.changed` / `flag.changed`          | `admin/`       | `config_key` + `version` / `flag_key` + `version` |

**Two idempotency layers, not one.** The handler key above stops a _duplicated event_ from producing a
second message. Underneath it, ADR-0017's **consumer-idempotency check** —
`idx_notification_log__recipient_template_aggregate (recipient_id, template_key, aggregate_id)` —
is consulted _before dispatching_ and stops two different events from producing the same message twice
(`Schema.md` §11.1). `M-110` AC 2 adds a third at the transport level: dispatch is idempotent on the
**outbox event id**, proven under a simulated Redis failover.

**Delivering milestones.** `M-110` (the 24-event catalogue on real triggers).

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

### The `§C5` job

| Field              | Value                                                                                                                                                                                                                                                           |
| :----------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Job                | **`notification.dispatch`** — `§C5` job **19**                                                                                                                                                                                                                  |
| Queue · class      | `notifications` · **P2 `MEMBER_VISIBLE`** (semaphore 8 normal, 6 at gym peak — _reduced, never stopped_)                                                                                                                                                        |
| Schedule           | **Continuous**, 5 s relay                                                                                                                                                                                                                                       |
| Concurrency        | **6** — the largest P2 allocation in the system                                                                                                                                                                                                                 |
| Scope              | `PL→TS` — platform elevation to select, tenant context to write                                                                                                                                                                                                 |
| Lock key           | `notification.dispatch:shard_{n}:{tick}`                                                                                                                                                                                                                        |
| Expected duration  | **200 ms per batch** at Y1 and at 10× (10× means more batches, not slower ones)                                                                                                                                                                                 |
| Depth envelope     | **oldest pending < 60 s**; `queue_depth{queue="notifications"}` envelope 5,000 / age 300 s (`ALRT-20`)                                                                                                                                                          |
| If it falls behind | **Everything downstream of the outbox stops** — notifications, projections, aggregations, cache invalidation, search freshness. `Scalability.md` §8.3.2: _"the single highest-leverage job in the system"_. **P2 page at 300 s**                                |
| Kill-switch        | `ops.notifications.dispatch`. Pulled, the outbox keeps accumulating and the in-app centre keeps recording, so **nothing is lost**; on restore the backlog drains under the per-recipient per-category limit so nobody receives forty messages in ninety seconds |

### Planned processors that are _not_ among the twenty-four

`M-110` – `M-112` add `renewal-reminder-batch` (per tenant per day at 09:00 gym-time, through the
`M-063` timezone primitive), `bulk-send` (`GymCeasedOperating`, 400 recipients inside the `BR-MEM-14`
24-hour SLA), `quiet-hours-release`, `cap-window-reset`, `dlt-approval-poll` (daily, alerts on any
template pending beyond the stated lead time) and `cost-rollup`.

`membership.renewal-reminders` (`§C5` job **4**) stays in `memberships/` on the `memberships` queue —
it _emits_ `membership.renewal-due`. This module's batch processor then collapses those into **one
message per tenant per day**, because `BR-MEM-11` says one and a member with two memberships at one
gym must not get two (`M-110` note).

> ⚠ **Flag.** `§C5` enumerates twenty-four jobs and `Scalability.md` §8.2 allocates exactly those
> twenty-four across fourteen queues. Six additional processors here have no `§C5` row, no declared
> class, no lock-key grammar instance and no duration envelope. Either they are internal steps of
> `notification.dispatch` or `§C5` needs an amendment under `§C10`.
> Separately: `Scalability.md` §8.2 quotes ADR-0009 as placing processors in
> `<module>/application/jobs/`, while `FolderStructure.md` §8 and every milestone file list use
> `<module>/jobs/`. One path, two documents.

**Delivering milestones.** `M-018` (BullMQ harness and the `SKIP LOCKED` dispatcher) · `M-110`
(resilience: restart mid-drain, Redis failover, poison path) · `M-111` (quiet-hours release, cap
reset) · `M-112` (DLT approval poll).

## 9. Top three failure modes (`NFR-MNT-09`)

|  #  | Failure                                                                                                                                                                                                | Signal                                                                                                                                                                                                                                                                                   | First action                                                                                                                                                                                                                                                                         |
| :-: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Dispatcher stalled.** Not a notification problem — an _everything_ problem. The outbox stops draining, so projections, aggregations, cache invalidation and search freshness stop with it            | `queue_oldest_job_age_seconds{queue="notifications"} > 300` or `queue_active_workers == 0` while `queue_depth > 0` (`ALRT-20`, **P2 page**)                                                                                                                                              | Bull Board (`A-30`, `access(mfa)` + `admin.system_queue.read`): is the queue paused, are workers alive, is one message type dominating? Do **not** pull `ops.notifications.dispatch` — it is already effectively pulled and pulling it hides the recovery                            |
|  2  | **TRAI DLT rejection or template mismatch (India).** Every SMS on that template is dropped **by the operator** while our own delivery metrics may still report "sent to provider"                      | `increase(notification_dlt_rejections_total[15m]) > 0` for any of `TEMPLATE_NOT_APPROVED`, `TEMPLATE_MISMATCH`, `HEADER_NOT_REGISTERED`, `DLT_ENTITY_BLOCKED` (`ALRT-46`; **S1** for `DLT_ENTITY_BLOCKED`, S2 otherwise). Also `notification_templates_pending_dlt_current > 0` for 72 h | List SMS templates not `APPROVED` and compare the **rendered** body against the registered DLT template character-for-character — DLT matches exactly on static portions and variable count. The automatic fallback is already in force: the previous approved version keeps sending |
|  3  | **Delivery failure rate above 10% on a channel.** Transactional failures break OTP login and payment receipts; operational failures silently kill the `BR-MEM-11` reminder ladder and `KPI-12` with it | `notification_delivery_total{status=~"FAILED\|BOUNCED"} / notification_delivery_total > 10%` per channel for 15 m, or a channel circuit open (`ALRT-38`; S2 transactional, S3 otherwise)                                                                                                 | Split by `channel` and `provider`. **If SMS only, go straight to failure mode 2** — in India an SMS failure is more often regulatory than technical                                                                                                                                  |

Runbook: [`/docs/runbooks/notifications.md`](/docs/runbooks/notifications.md)
