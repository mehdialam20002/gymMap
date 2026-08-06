# audit runbook

**Module:** `audit/` · **Layer:** L1, isolation and attribution · **Owner:** Technical Lead
**Module README:** [`apps/server/src/audit/README.md`](../../apps/server/src/audit/README.md)
**Satisfies:** `NFR-MNT-09` · **Failure modes declared by:** `PROJECT_CONSTITUTION.md` §18.5.1
**Primary alerts:** `ALRT-17` (append-only violation), `ALRT-21` (partition maintenance)

> **Status: stub.** The failure modes, signals and first actions below are derived from the
> specification and are binding. Dashboards, queries and incident history are populated by the
> milestones named in each section.

---

## Scope

`audit/` writes and reads the append-only record of every mutation on a governed entity — actor,
timestamp, IP, entity, action, before-state, after-state, reason, correlation id, and
`impersonated_by` where a support agent was acting as someone else. It owns `audit_log`: monthly
range-partitioned on `occurred_at`, seven-year retention, `DUAL` tenancy because a platform action
has no tenant. Its guarantee is **custody, enforced by grant rather than by code**: `app_append`
holds `INSERT` and no `SELECT`; `app_rw` holds `SELECT` and no `INSERT`, `UPDATE` or `DELETE`; **no
role holds `UPDATE` or `DELETE` on any partition.** A `BEFORE UPDATE OR DELETE` trigger raising
unconditionally is the second line and never the only one, because a trigger can be disabled by the
table owner and the maintenance job runs as the owner. The writer is unreachable from HTTP by
design; `admin/` reads through `AUDIT_READ_PORT` for the `FR-ADMN-09` explorer, which has no edit or
delete affordance anywhere. `NFR-SEC-13` — *"stored where application credentials cannot alter
them"* — is a grant requirement, and every diagnostic below assumes it holds.

**Dependencies.** Downward: `common/` only. Notably **not** `tenancy/` — `audit/` is the graph's
second sink, and its writes run on the `app_append` connection rather than the tenant-scoped client.
Upward: eighteen modules hold the `* → audit/` write edge; `admin/` holds the read edge.
**Owned tables:** `audit_log` (+ its monthly partitions).
**Kill switches: none, deliberately.** An audit write that fails must fail the **request**, not be
skipped. If audit writing becomes an availability problem, the response is to **scale the
`app_append` pool** — never to bypass the interceptor.

> **Open finding `AUR-03`, carried here because it will shape the first incident of type 1.**
> `Security.md` §12.2 **AU-2** requires a separate `app_append` connection; `RiskAnalysis.md`
> **`TR-32`** requires the same transaction as the business change. Those are incompatible as
> written (`AuditStrategy.md` §4.7), and the recommended resolution is **R1** — a `SECURITY DEFINER`
> function `audit.append_entry(...)` owned by `app_append`, `EXECUTE` granted to `app_rw`,
> `search_path` pinned. Until that is recorded in `DECISION_LOG.md`, an operator diagnosing a
> missing audit row must first establish **which shape shipped**, because the failure signatures
> differ: same-transaction fails the request; separate-connection can leave a committed mutation
> with no audit row at all.
>
> **Related, unresolved: finding `AUR-05`.** Rule `SC-R02` (`Schema.md` §13.3) says an append-only
> table is its own audit record, so `ledger_entries`, `membership_events`, `payment_events` and
> `attendance` inserts produce **no** `audit_log` row — while `BusinessRules.md`'s per-rule wording
> says both are written. The gap is ≈1.2 M rows/year at Y1. Do not treat "no `audit_log` row for a
> membership transition" as an incident until this is settled; check `membership_events` instead.

## Top failure modes

