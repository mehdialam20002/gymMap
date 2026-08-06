# admin

**Charter (PRD §C1.3):** _configuration, feature flags, taxonomy, audit explorer._

## 1. Bounded context

`admin/` owns the **platform's own configuration** — the values every other module reads and none
of them may set. Commission rules, subscription tiers, tax profiles, the KYC checklist, the
amenity and category taxonomy, feature flags, notification templates, cities and their launch
gates, reason codes, report definitions.

The decision it owns that no other module may take: **what the platform-wide defaults are, and
what a change to one costs.** `settlements/` computes a payout at whatever commission rate is in
force; it does not get to decide the rate. `catalog/` renders whatever amenities exist; it does
not get to invent one. Concentrating that here is what makes a config change reviewable — the
blast radius of "raise the standard commission by 100 bps" is knowable because exactly one module
can do it.

Two properties follow from that, and both are load-bearing:

- **Every mutation carries a written reason** (`REASON_REQUIRED`, 422). Configuration has no
  natural audit trail — the new value looks exactly as legitimate as the old one, and six months
  later nobody can reconstruct why a tier's rate changed. The reason string is the record.
- **`admin/` reads the audit log; it can never write one.** The audit _writer_ must not be
  reachable from the administration UI (`FolderStructure.md` §8.2). `admin/` consumes
  `audit/ports/audit-read.port.ts` for `FR-ADMN-09`, and nothing outside `audit/` holds the write
  port. A mutable audit log is worse than none: it launders an attacker's actions into apparent
  legitimacy (`AC-ADMN-02.3` — _"no such capability exists"_).

`ModuleDependency.md` §1124 records the extraction analysis: no FKs out, nothing depends on it,
but **twenty-two outbound ports**. Extraction is possible and pointless — it would be a
UI-shaped service making twenty-two calls.

`admin/` has **no `domain/`** (`FolderStructure.md` §8.1): its domain _is_ configuration, and the
rules that act on that configuration live in the modules that read it.

## 2. PRD identifiers

`FR-ADMN-01` … `FR-ADMN-14` · `BR-DAT-01`, `BR-DAT-02` (audit explorer) · `BR-CPN-05`,
`BR-FIN-03` (commission configuration) · `AC-ADMN-02.3` (audit immutability) ·
`SCR-ADM-001`, `SCR-ADM-004`, `SCR-ADM-011`, `SCR-ADM-013`, `SCR-ADM-014` · `§C2.3` (the fourteen
platform-global reference tables) · `§C9.4` (city launch gates) · `NFR-MNT-09`.

> **Gap, recorded not resolved.** `Monitoring.md` §9.6 gives `admin/` prose — _"flag-evaluation
> failure, config blast radius"_ — where every other module has numbered `ALRT-nn` rows, and §5
> defines none. Two alert rows are needed before M-115/M-116. See `docs/runbooks/admin.md`.

## 3. Owned tables

_Planned. No code in this module yet — populated by the milestones listed below._

The `G-REF` class of `Constraints.md` §9 — the fourteen platform-global reference tables of
`§C2.3`. They are **GLOBAL**, not RLS: they have no `tenant_id`, because a commission rule that
applied to only one tenant would not be a platform default.

| Table                               | Note                                                                    |
| :---------------------------------- | :---------------------------------------------------------------------- |
| `commission_rules`                  | Append-only. Global &lt; tier &lt; tenant resolution with a 0 bps floor |
| `subscription_tiers`                | Starter / Growth / Professional                                         |
| `tax_profiles`                      | Append-only. India: CGST 9% + SGST 9% intra-state                       |
| `kyc_checklists`                    | The ten-document India checklist as data, not code                      |
| `amenities`, `gym_categories`       | Taxonomy. Deprecated, never deleted                                     |
| `reason_codes`                      | The five typed taxonomies of `§C2.3`                                    |
| `feature_flags`                     | Tenant / role / percentage / city targeting                             |
| `notification_templates`            | With TRAI DLT approval state                                            |
| `countries`, `cities`, `localities` | `city_status_enum`: PLANNED → GATED → LIVE → PAUSED                     |
| `help_articles`                     | Deflection content for `SCR-WEB-017`                                    |
| `segments`, `report_definitions`    | Shared with `crm/` and `reporting/`                                     |

**Delivering milestones** — M-114 (commission resolver), M-115 (tax profiles, KYC checklist,
taxonomy), M-116 (feature flags), M-117 (the console).

