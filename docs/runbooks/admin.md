# admin runbook

> **Status: stub.** `NFR-MNT-09` requires a runbook per module covering its top three failure modes.
> The three below are fixed by `PROJECT_CONSTITUTION.md` §18.5.1. The eight-field per-mode structure
> of `Monitoring.md` §9.1 — symptom, alert, blast radius, diagnose, mitigate, fix, verify, prevent —
> is filled in by the milestones named under **Dashboards and queries**; `RB2` requires every query
> here to have been **run**, and none can be before the tables exist.
>
> Owner **Technical Lead** · `Monitoring.md` §9.6 names this file `admin.md`, agreeing with
> `FolderStructure.md` §8.3 row 9, so there is no filename conflict here.
>
> **No `ALRT-nn` exists for this module, and the gap is the point.** `Monitoring.md` §9.6's primary-
> alert column for `admin` reads *"Flag-evaluation failure, config blast radius"* — two prose
> descriptions where every other row carries numbers. §5 defines no alert for either.
> `feature_flag_evaluations_total{flag_key,result}` exists and routes to the `D-ENG` dashboard, not to
> an alert. The three alert definitions the roadmap does create —
> `infra/monitoring/alerts/commission-rate-clamped.yaml` (`M-114`), `audit-partition-lead.yaml` and
> `audit-seal-verification.yaml` (`M-117`) — are unnumbered and the last two belong to `audit/`. Two
> `ALRT-nn` rows are needed in `Monitoring.md` §5 before `M-115` and `M-116` ship. Until then the
> failure modes below are detected by dashboards and by tenants telling us, which for a module whose
> writes reconfigure every other module is not adequate.

## Scope

`admin/` is the **write** surface for platform-global configuration, and only the write surface. It
owns the twelve `§C2.3` global tables — `countries`, `cities`, `localities`, `amenities`,
`gym_categories`, `subscription_tiers`, `tax_profiles`, `kyc_checklists`, `reason_codes`,
`feature_flags`, `notification_templates`, `help_articles` — plus `commission_rules`. All are
**GLOBAL**: no `tenant_id`, **RLS not enabled**, reached by every other module through
`common/persistence/reference-data.repository.ts` so the exemption is greppable rather than implicit
(constitution §11.5 **BR4**). Grants are **G-REF**, retention **R-REF** except `tax_profiles`,
`subscription_tiers` and `commission_rules`, which are **R-FIN** because an issued document
references the version in force. It is the only module with no `domain/` directory
(`FolderStructure.md` §8.1) — its domain *is* configuration.

It is ordinal **23**, the maximum, and it may reach almost everything: twenty-two outbound edges,
zero inbound. It imports **command interfaces only** — never a domain entity, never a repository —
enforced by `dependency-cruiser` rule 21 `admin-command-only`. That constraint is what makes
`FR-ADMN-02` verifiable: an admin action is always the same shape as the action a user would take,
with an extra reason and an audit row. The reverse edge is forbidden for a structural reason
(`ModuleDependency.md` §0 **C-3**): a module that imported `admin/` to read a configured value would
create an upward edge from almost every module in the system and collapse the DAG in one move.
Configuration reaches consumers as `config.changed` and `flag.changed` events, keyed
`config_key + version` and `flag_key + version`, never as imports.

Every write is reason-required (`422 REASON_REQUIRED`), shows a blast-radius preview counting
affected entities per surface **before** it commits, and lands in **one transaction with its
`audit_log` row** — the Redis evaluation-cache entry is invalidated **after** commit, never before.
Propagation is bounded at **60 seconds** by the cache TTL, the same number `FR-RBAC-04` already gives
for role changes, so the platform has one answer to *"how long until a permission-shaped change takes
effect"* rather than two.

**Blast radius when this module is down.** This is the payoff of C-3, and it is worth stating
precisely because the intuition is wrong: **nothing that reads configuration stops.** Every consumer
reads the global tables through `common/`, and the evaluator's Redis cache holds resolved values for
60 s, so requests, checkouts, check-ins and flag-gated capabilities all continue on the last written
state. What stops is **changing** anything: no commission override, no tax-profile version, no
taxonomy edit, no template change, no staff invitation or session revocation, and no
`FR-ADMN-11`/`FR-ADMN-12` queue management. The consequence that matters at 02:00 is narrower and
sharper — **the nine `ops.*` kill-switches are pulled through this module's write path**
(`PUT /admin/config/flags`, `SUPER_ADMIN` only). An `admin/` outage during another incident removes
the cheapest rollback the platform has, which `CI_CD.md` names as the mechanism that makes
trunk-based development safe. That dependency is why the 90-day Staging pull drill
(`FEATURE_FLAGS.md` §7.5) is a drill of the *write path*, not just of the flag.

