# notifications runbook

`NFR-MNT-09`. Module: [`apps/server/src/notifications`](../../apps/server/src/notifications/README.md).

## Scope

`notifications/` turns domain facts into delivered messages. It owns the four channel adapters (email,
SMS, in-app, web push — `FR-NOTF-01`), the versioned template store and its TRAI DLT approval state,
per-user per-channel preferences and quiet hours (`FR-NOTF-02`, `FR-NOTF-05`), per-recipient and
per-tenant rate limiting (`FR-NOTF-06`), and `notification_log` — the delivery record of every attempt
with its provider response and its recorded cost (`FR-NOTF-04`, `FR-NOTF-08`). It also owns
`notification.dispatch` (`§C5` job 19), the outbox relay, which means an incident here is rarely
confined to notifications: **everything downstream of the outbox drains through this job** —
projections, aggregations, cache invalidation and search freshness included. The module never decides
*that* something is worth telling someone; a publisher's domain event decides that. It decides whether,
where, when and in what words.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| `queue_oldest_job_age_seconds{queue="notifications"} > 300`, or `queue_active_workers == 0` while `queue_depth > 0` for 5 m (`ALRT-20`) | Worker tier down, queue paused, Redis failover mid-drain, or one poison message blocking the head | Open Bull Board (`GET /admin/system/queues`, `access(mfa)` + `admin.system_queue.read`). Confirm workers alive and the queue unpaused; check `<queue>.dlq` depth. Do **not** pull `ops.notifications.dispatch` — the queue is already not draining and the switch only hides recovery | **P2 page** to on-call. Sustained beyond 15 m, notify Backend Lead: renewal reminders are missing their `BR-MEM-11` window and `KPI-12` degrades silently |
| `increase(notification_dlt_rejections_total[15m]) > 0` for `TEMPLATE_NOT_APPROVED`, `TEMPLATE_MISMATCH`, `HEADER_NOT_REGISTERED` or `DLT_ENTITY_BLOCKED` (`ALRT-46`) | An SMS template was edited and the rendered body no longer matches the registered DLT template; or the sender header was de-registered; or the DLT entity itself is blocked | `SELECT template_key, dlt_template_id, approval_state, updated_at FROM notification_templates WHERE channel='SMS' AND approval_state <> 'DLT_APPROVED';` then diff the **rendered** body against the registered template character-for-character — DLT matches exactly on static text and on variable count. The fallback is automatic: the previous `APPROVED` version keeps sending | `DLT_ENTITY_BLOCKED` is **S1** — pages on-call, Technical Lead and the client sponsor, because only the registered entity can resolve it with the operator, and SMS OTP login is down country-wide. Other reasons are S2; OTP substitutes to email per `AC-AUTH-01.5` |
| `notification_templates_pending_dlt_current > 0` for more than 72 h (`ALRT-46`, S3) | A template edit is sitting in `PENDING_DLT_APPROVAL` beyond the operator's stated lead time | Check `notification.dlt-approval-poll`'s stored operator response. Sending is unaffected — the previous approved version is still in force — so this is a backlog, not an outage | Ticket to Product; the lead time is a **data** dependency on an external regulator, not a code problem |
| `notification_delivery_total{status=~"FAILED\|BOUNCED"} / notification_delivery_total > 10%` per channel for 15 m (`ALRT-38`) | Vendor incident, credential expiry, circuit open, or a content rejection pattern | Split by `channel` and `provider`. **SMS only → go to the DLT rows above.** Email only → check the provider status callback ingress and the bounce classification | S2 for the transactional category (OTP and payment receipts), S3 for operational and marketing. Transactional failures page inside the gym-critical window |
| Projected month-end `notification_cost_minor_total` > 120% of budget, evaluated daily 09:00 IST (`ALRT-45`) | A retry storm, an unbatched reminder run, an OTP amplification loop, or organic growth | Group `notification_cost_minor_total` by `channel`, then by `category` in the database — a marketing campaign, a retry storm and real growth have three different shapes. Check `otp_per_registration_ratio` | Ticket to Finance + Product. Levers are per-tenant caps (degrade the channel to email, never drop the message) and email-first routing, both configuration |
| Messages arriving that a member opted out of, or arriving inside quiet hours | Suppression evaluated at **list build** instead of at dispatch — the defect `AC-USER-01.1` exists to catch | Confirm `SuppressionEvaluator` is invoked inside the dispatcher per recipient. Check `notification_log.suppression_reason` on comparable rows: a correctly suppressed message leaves a row with a reason, not an absent row | S2 and a regulatory/reputational matter, not a cosmetic one. Notify Product Manager. Never "fix" it by disabling the category |
| `notification_log` row count approaching 100 M | Growth, dominated by the in-app check-in confirmation at 50,000/day | Verify `data.retention-sweep` is applying `SC-R03` category-scoped retention: `OPERATIONAL` 90 days, `TRANSACTIONAL` per `NFR-PRV-04`. Steady state should be ≈2.0 GB, not 8.0 GB/yr | Ticket to Backend Lead — 100 M is the documented trigger to apply the **pre-planned** monthly partitioning (`M-109` AC 9) |

## Dashboards and queries

_To be populated by `M-109` – `M-112` (Sprint 14, `EP-17`)._ Intended content:

- **Delivery board** — `notification_delivery_total` by `channel` × `category` × `status`, the eight
  statuses including the three `SUPPRESSED_*` variants, so a suppression is visibly distinct from a
  failure. `SLO` view for the transactional category.
- **Dispatch health** — `queue_depth{queue="notifications"}`, `queue_oldest_job_age_seconds`,
  `queue_active_workers`, `notifications.dlq` depth, and the P2 class-semaphore occupancy at gym peak.
- **India DLT panel** — `notification_dlt_rejections_total` by `reason`,
  `notification_templates_pending_dlt_current`, and time-in-`PENDING_DLT_APPROVAL` per template.
- **Cost** — `notification_cost_minor_total` by `channel`, month-to-date against budget, plus
  cost-per-membership and `otp_per_registration_ratio` (`RSK-12`).
- **Named queries** to be written here: templates not `DLT_APPROVED`; per-tenant cap utilisation this
  window; messages deferred by quiet hours and awaiting release; the consumer-idempotency near-miss
  count on `(recipient_id, template_key, aggregate_id)`.
- **Alert files** — `infra/monitoring/alerts/notification-cost-per-membership.yaml` (`M-110`).

Correlation: every delivery carries the originating `correlation_id` through
`notification_log.correlation_id` alongside `provider_message_id` (`Monitoring.md` boundary **B5**), so
"which request sent this SMS?" is answerable — which TRAI DLT makes a compliance question, not a
curiosity.

## Known incidents

_None yet._