## 4. Public surface

_Planned. No code in this module yet — populated by the milestones listed below._

Nothing depends on `admin/` (`ModuleDependency.md` §1124), so its `index.ts` exports the module
and its controllers only — no port is consumed by another module. Configuration flows outward as
**reads of the `G-REF` tables**, not as an injected `admin/` service; that keeps the dependency
arrow pointing at the data rather than at this module.

**Delivering milestones** — M-114 … M-117.

## 5. Consumed ports

_Planned. No code in this module yet — populated by the milestones listed below._

Twenty-two outbound ports — the largest fan-out in the system, and the reason extraction is
pointless. The console reads from nearly every module because it _is_ the operator's view of the
whole platform. The synchronous ones are synchronous because an operator is waiting:

| Port                                    | Why the answer is needed synchronously                                                   |
| :-------------------------------------- | :--------------------------------------------------------------------------------------- |
| `AUDIT_READ_PORT` (`audit/`)            | The audit explorer is a query surface; there is no async form of "show me what happened" |
| `TENANT_QUERY_PORT` (`tenancy/`)        | The blast-radius preview must count affected tenants **before** the operator confirms    |
| `SETTLEMENT_READ_PORT` (`settlements/`) | `SCR-ADM-007` renders a batch the operator is deciding on                                |
| `LEDGER_READ_PORT` (`ledger/`)          | Reconciliation drill-down, `SCR-ADM-010`                                                 |
| `USER_QUERY_PORT` (`iam/`)              | `SCR-ADM-005`                                                                            |

**Delivering milestones** — M-114 … M-117, M-097, M-107.

## 6. Emitted events

_Planned. No code in this module yet — populated by the milestones listed below._

| Event                  | Payload                                                             | Known consumers                                                                 |
| :--------------------- | :------------------------------------------------------------------ | :------------------------------------------------------------------------------ |
| `config.changed`       | `entity_type`, `entity_id`, `reason`, `actor_id`, `before`, `after` | `audit/` (via the `@Audited()` interceptor), cache invalidation in every reader |
| `feature_flag.changed` | `flag_key`, `targeting`, `reason`, `actor_id`                       | Flag-evaluation caches                                                          |
| `city.status_changed`  | `city_id`, `from`, `to`, `gate_results`                             | `discovery/` — a `PAUSED` city leaves search                                    |

**Delivering milestones** — M-115, M-116.

## 7. Consumed events

_Planned. No code in this module yet — populated by the milestones listed below._

**None.** `admin/` is the top of the dependency graph: it is written by operators, not by the
system. Configuration that changed itself in response to an event would be configuration nobody
could reason about — the blast-radius preview in §5 assumes the value only moves when a person
moves it.

## 8. Jobs

_Planned. No code in this module yet — populated by the milestones listed below._

**None in `§C5`.** The twenty-four scheduled jobs belong to the modules that own the data they
touch. `admin/` owns configuration, which has no schedule.

The one thing that looks like a job and is not: the `§C9.4` city launch gates are **evaluated on
read** for `SCR-ADM-014`, not swept nightly, so an operator never sees a stale gate result while
deciding whether to open a city.

**Delivering milestone** — M-107 (the city-gate panel).

## 9. Top three failure modes

`NFR-MNT-09`. Full procedures: [`/docs/runbooks/admin.md`](../../../../docs/runbooks/admin.md).

|  #  | Signal                                                                                                                         | First action                                                                                                                                                                                                                                                                                            |
| :-: | :----------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|  1  | **Flag evaluation failing** — the evaluator cannot reach cache or store                                                        | Confirm the fail-open/fail-closed direction _before_ acting. `FEATURE_FLAGS.md` §5 never states it, and the correct answer is **opposite** for `ops.*` (fail open — the platform keeps working) and `ent.*` (fail closed — an entitlement must never be granted by an outage). Recorded as an open gap. |
|  2  | **A config change with an unintended blast radius** — a commission or tax edit hitting more tenants than the operator expected | Read the reason string and the `config.changed` audit row, then compensate forward. Configuration is append-only where money depends on it (`commission_rules`, `tax_profiles`), so recovery is a new row, never an edit.                                                                               |
|  3  | **Audit explorer returning nothing, or too much**                                                                              | Distinguish "no rows" from "no permission" from "the partition is missing". An empty audit result is indistinguishable from a correct answer, which is exactly the `Security.md` P3 failure — check the monthly partition exists before concluding nothing happened.                                    |