**Kill switches: none of its own, and that is correct.** A kill switch on the configuration surface
would be a switch that disables the ability to pull switches. `FR-ADMN-02`'s reason requirement and
audit are compliance obligations, not features, so neither is flaggable. `NFR-MNT-07`'s *"instant
rollback"* means one audited write plus ≤ 60 seconds — never a revert, never a redeploy, never a
migration.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **1 — Configuration change with unintended blast radius.** A change commits and something unrelated moves: invoices priced differently, pickers empty, a tier's limits shifting under live tenants, or `gym.commission.rate_clamped.count` incrementing. There is **no alert**; the signal is usually a tenant, a Finance query, or the `M-115` `config-change-blast-radius-exceeded` condition. A **clamped commission rate is the quiet one** — a clamp produces a *plausible* invoice, so the metric is the only evidence the configuration is wrong rather than the sale | A registry key edited without reading its blast-radius preview; a tier delta larger than the base rate (the clamp case); a `fy_start_month` change crossing a financial-year boundary; or a taxonomy write whose CDN purge did not run, leaving cached pages disagreeing with the database for longer than the 60 s TTL suggests | **Read the `audit_log` row before touching the configuration.** The config row and its audit row commit together, so the before/after state, the actor and the mandatory reason are all present and the change is fully reconstructable — reverting from memory is how a second, different wrong value gets written. Then establish whether the value is *versioned* or *replaced*: `tax_profiles`, `subscription_tiers`, `kyc_checklists` and `commission_rules` are **append-only with validity windows**, so the correction is a new version and the old one must stay exactly where it is. Confirm the cache was invalidated **after** commit and that ≤ 60 s has actually elapsed before concluding the change did not take | Ticket to Technical Lead. **A commission or tax-profile change escalates to Finance immediately**, because both are `R-FIN` and both are referenced by issued documents. A change that appears to have altered a **historical** figure is an S1: `M-114` AC 7 and `M-115` AC 1 both assert that reopening last month's statement shows the original rate, so a moved historical figure means an append-only guarantee failed, not that a value was mis-set |
| **2 — Feature-flag evaluation failure.** A capability appears for the wrong cohort, flips between requests, or a caller receives `403 FEATURE_NOT_ENABLED` unexpectedly. `feature_flag_evaluations_total{flag_key,result}` on `D-ENG` is the only telemetry, and it has no alert. Members and tenants report this before a dashboard does | Four distinct causes with different fixes: (a) **bucket instability** — a rollout percentage raised in a way that re-buckets, or bucketing on a request id, session id, IP or clock rather than the `§5.3` identifier; (b) a **targeting write landing mid-request**, which produces a response half-on and half-off; (c) evaluation **outside a tenant context** on a tenant-scoped surface; (d) the Redis evaluation cache or the flag store unreachable | Read the evaluator's `{ value, source, rule_id }` triple out of the structured log against the request's `correlation_id` — `source` ∈ {`tenant_override`, `role`, `percentage`, `default`} answers *"why did this user see that?"* from logs alone, without reproducing the state, and that is the whole reason the triple is logged. Precedence is **tenant → role → percentage → default, first match wins**, and an `OFF` tenant override beats a 100% rollout, so an "unexpectedly off" report is very often an override working correctly. An **unknown key is a build failure** (`FF-CI-01`), never a silent `false` — if an unknown key is reaching the evaluator at runtime, the CI gate has been bypassed and that is the incident. **Never disable a flag check to restore service on a `§6.3` protected rule** | Ticket to Technical Lead; page if the affected flag is an `ops.*` kill-switch, because a kill-switch that evaluates unreliably is a control that cannot be trusted at the moment it is needed. **Gap, recorded:** `FEATURE_FLAGS.md` §5 specifies that a default always exists and that there is no unset state, but it does **not** state what the evaluator returns when both the cache and the flag store are unreachable. Fail-open and fail-closed give opposite answers for `ops.*` versus `ent.*`, and the position must be decided in `M-116`, not improvised during an incident |
| **3 — Taxonomy change orphaning references.** A deprecated or removed amenity, category, city, locality or reason code stops resolving: a gym profile renders a blank chip, a check-in denial shows a bare code with no display text, an eight-month-old audit row points at nothing, or a filter silently returns zero results | Deleting a value that is "obviously unused". It is referenced by a gym profile, a denial reason or a historical record, and deleting it turns that record into a dangling id. The design forbids it — **there is no `DELETE` grant on any taxonomy table** — so a genuine orphan means either the grant is missing on a table added later, or the reference was written against a value that never existed | Confirm the **deprecation** semantics before assuming deletion: a deprecated value disappears from pickers, **remains resolvable on every row that already carries it**, and the write purges the CDN. A blank chip with the row still present is therefore a **rendering or cache** fault, not a data one — check the CDN purge before the database. If a row is genuinely absent, find the write path that removed it: the grant should have refused, and a grant that did not is a schema defect and a hotfix. `reason_codes` has a standing consistency check — a code in the table with no matching enum value, or the reverse, is a CI failure — and running it manually is the fastest confirmation | Ticket to Technical Lead. `reason_codes` orphans escalate to the owning module lead as well, because `NFR-USE-05` requires every error to state what, why and what next, and the `help_article_id` link **is** the "what next" — a reason code that will not resolve degrades an error message into a code, which is the failure `NFR-USE-05` exists to prevent |