| # | Signal | Likely cause | First action | Escalation |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Write failure on an audited path.** `5xx` on a mutating route with the audit span erroring; or `ALRT-17` — `increase(db_append_only_grant_violations_total[1h]) > 0` for `audit_log`, meaning an `UPDATE` or `DELETE` was **attempted** (the grant blocked it; the counter records the attempt) | For a *failure*: `app_append` pool exhaustion, a missing partition (see mode 2), or a `before`/`after` payload failing redaction. For an *attempted mutation*: code exists that believes it may rewrite history — a retention routine, a "fix the actor" script, or an ORM cascade | Do **not** look for a kill-switch; there is none, and a skipped audit row is worse than a failed request. The log line's `module` + `correlation_id` names the offending code path **exactly** — use it before anything else. If the cause is capacity, scale the `app_append` pool. If it is an attempted mutation, that code is the incident, not the alert | **S1.** Page on-call + Technical Lead. An attempted mutation additionally notifies the security owner: `AC-ADMN-02.3` states that given an audit record exists, **no interface, API or role permits modification**, and code that tried is a control failure even though the grant held |
| **2** | **Partition maintenance failure.** `ALRT-21` on `job_outcomes_total{job_name="audit.partition-maintenance", outcome="FAILED"}` twice consecutively, or the dead-man gauge `job_last_success_timestamp_seconds` exceeding a month. Louder downstream symptom: rows appearing in the `DEFAULT` partition | The job ran and errored, or — the dangerous case — **never started**, which produces no failure metric at all. `TR-41` scores this 3 × 5 = **15** precisely because it fails silently and the consequence lands weeks later at a month boundary | Check that the **next two** partitions exist. Three months of look-ahead means one failure is survivable and two are not. Then verify each new partition carries `ENABLE` + `FORCE ROW LEVEL SECURITY`, the tenant policy **and** the `G-AUDIT` grant set — partitions inherit **none** of them, and `CI-10` is the test that proves they were applied. Reading `audit_log_y2026mNN` *by name* as tenant A must return no tenant-B row | **S2** normally; **S1** if rows are already in `DEFAULT` (§5.7.3) or if a partition exists without its policy, which is then a `tenancy` failure-mode-2 incident as well |
| **3** | **Explorer query timeout at scale.** `SCR-ADM-015` requests exceeding the report budget; `ALRT-07`. At 10× the largest monthly partition holds ≈1.6 M rows and there are **84 live partitions** at full retention | An unbounded or very wide date range that prunes no partitions; a filter that misses all three partition-local indexes; or a query reaching detached cold-storage months | Confirm the query's date range prunes partitions — that is the first-order fix and usually the only one needed. Then check `EXPLAIN` uses `(entity_type, entity_id, occurred_at)`, `(actor_id, occurred_at)` or `(tenant_id, occurred_at)` rather than a sequential scan. Deep queries beyond 24 months are served by re-attaching cold partitions as foreign tables — a **documented, deliberate** step, not an ad-hoc one | S3 → ticket to Technical Lead. Widening the index set is a schema change with a real storage cost, not an incident action |

## Dashboards and queries

_To be populated by **M-013** (table, grants, writer, interceptor), **M-018** (the job scheduled on
the harness — deliberately its first consumer, so alerting is proven before anything depends on it)
and **M-117** (the explorer)._ The intended content:

- **Custody panel:** `db_append_only_grant_violations_total{table="audit_log"}` — must be a flat
  zero; audit insert rate against the `Schema.md` §13.3 baseline of ~5,000/day at Y1 (with
  `AuditStrategy.md` §11's competing derivation of ~8,063/day noted beside it, so a "spike" is
  judged against a settled number).
- **Grant assertions as live checks**, mirroring `audit-grants.int-spec.ts` (`RS-9`, `CI-09`): as
  `app_rw`, `UPDATE` and `DELETE` raise `permission denied` at the **grant** level, before any
  policy is consulted; as `app_append`, `SELECT` raises.
- **Partition catalogue query:** the list of existing partitions with their upper bounds, asserting
  the next two months exist; joined to `pg_policies` and the grant set per partition (`CI-10`).
- **`DEFAULT` partition row count** — any non-zero value is a page in its own right.
- **Job panel:** `job_duration_seconds{job_name="audit.partition-maintenance"}` against the 2 min Y1
  / 20 min 10× envelope, `job_outcomes_total`, and `job_last_success_timestamp_seconds` on the
  §7 dead-man heat strip.
- **Explorer performance:** p95 by filter shape for the `SCR-ADM-015` two primary filters, with
  partitions-pruned as a companion series.
- **Seal verification** (`audit.daily-seal`, `Security.md` §12.4): the daily chain check that makes
  tampering *evident* — layer 4, beneath grants, trigger and custody. Note `SL-6`: the seal cannot
  detect a row that was never written, which is why failure mode 1 outranks it.

## Known incidents

_None yet._