**One boundary worth stating before an incident, not during one.** `FR-ADMN-09`'s audit explorer is
an `admin/` responsibility in the charter, but the log and the query both live in `audit/` and reach
this module through `audit/ports/audit-read.port.ts` (`FolderStructure.md` §8.2). `audit/` has no
controllers precisely so its *writer* is unreachable from the administration UI. An audit-explorer
incident — partition lead, seal verification, an explorer query timing out at scale — is therefore
**`audit.md`'s**, not this file's, even though the screen that surfaces it is `SCR-ADM-015`.

## Dashboards and queries

_To be populated by **M-114** (one commission resolver, global < tier < tenant, with the 0 bps
floor), **M-115** (tax profiles append-only, the KYC checklist, taxonomy that deprecates and never
deletes), **M-116** (feature flags with tenant, role, percentage and city targeting) and **M-117**
(the audit explorer, whose panels are shared with `audit.md`)._

Intended content, named now so those milestones have a target:

- **Panel — flag evaluation.** `feature_flag_evaluations_total` by `flag_key` and `result`, with the
  `source` distribution beside it. A rollout whose `percentage` share moves while `rollout_bps` is
  unchanged is bucket instability, which is the §5.3 defect and is invisible on a plain on/off count.
- **Panel — the nine `ops.*` kill-switches.** Current position, days since the last recorded pull
  drill against the 90-day requirement, and the `PROFILE-DEGRADED` matrix result. Every one is
  `PERMANENT` by design, exempt from `FF-CI-04`, and has no targeting — `FF-CI-07` fails the build on
  a targeting rule attached to an `ops.*` key, because a kill-switch pulled for 50% of traffic has
  not been pulled.
- **Panel — registry pressure.** Active non-`ops` flags per `§C1.3` module against `FF-CI-09`'s
  limit of **8 per module / 30 platform-wide**, and flags at 100% or `DEFAULT-ON` for more than 30
  days against `FF-CI-10`. Both are build gates; the panel exists so the gate is never the first
  warning.
- **Panel — configuration change rate.** Writes per configuration key over time, with commission and
  tax-profile changes rendered distinctly because they are `R-FIN`. A key changing repeatedly in a
  short window is either a live investigation or an argument, and both are worth seeing.
- **Panel — commission clamp.** `gym.commission.rate_clamped.count`. **A clamp means the
  configuration is wrong, not the sale.** *Recorded conflict:* `M-114` specifies this metric with
  `{tenant_id, tier}` labels, and `Monitoring.md` correction **C-2** / `MT2` permit `tenant_id` on
  `settlement_reconciliation_variance_minor` and on nothing else. Under the §3.8 replacement pattern
  this becomes an unlabelled counter plus a runbook query naming the tenant — which is the query
  below. `M-114` must move, or an `MT2` exemption must be recorded.
- **Query — effective commission for a tenant, with its source.** The resolver's own output shape:
  level, rule id, actor, date, reason, validity window, and whether the value was clamped. The tenant
  detail screen renders this verbatim (`AC-ADMN-01.2`), so the query and the screen must agree — and
  this is the `tenant_id`-naming replacement for the clamp metric.
- **Query — configuration versions in force at an instant.** For `tax_profiles`,
  `subscription_tiers`, `kyc_checklists` and `commission_rules`, the row whose validity window covers
  a given timestamp. This is how *"which profile priced this invoice"* is answered without trusting a
  current-state read, and it is the verification that an append-only correction landed.
- **Query — overlapping validity windows.** The exclusion constraints
  (`ex_commission_rules__no_overlap` and its siblings) should make this **empty by construction**; a
  row means a constraint is missing on a table added later, and two rules effective for one scope at
  one instant is a silent wrong-rate defect.
- **Query — taxonomy references to deprecated values.** Counts of live rows still pointing at a
  `deprecated_at` value, per taxonomy table. This is not an error list — a deprecated value
  legitimately remains resolvable on existing rows — it is the **blast-radius answer** for a
  deprecation about to happen, and it is the same count `previewImpact(key, newValue)` returns.
- **Query — `reason_codes` against the enum catalogue.** Both directions. A code with no enum value,
  or an enum value with no code, is a CI failure (`Schema.md` §12.2) and the fastest confirmation of
  failure mode 3.
- **Data recovery note.** Configuration is **versioned, never edited**: a rate change writes a new
  version with a validity window and the superseded row stays untouched, so an invoice issued last
  year still resolves to the profile that priced it. `UPDATE tax_profiles SET rate = 18` is one
  statement, looks like the obvious fix, and silently rewrites the tax basis of every invoice ever
  issued under that profile — append-only with a validity window costs one extra row and is the
  difference between a configuration system and a time machine. Taxonomy has **no `DELETE` grant**,
  so recovery from a deprecation is clearing `deprecated_at` plus a CDN purge. If `git revert`
  removes the administration surface entirely, configuration falls back to the **migration-time
  seeds** — the seeded India profile — which is a degradation of *operability*, not of correctness;
  versions already written are retained because issued documents reference them.

## Known incidents

_None yet._
