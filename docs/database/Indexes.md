# Indexes — The Physical Index Strategy and Register

**Phase 4 · Database Design · Document 5 of 9**
**Status:** Design specification. No migration, no `schema.prisma` and no application code exists.
**Authority:** Subordinate to `PROJECT_CONSTITUTION.md` (rank 1) and `MASTER_PRD.md` (rank 2). Implements `ERD.md` (Phase 2, logical) and `Schema.md` (Phase 4, physical tables). Where this document and `Scalability.md` §5.6 differ, the difference is registered in §15.

---

## 0. Document control

| Field | Value |
| :--- | :--- |
| **Purpose** | The complete register of every index in the schema, the query each one serves, and the rules that govern creating, keeping and removing them |
| **Satisfies** | `PROJECT_CONSTITUTION.md` §15.1 (*"Indexes — every index, its name, its columns, and the query it serves"*), §15.8 rules 6, 7 and 8; `Scalability.md` §5.6.3 rule **IX1**; `Schema.md` §2.9 check **CI-07** |
| **Governs** | 79 tables, **2 of them partitioned**, `PostgreSQL 16` + `PostGIS` + `pg_trgm` + `btree_gist` + `unaccent` |
| **Sibling documents** | `Schema.md` (tables and columns), `Relationships.md` (the 162 foreign keys), `Constraints.md` (checks and exclusions), `NamingConvention.md` §8/§10/§11 (index names), `MigrationStrategy.md` (how an index reaches production) |
| **Launch market** | **India.** `INR`/paise, `Asia/Kolkata` (UTC+05:30, no DST), April–March financial year, GST as CGST+SGST components, RBI data residency. §13 collects every index consequence |
| **The one hazard that shapes everything** | ADR-0005's Prisma + RLS pooling hazard. Its index consequence is §3, and it is referenced from every group in §4 |
| **Owner** | Technical Lead |
| **Review cadence** | §11.4 — monthly unused-index sweep, quarterly full register review, and on every PR that adds a query |

### 0.1 What this document is not

It is not a tuning guide, and it is not a list of indexes that would be nice to have. Every row in §4 is an index that will exist in the first migration or in a named later one, with a named query behind it. `Scalability.md` §5.6.3 rule **IX1** is the reason: *"No index is created without a row in `/docs/database/Indexes.md` naming the query it serves… An index with no named query is removed."* This document is the register that rule points at. If a query is not in here, the index that would serve it is not in the database.

---

## 1. Reading conventions

### 1.1 The shape of a catalogue row

Every row of §4 carries ten fields. Nothing is optional; a blank is a defect.

| Field | Meaning |
| :--- | :--- |
| **Name** | The identifier, per `NamingConvention.md` §8 and §11. `idx_` b-tree, `uq_` unique, `gix_` GiST, `gin_` GIN, `brn_` BRIN, `ex_` exclusion-backing, `pk_` primary key |
| **Table** | The relation. A partitioned table's index is declared on the **parent** (`IX5`) |
| **Columns** | In index order, exactly as the name says (`NamingConvention.md` §11 rule **IX1**). `↓` marks `DESC`; `INCLUDE(...)` marks non-key covering columns |
| **Type** | `btree`, `GiST`, `GIN`, `BRIN`. **No hash index exists in this schema** — §2.6 says why |
| **U** | `✔` if unique |
| **Predicate** | The `WHERE` clause of a partial index, or `—` |
| **Query served** | The literal query shape. Not a category — a shape a reviewer can run |
| **Driver** | The `FR-`/`BR-`/`NFR-`/`SCR-`/`§C5` identifier that makes the query necessary |
| **Sel.** | Estimated rows returned by one execution at `NFR-SCAL-01` Year-1 volume |
| **Y1 size** | Estimated on-disk bytes at Year-1 volume, on the basis of §1.2 |

### 1.2 The sizing basis, stated once

Index sizes in this document are computed, not guessed, on one basis:

```text
illustrative — not committed code

entry_bytes = align8(sum(key_column_widths))   -- the index tuple's data
            + 8                                -- IndexTupleData header
            + 4                                -- ItemIdData line pointer
index_bytes = rows × entry_bytes ÷ 0.75        -- 0.75 = the steady-state leaf fill factor
                                               --        after b-tree splits and deletions

column widths: uuid 16 · timestamptz 8 · date 4 · int/enum 4 · smallint 2 · bool 1
               char(2) 3 · char(3) 4 · char(64) 68 · text ≈ length + 4 (varlena short header)
```

Two consequences worth stating before anyone compares numbers with another document:

1. **`Scalability.md` §5.6.1 used a different row basis for three indexes.** Its `memberships` figures (≈6 MB, ≈7 MB) are computed against the 100,000 *concurrent-eligible* memberships of `NFR-SCAL-01`; this document computes against the **300,000 rows created per year** that `Schema.md` §15.2 records, because an index covers every row in the table, not only the live ones. The same applies to `orders.idempotency_key` (`Scalability.md` assumed a 16-byte binary key; the `Idempotency-Key` header is a 36-character UUID string per ADR-0016) and to `payment_events.provider_event_id`. **Neither set of numbers is wrong; the basis differs and is now written down.**
2. **Sizes are Year-1 cumulative unless marked `/yr`.** A `/yr` suffix means the table grows monotonically and the figure is the annual increment — `attendance`, `audit_log`, `ledger_entries`, `notification_log`, `attribution_events`.

### 1.3 Volume anchors used throughout

From `NFR-SCAL-01` and `Schema.md` §15.2, restated so no row in §4 has to repeat them:

| Anchor | Year 1 | 10× (`NFR-SCAL-02`) |
| :--- | ---: | ---: |
| Tenants | 2,000 | 20,000 |
| Branches | 5,000 | 50,000 |
| Users | 500,000 | 5,000,000 |
| Gyms | 2,000 | 20,000 |
| Plans | ~12,000 | ~120,000 |
| Memberships created / year | 300,000 | 3,000,000 |
| Concurrent-eligible memberships | 100,000 | 1,000,000 |
| Orders / year | 450,000 | 4,500,000 |
| Payments / year | 300,000 | 3,000,000 |
| Invoices / year | 300,000 | 3,000,000 |
| Ledger entries / year | 949,000 | 9,490,000 |
| Attendance rows / year | 18,250,000 | 182,500,000 |
| Audit rows / year | 1,825,000 | 18,250,000 |
| Notification-log rows / year | 20,075,000 (held ≈5 M steady state by `SC-R03`) | 200,750,000 |
| Outbox rows / year | 22,000,000 (7-day retention → ~420,000 live) | 220,000,000 |
| Search documents | 5,000 | 50,000 |

### 1.4 On illustrative code

Every fenced SQL or Prisma block in this document is labelled **illustrative — not committed code**. `PROJECT_CONSTITUTION.md` §15.1 and `PHASES.md` put the authoritative artefact in the Prisma migration history (`A-07`), which does not exist yet. A block here is a specification of intent precise enough to be reviewed, not a file to be copied.

---

## 2. Index philosophy

### 2.1 Index for the query, not for the column

The single most common way a schema acquires a hundred useless indexes is that someone indexes a column because it "looks like it will be searched". This schema does the opposite: an index exists because a **named query** in a named screen or a named background job cannot meet a named budget without it.

The distinction is not pedantic. Consider `memberships`. A column-driven approach produces `(tenant_id)`, `(status)`, `(end_date)`, `(user_id)`, `(gym_id)` — five indexes, ~50 MB, and **not one of them serves the expiry job well**, because the job's predicate is a conjunction and PostgreSQL would either pick one and filter the rest or fall back to a bitmap `AND` that reads five index pages and then the heap anyway. A query-driven approach produces `(tenant_id, status, end_date)` — one index, 14 MB, one index scan, the `§C5` `membership.expire` job's exact predicate as an index condition. `§C2.4` already made this choice; this document's job is to make it everywhere.

> **Rule IX-R01 — every index names its query.**
> An index is registered in §4 with the literal query shape it serves and the `FR-`/`BR-`/`NFR-`/`SCR-`/`§C5` identifier behind that query, or it does not exist. This is `Scalability.md` **IX1**, `NamingConvention.md` §11 **IX2** and `PROJECT_CONSTITUTION.md` §15.1 stated as one rule with one register.

### 2.2 The write-amplification cost, quantified

Every index is a tax on every write to its table. Stating the tax in numbers is what makes "one more index won't hurt" arguable rather than assumed.

| Cost | Mechanism | Where it bites in this schema |
| :--- | :--- | :--- |
| **Insert cost** | Every `INSERT` writes one entry into **every** index on the table, plus WAL for each | `attendance` at 50,000 check-ins/day × 2 indexes = 100,000 index entries/day. A third index is +50,000/day and +18 M/year |
| **Update cost** | A non-HOT `UPDATE` writes a new entry into **every** index, not only the changed one | `Scalability.md` §5.8.3: the `attendance` check-out write at `fillfactor = 100` would produce 70,000 extra index entries/day — a **1.7× index write amplification** on the largest table |
| **HOT loss** | An `UPDATE` is HOT-eligible only if **no indexed column changed** *and* the page has room. Adding an index over a mutable column removes HOT for every update of that column | Adding an index on `attendance.checked_out_at` would destroy the HOT path that `fillfactor = 85` was chosen to preserve. It is forbidden in §12 |
| **Partial-index membership churn** | A row moving in or out of a partial index's predicate is an index write even when the heap update is otherwise HOT | `outbox`: the `PENDING → PUBLISHED` transition changes membership of `idx_outbox__pending`, so that one update is never HOT for that index. `Scalability.md` §5.8.4 records it; the index is still correct, because the alternative is a full scan every 5 seconds |
| **VACUUM cost** | Vacuum must scan every index to remove its pointers to dead tuples | The `outbox` daily partition at 60,000 rows/day with two indexes; the hourly `attendance` vacuum after `attendance.auto-checkout` |
| **Planning cost** | The planner considers every index on every table in the query | Marginal per index, real at 200+ indexes on a 20-table join — which is why §12 forbids the wide analytical join on the request path rather than indexing for it |
| **Buffer-cache displacement** | An index nobody reads still occupies `shared_buffers` when it is written | The reason `IX6`'s unused-index sweep is monthly and not annual |

> **Rule IX-R02 — the write budget is stated per table, not per index.**
> A table whose insert rate exceeds 1,000 rows/minute at Year-1 volume carries a **stated index ceiling** in §4. `attendance` is **2 secondary indexes plus the primary key and the nonce unique**; `outbox` is **2**; `notification_log` is **3**; `ledger_entries` is **4 including one partial and one BRIN**. Exceeding a ceiling is a design review with the write-amplification arithmetic attached, not a migration.

### 2.3 The small-table rule

An index on a small table is usually slower than the sequential scan it replaces, and it is always a write cost. PostgreSQL will frequently refuse to use it, and the reviewer who added it will not notice.

> **Rule IX-R03 — below 10,000 rows, index only for uniqueness, for a foreign key, or for a measured plan.**
> A sequential scan of a 2,000-row table (`tenants`, `gyms`) is one or two 8 KB pages from `shared_buffers` — tens of microseconds. Twenty-two of the 79 tables in this schema are below 10,000 rows at Year 1: all 12 platform-reference tables, `tenants`, `gyms`, `payout_accounts`, `commission_rules`, `roles`, `permissions`, `role_permissions`, `document_number_counters`, `data_subject_requests`, `kyc_checklists`. **They carry uniqueness indexes, foreign-key indexes and nothing else**, and §4 records the declined index next to each so a future reviewer sees the decision rather than the absence.

The rule has one deliberate exception class: **an index that exists to enforce a business rule is created regardless of table size**, because its purpose is correctness under concurrency, not speed. `uq_payout_accounts__one_primary` on a 4,000-row table is not a performance index; it is `A6.4` expressed as a constraint (§9).

### 2.4 The five questions before an index is created

Applied in order. The first "no" ends it.

| # | Question | If the answer is no |
| :-: | :--- | :--- |
| 1 | **Which named query does this serve, and what is its `FR-`/`BR-`/`NFR-` driver?** | There is no index. Rule **IX-R01** |
| 2 | **Is that query on a request path with a budget, or a job with a duration envelope?** | If neither, the query is ad-hoc analytics and belongs on the replica against the existing indexes, not behind a new one |
| 3 | **Does an existing index already serve it as a prefix?** | If yes, no new index. `Relationships.md` §12.3 already records five foreign keys served by an existing multi-column index; §4 records eleven more |
| 4 | **Does it lead with `tenant_id`, and if not, is it in the closed exception list of §3.3?** | It leads with `tenant_id`, or the exception is registered and justified in writing. Rule **SC-R06**, CI check **CI-08** |
| 5 | **What does it cost per write, and does the table have room in its §2.2 ceiling?** | The arithmetic goes in the PR. A table at its ceiling trades an index out, or the design changes |

### 2.5 The deletion rule, stated as strongly as the creation rule

An index that no query uses is worse than a missing index, because it costs on every write and shows up in no slow-query log. `Scalability.md` **IX6** requires monthly unused-index detection; §11.3 specifies it.

> **Rule IX-R04 — an index with zero scans over a full month of replayed production workload is removed.**
> Not "reviewed". Removed, by a forward migration, with the register row deleted in the same pull request. The two exceptions are (a) unique indexes enforcing a business rule, which are never scanned by a `SELECT` but are the entire enforcement mechanism, and (b) foreign-key support indexes, which are scanned by the referential-integrity check and not by any application query. Both are marked **`retain-unscanned`** in §4 so the sweep does not propose them every month.

### 2.6 Index types in use, and the ones deliberately absent

| Type | Count | Where | Why this type |
| :--- | :-: | :--- | :--- |
| **b-tree** | The large majority | Everything equality-, range- or sort-shaped | Supports `=`, `<`, `>`, `BETWEEN`, `IN`, `ORDER BY`, `NULL` ordering, uniqueness, `INCLUDE`, and partial predicates. Nothing else in PostgreSQL does all six |
| **GiST** | 5 | `branches.location`, `search_documents.location`, `cities.centroid`, and the two exclusion constraints (`branch_hours`, `plans`, `freezes`, `commission_rules`) | The only index that supports `ST_DWithin`, the `<->` k-NN ordering operator (§5.3) and `EXCLUDE USING gist` (`btree_gist` for the mixed equality/range form) |
| **GIN** | 5 | `search_documents.search_tsv`, `search_documents.name`/`locality` trigram, `search_documents.amenity_ids`, `coupons.applicable_plan_ids` | Inverted index over multi-valued keys: `tsvector` matching, `%`/`similarity()` trigram, array `@>` containment |
| **BRIN** | 2 | `ledger_entries.occurred_at`, `attribution_events.occurred_at` | Append-only, physically time-correlated, queried by wide time ranges under platform elevation with **no tenant predicate**. A b-tree over 949,000 rows/year costs 45 MB/year forever; the BRIN is **under 100 KB** and prunes to the right block range (§4.6) |
| **hash** | **0** | — | **Deliberately absent, and this is the reason.** A hash index cannot be unique, cannot back an exclusion constraint, cannot serve `ORDER BY` or a range, and cannot be partial-with-ordering. Every equality-only lookup in this schema either *requires* uniqueness (`idempotency_keys.key`, `orders.idempotency_key`, `payment_events.provider_event_id`, `refresh_tokens.token_hash`) or is on a 16-byte `uuid` where a b-tree is no larger. There is no candidate |
| **SP-GiST / bloom** | 0 | — | `bloom` is not an installed extension (`Schema.md` §2.1's list is closed). SP-GiST has no candidate: the spatial data is point data with a k-NN requirement, which GiST serves better |

### 2.7 What the philosophy costs in one number

Total index bytes at Year 1, from §14: **≈4.0 GB**, against ≈13 GB of steady-state heap. That is a 31% index-to-heap ratio, and 62% of it is two indexes on `attendance`. `Schema.md` §15.2 is right that *"this platform is not storage-bound"* — but it is **connection-bound and write-throughput-bound**, and indexes are a write-throughput cost. The ratio is the number to watch, and §11.5 makes it a tracked metric.

---
## 3. Tenant-scoped indexing, RLS, and the Prisma hazard

### 3.1 Why nearly every index leads with `tenant_id`

The `P-STD` policy of `Schema.md` §2.6 is:

```sql
-- illustrative — not committed code
USING      (tenant_id = current_setting('app.tenant_id')::uuid)
WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid)
```

That predicate is **not special to the planner**. It is an ordinary equality qualifier, injected into every statement against the table. `current_setting()` is `STABLE`, so the planner may fold it to a constant for the duration of the statement and **push it into an index condition** — but only if an index exists whose leading column is `tenant_id`. If no such index exists, the predicate becomes a post-fetch `Filter`, every candidate row is read from the heap, and the rows belonging to other tenants are discarded **after** the I/O has been paid for.

```text
illustrative — not committed code

-- Index leads with tenant_id: the policy is an Index Cond
Limit  (cost=0.42..38.10 rows=50)
  ->  Index Scan using idx_memberships__tenant_id_status_end_date on memberships
        Index Cond: ((tenant_id = 'a1b2…'::uuid) AND (status = 'ACTIVE') AND (end_date <= '2026-09-05'))
        Buffers: shared hit=6
                                       -- ≈50 rows touched

-- Index omits tenant_id: the policy is a Filter
Limit  (cost=0.43..9840.22 rows=50)
  ->  Index Scan using idx_memberships__status_end_date on memberships
        Index Cond: ((status = 'ACTIVE') AND (end_date <= '2026-09-05'))
        Filter: (tenant_id = 'a1b2…'::uuid)
        Rows Removed by Filter: 99950
        Buffers: shared hit=112 read=3894
                                       -- ≈100,000 rows touched: 2,000× amplification
```

At 2,000 tenants the amplification factor **is the tenant count**. `NFR-PERF-04`'s 800 ms dashboard budget does not survive it, and `NFR-PERF-01`'s 500 ms search budget would not either if search ran against tenant-owned tables — which is precisely one of the reasons the `search_documents` projection exists as a `GLOBAL` table (`Schema.md` §13.4).

> **Rule IX-R05 — restates `SC-R06` for this register.**
> **Every index on a tenant-owned table that serves a multi-row query leads with `tenant_id`.** The exceptions are closed, enumerated in §3.3, and each carries a written reason. CI check **CI-08** queries `pg_indexes` and fails the build on an unregistered exception.

### 3.2 The Prisma + RLS hazard's index consequence

ADR-0005's hazard is that `SET LOCAL app.tenant_id` and the query it protects can land on **different pooled connections**, at which point either the strict `current_setting()` raises `42704` or — with a permissive policy — another tenant's rows are returned. `Schema.md` §2.3 rules the policy strict so the failure is loud. Three consequences land specifically on indexes, and they are the reason this section sits before the catalogue rather than after it.

| # | Consequence | What it forces in §4 |
| :-: | :--- | :--- |
| **1** | **Every tenant-scoped statement executes inside an interactive transaction that holds a pooled connection for its whole duration**, not for the statement's duration (`Schema.md` §2.3.3 obligation 6). Connections are the first ceiling (`Scalability.md` §5.1) | An index that turns a 300 ms query into a 3 ms query does not save 297 ms of CPU — it saves **297 ms of a connection**, which is the scarce resource. This is why the catalogue indexes list views and job candidate scans that a single-tenant system would leave unindexed |
| **2** | **The policy predicate is present on every statement, including ones the developer wrote without a `tenantId`** — rule `BR3` forbids hand-writing `where: { tenantId }` because a hand-written predicate that disagrees with the policy is worse than none | The index must serve `tenant_id = $1 AND <the developer's predicate>`, which is a **different index** from the one that serves the developer's predicate alone. Column order in §4 is always `(tenant_id, …the developer's columns…)` |
| **3** | **A partition does not inherit its parent's policy** (`Schema.md` §2.3.3 obligation 7). A query naming `attendance_y2026m11` directly uses that partition's policies | Indexes are declared on the **parent** so they propagate (`IX5`), but the *policy* must be applied per partition by `ops.partition-maintain`. §10 states the index-parity check that proves both happened |

**The honest limit.** No index makes the hazard safe. Indexes make the *correct* path fast; the extension makes it correct; the strict policy makes a bypass loud; `IS1`–`IS8` catch the bypass in CI. An index is the fourth of those four and the only one that is purely a performance control. It is listed here because a reviewer looking at column order needs to know *why* the order is not negotiable.

### 3.3 The closed exception list — where `tenant_id` must **not** lead

`Schema.md` §2.9 closes the `SC-R06` exception list at five indexes. **This document finds that list incomplete and proposes extending it to nineteen, in four classes.** The omission is not a criticism of `Scalability.md` §5.4, which named the two classes it had analysed; it is what happens when the register is written and the platform-console queries and the member-facing cross-tenant reads are enumerated for the first time. Registered as deviation **D-I01** in §15.

#### Class A — globally unique lookup keys (4 indexes, already in the closed list)

A single-value lookup returning at most one row. A leading `tenant_id` would enlarge the index and improve nothing, and in three of the four cases the tenant is **not yet known** when the lookup runs.

| Index | Why the tenant is not available | Driver |
| :--- | :--- | :--- |
| `uq_orders__idempotency_key` | The idempotency interceptor runs **before** tenant resolution on the public checkout path | `BR-PAY-03`, ADR-0016 |
| `uq_idempotency_keys__key` | Same interceptor, same position in the pipeline | `BR-PAY-03`, ADR-0016 |
| `uq_payment_events__provider_event_id` | The webhook arrives carrying a provider event id **and nothing else**. Resolving the tenant *is* the lookup | `BR-PAY-05`, `BR-PAY-02` |
| `uq_payments__provider_provider_intent_id` | Webhook correlation, same reason | `BR-PAY-05`, `TR-04` |

#### Class B — near-unique foreign keys on a hot path (1 index, already in the closed list)

| Index | Why | Driver |
| :--- | :--- | :--- |
| `idx_attendance__membership_id_checked_in_at_desc` | A membership belongs to exactly one tenant, so the policy predicate is applied to that member's own ≤3 rows. `§C2.4` declares it without a tenant lead and is correct; adding `tenant_id` would add **293 MB/year** to the largest index in the system for zero selectivity | `BR-CHK-06`, `NFR-PERF-03`, `FR-CHK-11` |

#### Class C — platform-scope reads and cross-tenant jobs (11 indexes, **proposed addition**)

This is the class `Scalability.md` §5.4 did not enumerate. These queries run under the `P-PLATFORM` policy (`FOR SELECT TO app_platform_ro USING (true)`) or under a background job that must drain or sweep across every tenant. **There is no tenant to lead with.** An index leading with `tenant_id` is not merely wasteful here — it is **unusable**, because the query supplies no value for the leading column and a b-tree cannot skip-scan it.

| Index | Query | Runs as | Driver |
| :--- | :--- | :--- | :--- |
| `idx_outbox__available_at_id__pending` | `SELECT … WHERE status='PENDING' AND available_at<=now() ORDER BY available_at, id FOR UPDATE SKIP LOCKED LIMIT 200` | The relay, every **5 seconds, forever** — see the finding below | ADR-0017, `TR-08` |
| `idx_orders__expires_at__unpaid` | `§C5` `order.expire`, every 5 min, all tenants | Platform job | `§C5`, `FR-CART-09` |
| `idx_payments__created_at__indeterminate` | `§C5` `payment.reconcile`, every 15 min, all tenants | Platform job | `§C5`, `BR-PAY-06` |
| `idx_applications__status_submitted_at` | The verification queue and its SLA-age metric | `SCR-ADM-002`, `app_platform_ro` | `FR-ADMN-11`, `FR-ONB-09` |
| `idx_kyc_documents__status_created_at` | Documents awaiting review across all applications | `SCR-ADM-003` | `FR-ONB-06` |
| `idx_gym_media__moderation_status_created_at` | The media moderation queue | `SCR-ADM-012` | `FR-ADMN-12` |
| `idx_reviews__status_created_at__moderation` | The review moderation queue | `SCR-ADM-012` | `FR-REV-07`, `FR-ADMN-12` |
| `idx_review_reports__status_created_at` | The reported-review queue | `SCR-ADM-012` | `FR-REV-10` |
| `idx_disputes__status_evidence_due_at` | Disputes ordered by evidence deadline across all tenants | `SCR-ADM-009` | `BR-REF-08`, `FR-RFND-09` |
| `idx_notification_log__category_sent_at` | `SC-R03` category-scoped retention sweep, all tenants | `data.retention-sweep` | `NFR-PRV-04` |
| `idx_idempotency_keys__expires_at` | The 24-hour sweep, all tenants | Platform job | `§C1.5`, ADR-0016 |

> **Finding IX-F01 — the outbox relay's cross-tenant drain has no role that can execute it.** `Schema.md` §13.1 classes `outbox` as **RLS · P-STD**, which means the only policies on the table are `rls_outbox__tenant_isolation` (`FOR ALL TO app_rw`, requiring `app.tenant_id`) and `rls_outbox__platform_read` (`FOR SELECT TO app_platform_ro`). The relay must `SELECT … FOR UPDATE SKIP LOCKED` **and then `UPDATE`** rows belonging to every tenant, every five seconds. `app_rw` cannot: it would need 2,000 tenant contexts per cycle. `app_platform_ro` cannot: it holds no `UPDATE` grant. **The most frequent query in the system currently has no executor.**
>
> **Proposed resolution**, raised here because it is the index that exposes it and it must be settled before Sprint 3: a fifth database role `app_relay` with `SELECT, UPDATE (status, published_at, attempts, last_error, available_at)` on `outbox` only, and a third policy `rls_outbox__relay_drain FOR ALL TO app_relay USING (true) WITH CHECK (true)`. The role holds **no grant on any other table**, which keeps `PE1`'s property that authority is visible in `pg_policies` rather than in a role attribute, and keeps `RS3`'s property that no role holds `BYPASSRLS`. The index `idx_outbox__available_at_id__pending` is then correct exactly as `Scalability.md` §5.6.2 specifies it. Registered as open item **OI-I1** and referred to `Security.md` §4.5 and `Schema.md` §13.1.
>
> **The same mechanism, with a different role, is needed by `data.retention-sweep`**, which `SD5`/`Schema.md` §13.5 run as `app_migrator` — and `FORCE ROW LEVEL SECURITY` means the owner is policed too. A cross-tenant sweep as `app_migrator` returns zero rows under a strict policy. This is the second half of **OI-I1**.

#### Class D — user-scoped, cross-tenant member-facing reads (3 indexes, **proposed addition**)

`Schema.md` §1.3 names the trap: *"user-owned, cross-tenant data — a user's profile, favourites across gyms, orders at several tenants — is scoped by `user_id`, not by `tenant_id`. Classing `users` as RLS would make `/me/memberships` return an empty list to a member who holds memberships at three gyms, and the bug would look like data loss."* The trap is avoided for `users`, `favourites` and `saved_searches` by classing them `IDENTITY`. **It is not avoided for `memberships`, `orders` and `reviews`, which are `RLS` and must be, because they are also the tenant's own data.**

A member holding memberships at three gyms is three tenants. `SCR-WEB-008` (Account Home), `SCR-WEB-011` (Orders & Invoices) and `SCR-WEB-013` all read across them in one request. Under `P-STD` alone that request has no correct tenant context to set.

> **Finding IX-F02 — `§C2.4`'s two `user_id`-leading indexes are evidence of a policy that has not been written down.** `§C2.4` declares `memberships (user_id, status)` for *"account views"* and does so **without a leading `tenant_id`**. That index is only usable if a policy exists that admits rows by `user_id` rather than by `tenant_id`. `Schema.md` §2.6's four policy classes contain no such class.
>
> **Proposed resolution:** a fifth policy class **`P-SUBJECT`**, applied as a *third* policy to exactly three tables — `memberships`, `orders`, `reviews` — `FOR SELECT TO app_rw USING (user_id = current_setting('app.user_id')::uuid)`. `app.user_id` is set by the same ADR-0005 extension that sets `app.tenant_id`, on the same interactive transaction, from the same `AsyncLocalStorage` principal. PostgreSQL `OR`s multiple permissive policies, so a tenant-context request is unaffected and a member-context request sees exactly its own rows across every tenant. The alternative — one interactive transaction per tenant the member touches — costs up to four pooled connections for one page load and is rejected on `Scalability.md` §5.1 grounds. Registered as open item **OI-I2**; it must be settled before Sprint 6, when `SCR-WEB-008` is built.

| Index | Query | Screen | Driver |
| :--- | :--- | :--- | :--- |
| `idx_memberships__user_id_status` | `WHERE user_id = $me AND status IN ('ACTIVE','FROZEN')` — the member's memberships across every gym | `SCR-WEB-008`, `SCR-WEB-009` | `§C2.4`, `FR-USER-02`, `FR-MEMB-01` |
| `idx_orders__user_id_created_at_desc` | `WHERE user_id = $me ORDER BY created_at DESC LIMIT 20` — the member's order and invoice history across every gym | `SCR-WEB-011` | `FR-CART-10`, `FR-INV-05` |
| `idx_reviews__user_id_created_at_desc` | `WHERE user_id = $me ORDER BY created_at DESC` — the member's own reviews, including `HELD` ones only they can see | `SCR-WEB-013` | `FR-REV-04` |

`idx_attendance__membership_id_checked_in_at_desc` also serves a Class-D read (`SCR-WEB-010`, visit history) but is already registered under Class B and is not double-counted.

### 3.4 The one index where `tenant_id` is deliberately inverted

`Relationships.md` §12.4 already rules it and this register carries it unchanged:

| Index | Must not be | Why |
| :--- | :--- | :--- |
| `idx_orders__coupon_id` | `idx_orders__tenant_id_coupon_id` | A `PLATFORM`-scope coupon's redemptions span tenants. The only query that reads `orders.coupon_id` across tenants is the platform coupon-performance report — *"how many orders used `LAUNCH20`?"* — which runs under `runElevated()` with no tenant predicate. A `tenant_id`-leading index would be unusable for the only cross-tenant reader, and the tenant-scoped reader (`SCR-DASH-016`) already has `idx_coupon_redemptions__tenant_id_coupon_id` |

### 3.5 What the index-leading rule does **not** mean

Three misreadings are common enough to name.

| Misreading | Correction |
| :--- | :--- |
| *"Add `tenant_id` to every index, including single-row lookups by primary key"* | The primary key is `(id)` and is unique platform-wide. A `findUnique` by id returns one row and the policy filters it — cost: one heap fetch. Prefixing the PK with `tenant_id` would break every foreign key that references it |
| *"Add `tenant_id` to the unique constraints too, always"* | Yes for business keys (`uq_memberships__tenant_id_membership_code`), because a global unique on an RLS table **leaks another tenant's row through the constraint-violation error message**. No for the four Class-A keys, and no for `uq_tenants__country_registration_number` (`country_code` is not tenant data and the error surfaces to a *reviewer*, not to a tenant) or `uq_kyc_documents__storage_key` (an opaque internal object key no tenant supplies or observes) |
| *"A composite FK `(tenant_id, parent_id)` needs a separate index on `parent_id`"* | No. `Relationships.md` §12.2: the composite index `(tenant_id, parent_id)` serves the policy, the join and the referential-integrity check in one structure. A second index on `parent_id` alone is registered in §12 as an anti-pattern |

---
## 4. The index catalogue

### 4.0 How to read this section, and what is not repeated in it

Three facts are true of every table and are stated once here rather than 79 times.

| Fact | Statement |
| :--- | :--- |
| **Primary keys** | Every table has `pk_<table>` on `(id uuid)`, which PostgreSQL implements as a unique b-tree. **Two exceptions**, both partitioned: `pk_attendance` on `(checked_in_at, id)` and `pk_audit_log` on `(occurred_at, id)`, because the partition key must appear in every unique constraint (§10.2). The 79 primary-key indexes total **≈1.35 GB at Year 1**, of which `attendance` is 0.53 GB and `notification_log` is 0.19 GB. They are not itemised below |
| **Foreign-key coverage** | `PROJECT_CONSTITUTION.md` §15.8 rule 6 requires every foreign key to be indexed. **This register reads "indexed" as covered by an index whose leading columns are the foreign key's columns, in the foreign key's column order** — dedicated or as a prefix of a wider index. `Relationships.md` §12.3 already applies that reading to five foreign keys; this register applies it to **41** of the 162. Coverage is stated in the *Query served* column as `FK support`. Three foreign keys are covered by **neither**, and each is declined in writing (§4.11) |
| **Soft delete** | Where a table carries `deleted_at`, a unique index that must coexist with soft deletion is partial on `WHERE deleted_at IS NULL` (`SD7`). This is written out in the *Predicate* column rather than assumed |

**Marks used in the tables.** `✔` unique · `†` in the `SC-R06` exception list of §3.3 · `‡` `retain-unscanned` (never appears in `pg_stat_user_indexes.idx_scan`, and is not a removal candidate under **IX-R04**) · `¶` created by a later, named migration rather than the first one.

---

### 4.1 Group 4 — Tenancy & Identity (18 tables, 45 secondary indexes)

**Write profile.** Low, except `refresh_tokens` (25 M inserts/year) and `auth_sessions`. No table here is on the check-in or checkout hot path.

| Name | Table | Columns | Type | U | Predicate | Query served | Driver | Sel. | Y1 size |
| :--- | :--- | :--- | :--- | :-: | :--- | :--- | :--- | ---: | ---: |
| `uq_tenants__country_code_registration_number` | `tenants` | `country_code, registration_number` | btree | ✔ | `deleted_at IS NULL AND registration_number IS NOT NULL` | `WHERE country_code=$1 AND registration_number=$2` — duplicate-entity detection when an application is submitted | `§C2.2`, `FR-ONB-04` | 0–1 | 96 KB |
| `uq_tenants__gstin` | `tenants` | `gstin` | btree | ✔ | `gstin IS NOT NULL AND deleted_at IS NULL` | `WHERE gstin=$1` — two tenants cannot register the same GSTIN. **India** | `LAUNCH_MARKET_INDIA.md` §6, `FR-ONB-04` | 0–1 | 96 KB |
| `idx_tenants__pan` | `tenants` | `pan` | btree | | `pan IS NOT NULL` | `WHERE pan=$1` — **not unique**: one PAN legitimately backs several GSTINs across Indian states, so a match is a **reviewer flag**, not a rejection | `LAUNCH_MARKET_INDIA.md` §6, `FR-ONB-08` | 0–4 | 72 KB |
| `idx_tenants__subscription_tier_id` ‡ | `tenants` | `subscription_tier_id` | btree | | — | FK support · `fk_tenants__subscription_tiers` | `§15.8` r6 | — | 72 KB |
| `idx_tenants__tax_profile_id` ‡ | `tenants` | `tax_profile_id` | btree | | — | FK support · `fk_tenants__tax_profiles` | `§15.8` r6 | — | 72 KB |
| `uq_applications__tenant_id_version` | `applications` | `tenant_id, version` | btree | ✔ | — | `WHERE tenant_id=$1 ORDER BY version DESC LIMIT 1` — the current dossier; also makes the version sequence unforgeable. Covers `fk_applications__tenants` | `BR-GYM-05`, `FR-ONB-08` | 1 | 144 KB |
| `idx_applications__status_submitted_at` † | `applications` | `status, submitted_at` | btree | | — | `WHERE status='SUBMITTED' ORDER BY submitted_at LIMIT 50` — the verification queue, **all tenants**, plus its SLA-age metric | `FR-ADMN-11`, `SCR-ADM-002` | ≤50 | 110 KB |
| `idx_applications__assigned_to_status` † | `applications` | `assigned_to, status` | btree | | — | `WHERE assigned_to=$officer AND status='UNDER_REVIEW'` — a verification officer's own queue. Covers `fk_applications__users__assigned_to` | `SCR-ADM-002`, `FR-ONB-09` | ≤20 | 144 KB |
| `uq_kyc_documents__storage_key` | `kyc_documents` | `storage_key` | btree | ✔ | — | `WHERE storage_key=$1` — resolving a signed-URL callback to its row. Global, and safe: the key is opaque and no tenant supplies it | `BR-DAT-07`, `NFR-SEC-02` | 1 | 2.0 MB |
| `idx_kyc_documents__tenant_id_document_type` | `kyc_documents` | `tenant_id, document_type` | btree | | — | `WHERE tenant_id=$1` — the **10-item India checklist** rendered with each slot's current document. Covers `fk_kyc_documents__tenants` | `FR-ONB-03`, `LAUNCH_MARKET_INDIA.md` §6 | ≤14 | 0.94 MB |
| `idx_kyc_documents__status_created_at` † | `kyc_documents` | `status, created_at` | btree | | — | `WHERE status='PENDING_REVIEW' ORDER BY created_at` — documents awaiting review, **all tenants** | `FR-ONB-06`, `SCR-ADM-003` | ≤100 | 740 KB |
| `uq_payout_accounts__tenant_id__primary` | `payout_accounts` | `tenant_id` | btree | ✔ | `is_primary AND deleted_at IS NULL` | Enforcement, not lookup: **exactly one primary payout account per tenant**. A counting trigger races with a promote/demote pair in one transaction | `A6.4` | 1 | 72 KB |
| `idx_payout_accounts__tenant_id` ‡ | `payout_accounts` | `tenant_id` | btree | | — | `WHERE tenant_id=$1` — the settlements settings screen; FK support | `SCR-DASH-022`, `§15.8` r6 | ≤3 | 148 KB |
| `uq_subscription_invoices__tenant_id_financial_year_invoice_number` | `subscription_invoices` | `tenant_id, financial_year, invoice_number` | btree | ✔ | — | Enforcement: the **gapless per-tenant-per-FY sequence** for `document_kind='SUBSCRIPTION_INVOICE'`. The allocator is the mechanism; this is the proof | `FR-INV-02`, `ERD.md` §12.6 | 1 | 1.9 MB |
| `idx_subscription_invoices__tenant_id_issued_at_desc` | `subscription_invoices` | `tenant_id, issued_at ↓` | btree | | — | `WHERE tenant_id=$1 ORDER BY issued_at DESC LIMIT 24` — the tenant's own billing history | `SCR-DASH-022`, `A6.2` | ≤24 | 1.15 MB |
| `uq_users__email` | `users` | `email` | btree | ✔ | `deleted_at IS NULL` | `WHERE email=$1` — login, and the `FR-AUTH-01` duplicate check. Lowercased before write | `FR-AUTH-01` | 0–1 | 28 MB |
| `uq_users__phone` | `users` | `phone` | btree | ✔ | `deleted_at IS NULL` | `WHERE phone=$1` — **the primary identifier in India**: OTP login and the receptionist's walk-in lookup | `FR-AUTH-02`, `FR-CRM-04` | 0–1 | 23 MB |
| `uq_users__pseudonym_token` | `users` | `pseudonym_token` | btree | ✔ | `pseudonym_token IS NOT NULL` | `WHERE pseudonym_token=$1` — resolving a retained financial record back to its erased subject during a `CON-04` audit | `BR-DAT-04`, `AC-USER-02.3` | 1 | 0.3 MB |
| `idx_users__created_at` ¶ | `users` | `created_at` | btree | | — | `WHERE created_at >= $1 AND created_at < $2` — the signup-cohort series. **Deferred**: created only when `SCR-ADM-014` runs against real volumes; until then the report reads the replica with a sequential scan and no latency budget | `SCR-ADM-014` | ~1,400/day | 13 MB |
| `uq_user_roles__user_id_role_id_tenant_id` | `user_roles` | `user_id, role_id, tenant_id` | btree | ✔ | `tenant_id IS NOT NULL` | Enforcement: one grant of one tenant role to one user per tenant | `FR-RBAC-01`, `Relationships.md` §9.2 | 1 | 2.4 MB |
| `uq_user_roles__user_id_role_id__platform_scoped` | `user_roles` | `user_id, role_id` | btree | ✔ | `tenant_id IS NULL` | Enforcement: the same, for platform-scope roles, where `tenant_id IS NULL` makes the three-column unique index accept duplicates. **Two indexes, not `NULLS NOT DISTINCT`** — `NamingConvention.md` §8 | `FR-RBAC-01` | 1 | 29.5 MB |
| `idx_user_roles__tenant_id_role_id` | `user_roles` | `tenant_id, role_id` | btree | | `tenant_id IS NOT NULL` | `WHERE tenant_id=$1 AND role_id=$owner` — *"who are this tenant's owners?"*, and the `FR-STAF-05` last-owner guard | `FR-STAF-05`, `SCR-DASH-018` | ≤30 | 1.8 MB |
| `uq_roles__key` | `roles` | `key` | btree | ✔ | — | `WHERE key=$1` — resolving the twelve `§B3.1` roles at authorisation time | `§B3.1` | 1 | 2 KB |
| `uq_permissions__key` | `permissions` | `key` | btree | ✔ | — | `WHERE key=$1` — and the `FR-RBAC-01` CI check that fails the build on an undeclared permission | `FR-RBAC-01` | 1 | 12 KB |
| `uq_role_permissions__role_id_permission_id` | `role_permissions` | `role_id, permission_id` | btree | ✔ | — | `WHERE role_id = ANY($1)` — assembling a principal's permission set. Covers `fk_role_permissions__roles` | `§B3.2` | ≤60 | 40 KB |
| `idx_role_permissions__permission_id` ‡ | `role_permissions` | `permission_id` | btree | | — | FK support · `fk_role_permissions__permissions`; also *"which roles grant this permission?"* on `SCR-ADM-011` | `§15.8` r6 | ≤6 | 24 KB |
| `uq_auth_sessions__family_id` | `auth_sessions` | `family_id` | btree | ✔ | — | `WHERE family_id=$1` — the token-family root that `FR-AUTH-06` reuse detection keys on | ADR-0011, `FR-AUTH-06` | 1 | 18.5 MB |
| `idx_auth_sessions__user_id_status` | `auth_sessions` | `user_id, status` | btree | | — | `WHERE user_id=$1 AND status='ACTIVE'` — the *"my devices"* list, and `FR-AUTH-09` bulk revocation on password change | `FR-AUTH-09`, `FR-USER-05` | ≤8 | 24 MB |
| `idx_auth_sessions__expires_at` | `auth_sessions` | `expires_at` | btree | | — | `WHERE expires_at < now() LIMIT 10000` — the session sweep. `auth_sessions` is `IDENTITY`, so no `SC-R06` exception is needed | `NFR-PRV-04` | ≤10,000 | 13.5 MB |
| `uq_refresh_tokens__token_hash` | `refresh_tokens` | `token_hash` | btree | ✔ | — | `WHERE token_hash=$1` — every token refresh. **The token itself is never stored** | `NFR-SEC-07`, ADR-0011 | 0–1 | 225 MB |
| `uq_refresh_tokens__auth_session_id_generation` | `refresh_tokens` | `auth_session_id, generation` | btree | ✔ | — | `WHERE auth_session_id=$1 ORDER BY generation DESC LIMIT 1` — the current generation, and the monotonicity `FR-AUTH-06` depends on. Covers `fk_refresh_tokens__auth_sessions` | ADR-0011 | 1 | 96 MB |
| `idx_refresh_tokens__expires_at` | `refresh_tokens` | `expires_at` | btree | | — | The sweep that holds this table at ≈2 M rows instead of 25 M | `NFR-PRV-04`, `Schema.md` §15.2 | ≤50,000 | 54 MB |
| `idx_refresh_tokens__preceded_by_token_id` ‡ | `refresh_tokens` | `preceded_by_token_id` | btree | | — | **FK support, and it is load-bearing**: the sweep deletes ~25 M rows/year, and an unindexed self-referencing FK makes every one of those deletes a sequential scan of a 2 M-row table | `§15.8` r6, `Relationships.md` §10.2 | — | 74 MB |
| `uq_notification_preferences__user_id_channel_category` | `notification_preferences` | `user_id, channel, category` | btree | ✔ | — | `WHERE user_id=$1` — the whole preference matrix in one index scan; and the per-send `FR-NOTF-05` opt-out check. Covers `fk_notification_preferences__users` | `FR-NOTF-05`, `NFR-PRV-02` | ≤24 | 96 MB |
| `uq_staff__tenant_id_user_id` | `staff` | `tenant_id, user_id` | btree | ✔ | `removed_at IS NULL` | Enforcement: one live staff record per person per tenant. Covers `fk_staff__tenants` | `FR-STAF-01` | 1 | 0.6 MB |
| `idx_staff__tenant_id_status` | `staff` | `tenant_id, status` | btree | | — | `WHERE tenant_id=$1 AND status='ACTIVE' ORDER BY …` — the staff list | `SCR-DASH-018`, `FR-STAF-01` | ≤30 | 0.5 MB |
| `idx_staff__user_id` | `staff` | `user_id` | btree | | — | `WHERE user_id=$1` — at login, *"which tenants does this person work for?"*, which is how the tenant context is resolved before any RLS-scoped query runs. Covers `fk_staff__users` | `§C3.1`, `FR-AUTH-08` | ≤3 | 0.4 MB |
| `uq_staff_branches__staff_id_branch_id` | `staff_branches` | `staff_id, branch_id` | btree | ✔ | — | `WHERE staff_id=$1` — the branch-scoping set evaluated on every `▪`-qualified permission | `FR-STAF-02`, `§B3.2` | ≤6 | 1.2 MB |
| `idx_staff_branches__branch_id` | `staff_branches` | `branch_id` | btree | | — | `WHERE branch_id=$1` — *"who works at this branch?"* on the check-in desk's staff picker; FK support | `SCR-DASH-009`, `§15.8` r6 | ≤12 | 0.74 MB |
| `uq_staff_invitations__token_hash` | `staff_invitations` | `token_hash` | btree | ✔ | — | `WHERE token_hash=$1` — accepting an invitation from an emailed link | `FR-STAF-03`, `NFR-SEC-07` | 0–1 | 1.7 MB |
| `uq_staff_invitations__tenant_id_email` | `staff_invitations` | `tenant_id, email` | btree | ✔ | `consumed_at IS NULL` | Enforcement: one live invitation per address per tenant, so a re-invite replaces rather than duplicates | `FR-STAF-03` | 1 | 0.24 MB |
| `idx_attribution_events__tenant_id_user_id_gym_id_occurred_at_desc` | `attribution_events` | `tenant_id, user_id, gym_id, occurred_at ↓` | btree | | — | `WHERE tenant_id=$1 AND user_id=$2 AND gym_id=$3 AND occurred_at > now() - interval '30 days' LIMIT 1` — **the `A6.3` marketplace-attribution decision**, which selects the 10% commission rate rather than the 5% one. This is a money query | `A6.3`, `BR-FIN-04` | 0–1 | 218 MB/yr |
| `brn_attribution_events__occurred_at` | `attribution_events` | `occurred_at` | **BRIN** | | — | `WHERE occurred_at >= $1 AND occurred_at < $2` with **no tenant predicate** — the platform marketplace-funnel series. Append-only and physically time-correlated, so 1,690 block ranges answer what a 115 MB/yr b-tree would | `SCR-ADM-014`, `§C6` | wide | **64 KB** |
| `uq_favourites__user_id_gym_id` | `favourites` | `user_id, gym_id` | btree | ✔ | — | `WHERE user_id=$1 ORDER BY …` — the favourites list, and the *"is this gym saved?"* heart state on every result card | `FR-FAV-01`, `SCR-WEB-012` | ≤50 | 23.6 MB |
| `idx_favourites__gym_id` | `favourites` | `gym_id` | btree | | — | `SELECT count(*) WHERE gym_id=$1` — the save count that feeds `gym.freshness-score`; FK support | `FR-SRCH-10`, `§C5` | ≤500 | 14.8 MB |

**Declined in this group, with the reason** — recorded so the absence is a decision:

| Declined | Why |
| :--- | :--- |
| `idx_tenants__status_created_at` for `SCR-ADM-004` | **IX-R03.** 2,000 rows is two heap pages. The sort is on 2,000 rows in `work_mem` |
| `idx_tenants__timezone__approved` for the per-timezone `§C5` job bucketing | Same. The hourly job reads all 2,000 tenants once and buckets them in the worker |
| `gin_users__full_name_trgm` for `SCR-ADM-005` fuzzy name search | ≈90 MB of trigram index over 500,000 users, plus its `IX4` maintenance cost, for an administrative screen with **no latency budget** whose users already know an email or a phone number — both uniquely indexed. If a name search is genuinely required, it goes through the search projection, not through `users` |
| `idx_user_roles__role_id` for `fk_user_roles__roles` | 19.6 MB and 530,000 index writes to support a referential-integrity check that **can never fire**: `roles` is a 12-row `R-REF` table on which no application role holds `DELETE`. No query navigates role → users. **Registered as deviation D-I02** |
| `idx_staff_invitations__expires_at` for the invitation sweep | **IX-R03.** 15,000 rows |
| `idx_kyc_documents__reviewed_by` | The reviewer-throughput figure is a monthly aggregate over 20,000 rows on the replica |

> **Finding IX-F03 — `refresh_tokens` carries ≈450 MB of index against a 250 MB heap, the worst ratio in the schema.** Three of its four indexes are unavoidable; two design changes would remove most of the cost and both belong to sibling documents, so they are recorded rather than taken here.
> 1. **`token_hash char(64)` should be `bytea` (32 bytes).** It stores a SHA-256, which is 32 binary bytes rendered as 64 hex characters purely for readability nobody needs — the value is never displayed. The change saves **≈70 MB** on `uq_refresh_tokens__token_hash` and another ≈14 MB on `uq_staff_invitations__token_hash`. Referred to `Schema.md` §4.8.
> 2. **`refresh_tokens.preceded_by_token_id` should keep its column and lose its foreign key.** The FK's only reader is the RI check on the sweep's `DELETE`, and the check exists to protect a chain that `family_id` + `generation` already reconstruct. Dropping the constraint removes a **74 MB** index and 25 M index writes a year. Referred to `Relationships.md` §10.2.

---

### 4.2 Group 5 — Catalogue (9 tables, 28 secondary indexes)

**Write profile.** Very low. `gyms` and `branches` change a few times per tenant per year; every change fans out to `search_documents` through the outbox, and it is the projection — not these tables — that absorbs the read load of `FR-SRCH-01`…`FR-SRCH-15`.

| Name | Table | Columns | Type | U | Predicate | Query served | Driver | Sel. | Y1 size |
| :--- | :--- | :--- | :--- | :-: | :--- | :--- | :--- | ---: | ---: |
| `uq_gyms__city_id_slug` | `gyms` | `city_id, slug` | btree | ✔ | `deleted_at IS NULL` | `WHERE city_id=$1 AND slug=$2` — the canonical URL `/gyms/:citySlug/:gymSlug` resolved on every SSR detail page. **Unique per city, not globally**: two "Iron Temple" gyms in different cities are both legitimate | `FR-NAV-05`, `NX8`, `§C2.2` | 1 | 138 KB |
| `uq_gyms__tenant_id_id` ‡ | `gyms` | `tenant_id, id` | btree | ✔ | — | The **referent of every composite tenant-carrying foreign key** that points at `gyms` (`Relationships.md` §3.2). Not a query index; without it the composite FK cannot be declared | `BR-TEN-01`, `Relationships.md` §3.2 | 1 | 118 KB |
| `idx_gyms__tenant_id_status` | `gyms` | `tenant_id, status` | btree | | — | `WHERE tenant_id=$1 AND status <> 'CLOSED'` — the owner's gym switcher and `SCR-DASH-003`. Covers `fk_gyms__tenants` | `SCR-DASH-003` | ≤5 | 96 KB |
| `idx_gyms__status_rating_avg_desc_freshness_score_desc` † | `gyms` | `status, rating_avg ↓, freshness_score ↓` | btree | | — | `WHERE status='APPROVED' ORDER BY rating_avg DESC, freshness_score DESC` — the ranking pre-sort for the **nightly `search.reindex` rebuild** and the admin directory. `§C2.4` declares it; it survives `IX-R03` only because it is 74 KB and the PRD names it. **The live marketplace ranking does not read this table** (ADR-0007) | `§C2.4`, `FR-SRCH-10`, `§C5` | 2,000 | 74 KB |
| `idx_gyms__category_id` ‡ | `gyms` | `category_id` | btree | | — | FK support · `fk_gyms__gym_categories`; and the category-directory rebuild | `§15.8` r6, `FR-SRCH-13` | ≤400 | 74 KB |
| `idx_gyms__primary_city_id` ‡ | `gyms` | `primary_city_id` | btree | | — | FK support · `fk_gyms__cities` (`Relationships.md` §14.3) | `§15.8` r6 | ≤200 | 74 KB |
| **`gix_branches__location`** | `branches` | `location geography(Point,4326)` | **GiST** | | — | `ST_DWithin(location, $centre, $radius_m)` and `ORDER BY location <-> $centre` — **one index, four features**: the `FR-SRCH-01` radius filter's source of truth, `FR-DETL-01`'s *similar nearby*, `FR-DETL-08`'s comparison resolver, and `BR-GYM-08`'s address-to-geocode tolerance check at onboarding. §5 is the whole story | ADR-0007, `§15.8` r7 | ≈40 in 3 km | 0.4 MB |
| `uq_branches__gym_id__primary` | `branches` | `gym_id` | btree | ✔ | `is_primary AND deleted_at IS NULL` | Enforcement: exactly one primary branch per gym, which carries the canonical address. A counting trigger races with a promote/demote pair | `ERD.md` §7.5 | 1 | 74 KB |
| `uq_branches__tenant_id_id` ‡ | `branches` | `tenant_id, id` | btree | ✔ | — | Composite-FK referent for `plan_branches`, `attendance`, `staff_branches`, `leads` | `Relationships.md` §3.2 | 1 | 295 KB |
| `idx_branches__city_id_status` | `branches` | `city_id, status` | btree | | — | `WHERE city_id=$1 AND status='ACTIVE'` — city landing pages, and the `search.reindex` per-city rebuild | `§C2.4`, `FR-SRCH-13` | ≈250 | 240 KB |
| `idx_branches__tenant_id_gym_id` | `branches` | `tenant_id, gym_id` | btree | | — | `WHERE tenant_id=$1 AND gym_id=$2` — `SCR-DASH-004`; covers the composite `fk_branches__gyms` | `SCR-DASH-004`, `Relationships.md` §12.2 | ≤10 | 295 KB |
| `idx_branches__locality_id` ‡ | `branches` | `locality_id` | btree | | — | FK support · `fk_branches__localities`; and the locality landing page | `§15.8` r6, `FR-SRCH-13` | ≤40 | 185 KB |
| `uq_branch_hours__branch_id_weekday_opens_at` | `branch_hours` | `branch_id, weekday, opens_at` | btree | ✔ | — | `WHERE branch_id=$1 ORDER BY weekday, opens_at` — the opening-hours block on `SCR-WEB-003`, and the source for the `hours_bitmap` projection. **Split hours are legal**, so the key includes `opens_at` | `§C2.2`, `FR-GYM-04` | ≤14 | 2.1 MB |
| `ex_branch_hours__no_overlap_per_weekday` | `branch_hours` | `branch_id =, weekday =, timerange(opens_at, closes_at) &&` | **GiST** (`btree_gist`) | | — | Enforcement, not lookup: split hours are legal, **overlapping hours are not**. A read-then-write check races between two editors | `ERD.md` §7.4 | — | 3.5 MB |
| `uq_branch_hour_exceptions__branch_id_exception_date` | `branch_hour_exceptions` | `branch_id, exception_date` | btree | ✔ | — | `WHERE branch_id=$1 AND exception_date BETWEEN $2 AND $3` — the *open now* computation and the 30-day hours preview. Dates are interpreted in the **tenant's** timezone (`TM2`) | `FR-GYM-05`, `AC-SRCH-01.1` | ≤30 | 480 KB |
| `uq_gym_amenities__gym_id_amenity_id` | `gym_amenities` | `gym_id, amenity_id` | btree | ✔ | — | `WHERE gym_id=$1` — the amenity chips on `SCR-WEB-003`, and the projection rebuild. Amenities are **platform reference data**; free text is not offered because filtering depends on the value | `NFR-DQ-06`, `FR-SRCH-03` | ≤25 | 2.4 MB |
| `idx_gym_amenities__amenity_id` | `gym_amenities` | `amenity_id` | btree | | — | `WHERE amenity_id=$1` — *"which gyms have a sauna?"* for the amenity landing page and the reindex; FK support | `FR-SRCH-13`, `§15.8` r6 | ≤600 | 1.5 MB |
| `uq_gym_media__storage_key` | `gym_media` | `storage_key` | btree | ✔ | — | `WHERE storage_key=$1` — the upload-completion callback, and the rendition-generation callback | `NFR-SEC-10` | 1 | 3.0 MB |
| `uq_gym_media__gym_id__cover` | `gym_media` | `gym_id` | btree | ✔ | `is_cover AND deleted_at IS NULL` | Enforcement: one cover image per gym, which is the one image `FR-SRCH-06` puts on every result card | `FR-GYM-02` | 1 | 74 KB |
| `idx_gym_media__gym_id_sort_order` | `gym_media` | `gym_id, sort_order` | btree | | `deleted_at IS NULL` | `WHERE gym_id=$1 ORDER BY sort_order` — the gallery, in the order the owner arranged it. Covers `fk_gym_media__gyms` | `FR-GYM-02`, `SCR-WEB-003` | ≤20 | 1.4 MB |
| `idx_gym_media__moderation_status_created_at` † | `gym_media` | `moderation_status, created_at` | btree | | — | `WHERE moderation_status='PENDING' ORDER BY created_at` — the media moderation queue, **all tenants** | `FR-ADMN-12`, `SCR-ADM-012` | ≤200 | 1.1 MB |
| `idx_gym_media__branch_id` ‡ | `gym_media` | `branch_id` | btree | | `branch_id IS NOT NULL` | FK support · `fk_gym_media__branches`; and the branch-specific gallery | `§15.8` r6 | ≤10 | 0.44 MB |
| `idx_saved_searches__user_id_created_at_desc` | `saved_searches` | `user_id, created_at ↓` | btree | | — | `WHERE user_id=$1 ORDER BY created_at DESC` — the saved-search list. `saved_searches` is `IDENTITY`, so no exception applies | `FR-FAV-03`, `SCR-WEB-012` | ≤20 | 2.4 MB |
| `uq_crm_members__tenant_id_member_code` | `crm_members` | `tenant_id, member_code` | btree | ✔ | `deleted_at IS NULL` | `WHERE tenant_id=$1 AND member_code=$2` — the receptionist typing a printed member number. **Unique per tenant**, not globally: a global unique would leak another tenant's row through the constraint-violation message | `FR-CRM-10` | 1 | 14.8 MB |
| `uq_crm_members__tenant_id_user_id` | `crm_members` | `tenant_id, user_id` | btree | ✔ | `user_id IS NOT NULL AND deleted_at IS NULL` | `WHERE tenant_id=$1 AND user_id=$2` — linking a marketplace purchase to the tenant's existing walk-in record. Partial because an **India walk-in member may have only a phone and no platform account** | `FR-CRM-03`, `FR-CRM-04` | 0–1 | 11.8 MB |
| `idx_crm_members__tenant_id_status_created_at_desc` | `crm_members` | `tenant_id, status, created_at ↓` | btree | | — | `WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT 50` — the member list, which is the most-opened screen in the dashboard | `SCR-DASH-007`, `NFR-PERF-04` | ≤50 | 14.8 MB |
| `idx_crm_members__tenant_id_phone` | `crm_members` | `tenant_id, phone` | btree | | `phone IS NOT NULL` | `WHERE tenant_id=$1 AND phone=$2` — **the India walk-in lookup**: a phone number is what a member at the desk actually has | `FR-CRM-04`, `LAUNCH_MARKET_INDIA.md` §3 | 0–1 | 17.3 MB |
| `idx_leads__tenant_id_status_created_at_desc` | `leads` | `tenant_id, status, created_at ↓` | btree | | — | `WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT 50` — the lead funnel board | `SCR-DASH-017`, `FR-CRM-06` | ≤50 | 5.9 MB |
| `idx_leads__tenant_id_gym_id` ‡ | `leads` | `tenant_id, gym_id` | btree | | — | Composite FK support · `fk_leads__gyms`; and per-gym lead counts | `Relationships.md` §12.2 | ≤500 | 5.9 MB |
| `idx_leads__tenant_id_assigned_staff_id_status` | `leads` | `tenant_id, assigned_staff_id, status` | btree | | — | `WHERE tenant_id=$1 AND assigned_staff_id=$2 AND status='OPEN'` — a salesperson's own queue; covers `fk_leads__staff` | `FR-CRM-06`, `SCR-DASH-017` | ≤30 | 6.9 MB |

**Declined in this group:**

| Declined | Why |
| :--- | :--- |
| `gin_crm_members__full_name_trgm` for desk name search | 250,000 members over 2,000 tenants is **≈125 members per tenant**. `idx_crm_members__tenant_id_status_created_at_desc` reaches those 125 rows and an `ILIKE` filter over 125 rows costs microseconds. A trigram index here would cost ≈35 MB to make a free operation slightly freer. **This is the clearest case in the schema of indexing for the volume the query actually sees rather than the volume the table holds** |
| `idx_gyms__featured_until` for the promoted-placement filter | The predicate is `featured_until > now()`, and `now()` is not immutable, so the partial index cannot be built. The non-partial index over 2,000 rows fails `IX-R03`. Featured status is evaluated inside the ranking expression over ≤500 candidates (`SR3`) |
| `idx_saved_searches__alerts_enabled` for `FR-SRCH-14` alerts | `FR-SRCH-14` is priority **C** and is not in Phase 1. The index arrives with the feature |
| A second index on `branch_hours (weekday, opens_at)` for *"which branches open at 06:00?"* | That query is answered by `search_documents.hours_bitmap` with a bitwise `AND` (§6.5), not by a join. ADR-0007 is explicit that a live join against split-hours rows cannot hold `NFR-PERF-01` |

---

### 4.3 Group 6 — Plans (3 tables, 7 secondary indexes)

**Write profile.** Negligible. **Read profile: invariant 3.** Every read of `plans` on the checkout path is a `BR-PLN-03` price re-validation against the primary (`RR-P07`), never a cache and never a replica.

| Name | Table | Columns | Type | U | Predicate | Query served | Driver | Sel. | Y1 size |
| :--- | :--- | :--- | :--- | :-: | :--- | :--- | :--- | ---: | ---: |
| `uq_plans__tenant_id_id` ‡ | `plans` | `tenant_id, id` | btree | ✔ | — | Composite-FK referent for `plan_branches`, `orders`, `memberships`, `add_ons` | `Relationships.md` §3.2 | 1 | 0.71 MB |
| `idx_plans__gym_id_status_visibility` | `plans` | `gym_id, status, visibility` | btree | | — | `WHERE gym_id=$1 AND status='PUBLISHED' AND visibility='PUBLIC'` — the public plan catalogue on `SCR-WEB-003`; **and** `WHERE gym_id=$1 AND status IN ('DRAFT','ARCHIVED')` for `SCR-DASH-005`. The non-partial form serves both screens with one index | `§C2.4`, `FR-PLAN-09`, `FR-DETL-03` | ≤6 | 0.58 MB |
| `idx_plans__tenant_id_status_sort_order` | `plans` | `tenant_id, status, sort_order` | btree | | — | `WHERE tenant_id=$1 AND status='PUBLISHED' ORDER BY sort_order` — the multi-gym owner's whole catalogue, and the `search.reindex` price roll-up. Covers `fk_plans__tenants` | `SCR-DASH-005`, `§C5` | ≤60 | 0.58 MB |
| `ex_plans__one_active_promotion` | `plans` | `plan_id =, tstzrange(promo_starts_at, promo_ends_at) &&` | **GiST** (`btree_gist`) | | `promo_price_minor IS NOT NULL` | Enforcement: **at most one active promotion per plan**. Overlapping promotions are rejected at creation, because a read-then-write check races under two concurrent editors and the consequence is two prices for one plan at one instant — an invariant-3 breach | `BR-PLN-07` | — | 0.3 MB |
| `uq_plan_branches__plan_id_branch_id` | `plan_branches` | `plan_id, branch_id` | btree | ✔ | — | `WHERE plan_id=$1` — resolving the entitled branch set at checkout and at check-in. **Zero rows means all branches**: the table is open-world, and the absence of a row is the meaningful state | `§C2.2`, `ERD.md` §7.3 | 0–10 | 1.2 MB |
| `idx_plan_branches__branch_id` | `plan_branches` | `branch_id` | btree | | — | `WHERE branch_id=$1` — *"which plans are sellable at this branch?"* on the branch editor, and the `FR-GYM-06` guard that refuses to deactivate a branch that is the only one on a live plan; FK support | `FR-GYM-06`, `§15.8` r6 | ≤20 | 0.74 MB |
| `idx_add_ons__tenant_id_plan_id_status` | `add_ons` | `tenant_id, plan_id, status` | btree | | — | `WHERE tenant_id=$1 AND plan_id=$2 AND status='ACTIVE'` — the optional extras offered at checkout; covers the composite `fk_add_ons__plans` | `FR-PLAN-11`, `SCR-WEB-005` | ≤5 | 0.21 MB |

---
### 4.4 Group 7 — Commerce (8 tables, 27 secondary indexes)

**Write profile.** The heaviest transactional group after Attendance. 450,000 orders, 700,000 order lines, 300,000 payments and 900,000 payment events a year, and every one of those writes is on a path with a latency budget (`NFR-PERF-05`, 1.5 s p95 for payment-intent creation). `orders` carries **nine secondary indexes**, the most of any table in the schema, and §14.3 states the write-amplification arithmetic that justifies each.

| Name | Table | Columns | Type | U | Predicate | Query served | Driver | Sel. | Y1 size |
| :--- | :--- | :--- | :--- | :-: | :--- | :--- | :--- | ---: | ---: |
| `uq_orders__order_ref` ✔ † | `orders` | `order_ref` | btree | ✔ | — | `WHERE order_ref=$1` — a member or a support agent quotes the reference and **nothing else**; the tenant is the result of the lookup, not an input to it. See the finding below | `§C2.2`, `FR-SUP-04` | 0–1 | 22 MB |
| `uq_orders__idempotency_key` † | `orders` | `idempotency_key` | btree | ✔ | — | `WHERE idempotency_key=$1` — **`BR-PAY-03` exactly-once checkout**. The interceptor runs before tenant resolution, so the key is global. A 36-character UUID string per ADR-0016, not a 16-byte binary — see §1.2 note 1 | `BR-PAY-03`, ADR-0016 | 0–1 | 31 MB |
| `idx_orders__tenant_id_status_created_at_desc` | `orders` | `tenant_id, status, created_at ↓` | btree | | — | `WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT 50` — the sales list, the revenue report's date slice, and `§C5` `order.expire`'s per-tenant candidate scan. `§C2.4` row 9. Covers `fk_orders__tenants` | `§C2.4`, `SCR-DASH-006`, `NFR-PERF-04` | ≤50 | 26 MB |
| `idx_orders__tenant_id_gym_id_created_at_desc` | `orders` | `tenant_id, gym_id, created_at ↓` | btree | | — | `WHERE tenant_id=$1 AND gym_id=$2 ORDER BY created_at DESC` — the per-gym sales view a multi-gym owner opens far more often than the all-gyms one. Covers the composite `fk_orders__gyms` | `SCR-DASH-006`, `Relationships.md` §12.2 | ≤50 | 31 MB |
| `idx_orders__tenant_id_plan_id` ‡ | `orders` | `tenant_id, plan_id` | btree | | — | Composite FK support · `fk_orders__plans`; and *"how many orders did this plan take?"* on the plan editor | `§15.8` r6, `SCR-DASH-005` | ≤500 | 26 MB |
| `idx_orders__expires_at__unpaid` † | `orders` | `expires_at` | btree | | `status = 'PENDING'` | `WHERE status='PENDING' AND expires_at < now() ORDER BY expires_at LIMIT 500` — `§C5` `order.expire`, every 5 minutes, **all tenants**, releasing coupon holds. The predicate holds the index at ~4,000 live entries against a 450,000-row table | `§C5`, `FR-CART-09`, `BR-CPN-01` | ≤500 | 110 KB |
| `idx_orders__user_id_created_at_desc` † | `orders` | `user_id, created_at ↓` | btree | | — | `WHERE user_id=$me ORDER BY created_at DESC LIMIT 20` — the member's order and invoice history **across every gym they have bought from**. §3.3 Class D; requires `P-SUBJECT` (**OI-I2**) | `FR-CART-10`, `FR-INV-05`, `SCR-WEB-011` | ≤20 | 22 MB |
| `idx_orders__coupon_id` † | `orders` | `coupon_id` | btree | | `coupon_id IS NOT NULL` | `WHERE coupon_id=$1` — the **platform** coupon-performance report under `runElevated()`, which spans tenants. §3.4 rules the `tenant_id` lead out; the tenant-scoped reader uses `idx_coupon_redemptions__tenant_id_coupon_id` | `FR-CPN-07`, `Relationships.md` §12.4 | ≤20,000 | 2.2 MB |
| `idx_orders__attribution_event_id` ‡ | `orders` | `attribution_event_id` | btree | | `attribution_event_id IS NOT NULL` | FK support · `fk_orders__attribution_events`; and the `A6.3` audit question *"show me the discovery event that made this a 10% sale"* | `§15.8` r6, `A6.3` | 0–1 | 7.5 MB |
| `idx_order_items__tenant_id_order_id` | `order_items` | `tenant_id, order_id` | btree | | — | `WHERE tenant_id=$1 AND order_id=$2 ORDER BY item_type` — the checkout summary and the invoice line render. Composite FK support · `fk_order_items__orders`. **The only index on the table**, which is correct for a G-APPEND child read exclusively through its parent | `FR-INV-03`, `Relationships.md` §12.2 | ≤5 | 41 MB |
| `uq_coupons__code__platform` | `coupons` | `code` | btree | ✔ | `scope = 'PLATFORM' AND deleted_at IS NULL` | `WHERE lower(code)=lower($1) AND scope='PLATFORM'` — platform coupon resolution. Written as two partial uniques rather than one conditional index because a `PLATFORM` code and a `TENANT` code **may legitimately collide**, and resolution is tenant-first | `BR-CPN-01`, `FR-CPN-03` | 0–1 | 19 KB |
| `uq_coupons__tenant_id_code__tenant` | `coupons` | `tenant_id, code` | btree | ✔ | `scope = 'TENANT' AND deleted_at IS NULL` | `WHERE tenant_id=$1 AND lower(code)=lower($2)` — the tenant's own coupon, checked **first** at redemption | `BR-CPN-01`, `FR-CPN-03` | 0–1 | 323 KB |
| `uq_coupon_redemptions__coupon_id_user_id_order_id` ✔ † | `coupon_redemptions` | `coupon_id, user_id, order_id` | btree | ✔ | — | Enforcement **and** the counting query in one structure: `SELECT count(*) WHERE coupon_id=$1` is `total_limit`, `… AND user_id=$2` is `per_user_limit`, and both are **index-only** (§8.4). Coupon-leading, not tenant-leading, because a `PLATFORM` coupon's limits span tenants | `BR-CPN-03`, `BR-CPN-01` | ≤1 | 4.8 MB |
| `idx_coupon_redemptions__tenant_id_coupon_id` | `coupon_redemptions` | `tenant_id, coupon_id` | btree | | — | `WHERE tenant_id=$1 AND coupon_id=$2` — the tenant's own coupon-performance panel; covers the composite `fk_coupon_redemptions__coupons` | `SCR-DASH-016`, `FR-CPN-07` | ≤3,000 | 3.5 MB |
| `uq_payments__provider_provider_intent_id` ✔ † | `payments` | `provider, provider_intent_id` | btree | ✔ | `provider_intent_id IS NOT NULL` | `WHERE provider=$1 AND provider_intent_id=$2` — **Razorpay webhook correlation**. The webhook carries a provider and an intent id; the tenant is derived from the row this index finds | `BR-PAY-05`, `TR-04`, `LAUNCH_MARKET_INDIA.md` §7 | 0–1 | 20 MB |
| `idx_payments__tenant_id_order_id_status` | `payments` | `tenant_id, order_id, status` | btree | | — | `WHERE tenant_id=$1 AND order_id=$2 AND status='CAPTURED'` — **`BR-PAY-07` duplicate detection finds two captured payments on one order in one index scan**; and the payment strip on the order detail. Composite FK support · `fk_payments__orders`. `Schema.md` §7.4 names this `(order_id, status)`; the tenant lead is added because the composite foreign key is `(tenant_id, order_id)` and one index must serve both — deviation **D-I04** | `BR-PAY-07`, `Relationships.md` §12.2 | ≤3 | 21 MB |
| `idx_payments__created_at__indeterminate` † | `payments` | `created_at` | btree | | `status IN ('CREATED','PROCESSING','REQUIRES_ACTION')` | `WHERE status IN (…) AND created_at < now() - interval '15 minutes' LIMIT 200` — `§C5` `payment.reconcile`, every 15 minutes, **all tenants**, and the `BR-PAY-06` escalation. ~3,000 live entries | `§C5`, `BR-PAY-06` | ≤200 | 80 KB |
| `idx_payments__collected_by_staff_id` ‡ | `payments` | `collected_by_staff_id` | btree | | `collected_by_staff_id IS NOT NULL` | FK support · `fk_payments__staff`; and the **cash-reconciliation sheet** a receptionist closes a shift with, which in India is a material fraction of collections | `§15.8` r6, `BR-PAY-09`, `SCR-DASH-020` | ≤60 | 1.7 MB |
| `uq_payment_events__provider_event_id` ✔ † | `payment_events` | `provider_event_id` | btree | ✔ | — | `WHERE provider_event_id=$1` — **`BR-PAY-05` replay protection, and the single most security-relevant unique index in the schema**. `BR-PAY-02` makes membership activation depend on a `payment_events` row; this index is what makes that row exactly-once. Global because the webhook arrives with an event id and nothing else | `BR-PAY-05`, `BR-PAY-02` | 0–1 | 53 MB |
| `idx_payment_events__tenant_id_payment_id_received_at` | `payment_events` | `tenant_id, payment_id, received_at` | btree | | — | `WHERE tenant_id=$1 AND payment_id=$2 ORDER BY received_at` — the provider-callback timeline shown on `SCR-DASH-010` and quoted verbatim in a dispute. Composite FK support · `fk_payment_events__payments` | `FR-PAY-08`, `BR-REF-08` | ≤6 | 62 MB |
| `idx_payment_events__received_at__unprocessed` † | `payment_events` | `received_at` | btree | | `processed_at IS NULL` | `WHERE processed_at IS NULL AND received_at < now() - interval '5 minutes'` — the stuck-webhook sweep, **all tenants**. A verified event that was persisted and never processed is a member who paid and has no membership, so this is a P1 detector, not a report | `BR-PAY-06`, `BR-PAY-02` | ≤50 | 53 KB |
| `uq_invoices__tenant_id_financial_year_invoice_number` | `invoices` | `tenant_id, financial_year, invoice_number` | btree | ✔ | — | **`FR-INV-02` expressed as an index.** The §2.12 counter is the allocator; this is the proof that the **April–March** sequence is gapless and unforgeable. Also serves `WHERE tenant_id=$1 AND financial_year='2026-27' ORDER BY invoice_number` — the GST return extract — as a two-column prefix | `FR-INV-02`, `BR-PAY-10`, `LAUNCH_MARKET_INDIA.md` §4 | 1 | 24 MB |
| `uq_invoices__tenant_id_order_id` | `invoices` | `tenant_id, order_id` | btree | ✔ | — | Enforcement **and** lookup: **one invoice per order**, and `WHERE tenant_id=$1 AND order_id=$2` on `SCR-WEB-011`'s download button. Composite FK support · `fk_invoices__orders` | `BR-PAY-10`, `FR-INV-05` | 1 | 18 MB |
| `idx_invoices__tenant_id_issued_at_desc` | `invoices` | `tenant_id, issued_at ↓` | btree | | — | `WHERE tenant_id=$1 AND issued_at >= $2 AND issued_at < $3 ORDER BY issued_at DESC` — the tenant's invoice register, and the monthly GSTR-1 working file. **`issued_at` is UTC; the FY label is the `Asia/Kolkata` interpretation of it** (§13.2) | `FR-INV-06`, `SCR-DASH-012` | ≤50 | 14 MB |
| `uq_credit_notes__tenant_id_financial_year_credit_note_number` | `credit_notes` | `tenant_id, financial_year, credit_note_number` | btree | ✔ | — | The **second** gapless per-tenant-per-FY sequence, independent of the invoice sequence. A credit note is a tax document in its own right and Indian GST reporting counts them separately | `FR-INV-09`, `BR-PAY-10` | 1 | 720 KB |
| `idx_credit_notes__tenant_id_original_invoice_id` | `credit_notes` | `tenant_id, original_invoice_id` | btree | | — | `WHERE tenant_id=$1 AND original_invoice_id=$2` — *"what has been credited against this invoice?"*, which drives the `PARTIALLY_CREDITED` / `FULLY_CREDITED` status. Composite FK support · `fk_credit_notes__invoices` | `FR-INV-09`, `BR-PAY-10` | ≤3 | 528 KB |
| `idx_credit_notes__refund_id` ‡ | `credit_notes` | `refund_id` | btree | | `refund_id IS NOT NULL` | FK support · `fk_credit_notes__refunds`; and the refund detail's *"credit note issued"* link | `§15.8` r6, `BR-PAY-10` | 0–1 | 336 KB |

**Declined in this group:**

| Declined | Why |
| :--- | :--- |
| `idx_coupon_redemptions__coupon_id` — named in `Schema.md` §7.3 | **Question 3 of §2.4.** It is the exact leading-column prefix of `uq_coupon_redemptions__coupon_id_user_id_order_id`, which PostgreSQL uses for `WHERE coupon_id = $1` without any help. The unique index is also *narrower per useful scan* because the `total_limit` count is index-only against it. Creating both costs 2.2 MB and 60,000 extra index writes a year for **no plan change**. Registered as deviation **D-I05** |
| `gin_coupons__applicable_plan_ids` — named in `§2.6`'s GIN list | **IX-R03, with the arithmetic.** The redemption path resolves the coupon by code *first* and then reads `applicable_plan_ids` **out of the already-fetched row** — no index is involved. The only query that needs containment is the reverse one, *"which coupons apply to this plan?"*, over **6,000 rows / ~1.2 MB / ~150 pages**, which is a sub-millisecond sequential scan from `shared_buffers`. A GIN index would cost ~1.5 MB, a pending-list flush on every coupon edit, and would change no plan a user can perceive. §2.6's GIN membership is corrected in §15 (**D-I03**) |
| `idx_coupons__tenant_id_status_valid_to` for the coupon list | **IX-R03.** 6,000 rows across 2,000 tenants is **three coupons per tenant**. The screen sorts three rows |
| `idx_orders__commission_rule_id` for `fk_orders__commission_rules` | 26 MB and 450,000 index writes a year to support a referential-integrity check against a **40-row, G-APPEND, GLOBAL** table on which no application role holds `DELETE`. The check can never fire. One of the three declined foreign keys of §4.11 |
| `idx_invoices__tenant_id_financial_year_place_of_supply_state_code` for the GSTR-1 place-of-supply split | The two-column prefix of `uq_invoices__tenant_id_financial_year_invoice_number` already reaches the FY's rows; a tenant issues **≤150 invoices per FY** at Year-1 volume, and grouping 150 rows by state code is a hash aggregate in `work_mem` |
| `idx_payments__tenant_id_captured_at` for the revenue report | The revenue report reads `orders`, not `payments`, because `A6.3`'s nine figures live on the order and `BR-FIN-02` forbids recomputation. A payment-side revenue index would invite exactly the recomputation the constitution forbids |
| `idx_order_items__reference_id` | `reference_id` has three possible targets and **no foreign key** (`Schema.md` §7.2). The only query that would use it — *"which orders included this add-on?"* — is a monthly report on the replica |

> **Finding IX-F04 — `uq_orders__order_ref` is a fifth `SC-R06` Class-A exception, and §3.3's count of nineteen becomes twenty.** `order_ref` is a tenant-owned business key, which §3.5 says should normally be tenant-prefixed so that a constraint-violation message cannot leak another tenant's row. It is exempted on three grounds and only three. **(1)** It is server-generated with sufficient entropy that a collision is a platform defect, not a user-visible event — no tenant ever chooses the value, so no tenant can probe it. **(2)** The only lookup by `order_ref` is `SCR-ADM-006` support search and the `FR-SUP-04` ticket linker, both of which are handed a reference **before** the tenant is known; a tenant-leading index is unusable there. **(3)** The tenant-scoped reader never uses it — an owner finds an order through `idx_orders__tenant_id_status_created_at_desc`. Registered as an amendment to deviation **D-I01**.

---
### 4.5 Group 8 — Membership & Attendance (6 tables, 21 secondary indexes)

**Write profile.** `attendance` is **the** write-heavy table in the schema: 50,000 inserts/day at Year 1, 500,000/day at 10×, plus a check-out `UPDATE` on ~70% of rows. Its index ceiling under **IX-R02** is **two secondary indexes plus the primary key and the nonce unique**, and §14.3 shows that those four already account for 43% of every index byte in the database. `memberships` is the opposite profile — 300,000 writes a year against ten indexes — and carries them because it is the join point of Commerce, Attendance, Trust and Money.

| Name | Table | Columns | Type | U | Predicate | Query served | Driver | Sel. | Y1 size |
| :--- | :--- | :--- | :--- | :-: | :--- | :--- | :--- | ---: | ---: |
| `uq_memberships__tenant_id_membership_code` | `memberships` | `tenant_id, membership_code` | btree | ✔ | — | `WHERE tenant_id=$1 AND membership_code=$2` — the code printed on the card a member hands across the desk. **Unique per tenant, never globally**: a global unique leaks another tenant's row through the violation message (§3.5) | `§C2.2`, `FR-CRM-10` | 1 | 18 MB |
| `uq_memberships__user_id_gym_id__active_nonstackable` ✔ † | `memberships` | `user_id, gym_id` | btree | ✔ | `is_stackable = false AND status IN ('PENDING','ACTIVE','FROZEN')` | **`BR-MEM-04` as an index, not as a trigger.** Two simultaneous checkout submissions must produce exactly one membership (`AC-PAY-01.1`); a counting trigger races and a `SELECT … FOR UPDATE` has no row to lock. The scope is `(user_id, gym_id)` and **never `(user_id)`** — a weekday gym near the office and a weekend gym near home is an ordinary case that `BR-MEM-04` explicitly permits. §9.5 is the full treatment | `BR-MEM-04`, `AC-PAY-01.1` | ≤1 | 5.9 MB |
| `idx_memberships__tenant_id_status_end_date` | `memberships` | `tenant_id, status, end_date` | btree | | — | `WHERE tenant_id=$1 AND status IN ('ACTIVE','FROZEN') AND end_date <= $2` — **three consumers in one index**: `§C5` `membership.expire` hourly per gym timezone, `membership.renewal-reminders` at T−15/−7/−3/−1, and the expiring-memberships report. `§C2.4` row 10. `end_date` is a `date` in the gym's timezone precisely so this predicate needs no timezone expression (§13.4) | `§C2.4`, `§C5`, `BR-MEM-11` | ≤500 | 14 MB |
| `idx_memberships__user_id_status` † | `memberships` | `user_id, status` | btree | | — | `WHERE user_id=$me AND status IN ('ACTIVE','FROZEN')` — the member's memberships **across every gym**. §3.3 Class D; `§C2.4` declares it without a tenant lead and cannot be served without `P-SUBJECT` (**OI-I2**) | `§C2.4`, `FR-USER-02`, `SCR-WEB-008` | ≤4 | 14 MB |
| `idx_memberships__tenant_id_gym_id_status` | `memberships` | `tenant_id, gym_id, status` | btree | | — | `SELECT count(*) WHERE tenant_id=$1 AND gym_id=$2 AND status='ACTIVE'` — the active-member count on `SCR-DASH-001`, polled every 10–15 s, and the `A6.2` tier-limit check (`max_active_members`) at every new sale | `SCR-DASH-001`, `A6.2` | ≤5,000 | 21 MB |
| `idx_memberships__tenant_id_plan_id` ‡ | `memberships` | `tenant_id, plan_id` | btree | | — | Composite FK support · `fk_memberships__plans`; and the `FR-PLAN-10` guard that refuses to archive a plan with live memberships | `§15.8` r6, `FR-PLAN-10` | ≤1,000 | 18 MB |
| `idx_memberships__tenant_id_order_id` ‡ | `memberships` | `tenant_id, order_id` | btree | | — | Composite FK support · `fk_memberships__orders`; and the refund path's *"what did this order create?"* | `§15.8` r6, `FR-RFND-01` | ≤2 | 18 MB |
| `idx_memberships__crm_member_id` ‡ | `memberships` | `crm_member_id` | btree | | `crm_member_id IS NOT NULL` | FK support · `fk_memberships__crm_members`; and the membership block on the member profile. Partial because an India walk-in may hold a membership with **no linked platform account** | `§15.8` r6, `FR-CRM-03` | ≤6 | 9.3 MB |
| `idx_memberships__renewed_from_membership_id` ‡ | `memberships` | `renewed_from_membership_id` | btree | | `renewed_from_membership_id IS NOT NULL` | Self-FK support; and the renewal chain that `renewal_index` counts — the evidence behind a 5% rather than 10% commission (`A6.3`) | `§15.8` r6, `A6.3` | 0–1 | 3.4 MB |
| `idx_memberships__tenant_id_end_date__auto_renew` | `memberships` | `tenant_id, end_date` | btree | | `auto_renew = true AND status = 'ACTIVE'` | `WHERE tenant_id=$1 AND auto_renew AND status='ACTIVE' AND end_date = $today` — `§C5` `membership.auto-renew`, daily. `auto_renew` is **opt-in** (`BR-MEM-10`), so the predicate holds the index at a few percent of the table | `§C5`, `BR-MEM-10` | ≤50 | 0.96 MB |
| `idx_membership_events__tenant_id_membership_id_occurred_at` | `membership_events` | `tenant_id, membership_id, occurred_at` | btree | | — | `WHERE tenant_id=$1 AND membership_id=$2 ORDER BY occurred_at` — the membership timeline, which is the **only** correction mechanism on an append-only journal and therefore the thing a dispute is argued from. Composite FK support · `fk_membership_events__memberships`. **The only index on the table** | `FR-MEMB-02`, `§C4.1` | ≤10 | 62 MB |
| `ex_freezes__no_overlap` | `freezes` | `membership_id =, daterange(starts_on, ends_on, '[]') &&` | **GiST** (`btree_gist`) | | `status <> 'CANCELLED'` | Enforcement, not lookup: **two freezes on one membership may not overlap**, or `end_date` is extended twice for one day and `BR-MEM-05`'s cap becomes unenforceable. A read-then-write check races between the member's app and the desk | `BR-MEM-05`, `ERD.md` §7.4 | — | 1.6 MB |
| `idx_freezes__tenant_id_membership_id_starts_on` | `freezes` | `tenant_id, membership_id, starts_on` | btree | | — | `WHERE tenant_id=$1 AND membership_id=$2 ORDER BY starts_on` — the freeze history, and the `freeze_days_used` reconciliation. Composite FK support · `fk_freezes__memberships` | `BR-MEM-05`, `FR-MEMB-05` | ≤5 | 1.0 MB |
| `idx_freezes__ends_on__scheduled_active` † | `freezes` | `ends_on` | btree | | `status IN ('SCHEDULED','ACTIVE')` | `WHERE status IN ('SCHEDULED','ACTIVE') AND ends_on <= $today` — `§C5` `membership.unfreeze-scheduled`, hourly, **all tenants** | `§C5`, `BR-MEM-07` | ≤200 | 64 KB |
| `uq_attendance__checked_in_at_token_nonce` | `attendance` | `checked_in_at, token_nonce` | btree | ✔ | `token_nonce IS NOT NULL` | **Second-line replay protection for `BR-CHK-06`.** Declared on the parent, materialised **per partition** (§10.3), and it does **not** express *"unique within TTL"* — `Schema.md` §8.3 states that weakening plainly. Redis `SET NX` on the token's 60-second TTL is the primary, synchronous gate. See Finding IX-F05: this is the most expensive index in the schema per unit of protection | `BR-CHK-06`, `Schema.md` §8.3 | 0–1 | **1.24 GB/yr** |
| `idx_attendance__tenant_id_branch_id_checked_in_at` | `attendance` | `tenant_id, branch_id, checked_in_at` | btree | | — | `WHERE tenant_id=$1 AND branch_id=$2 AND checked_in_at >= $3 AND checked_in_at < $4` — the attendance report, the **peak-hours heatmap** of `SCR-DASH-013`, and the live occupancy counter of `SCR-DASH-009`, which touches only the current partition. `§C2.4` row 12 | `§C2.4`, `SCR-DASH-013`, `FR-CHK-12` | ≤3,000 | **1.27 GB/yr** |
| `idx_attendance__membership_id_checked_in_at_desc` † | `attendance` | `membership_id, checked_in_at ↓` | btree | | `membership_id IS NOT NULL` | `WHERE membership_id=$1 ORDER BY checked_in_at DESC LIMIT 1` — the **`BR-CHK-04` cooldown check on the 2-second `NFR-PERF-03` path**, and `SCR-WEB-010` visit history. §3.3 Class B: a membership belongs to exactly one tenant, and a leading `tenant_id` would add **293 MB/year** for zero selectivity | `BR-CHK-04`, `NFR-PERF-03`, `FR-CHK-11` | 1 | **0.88 GB/yr** |
| `idx_member_notes__tenant_id_crm_member_id_created_at_desc` | `member_notes` | `tenant_id, crm_member_id, created_at ↓` | btree | | — | `WHERE tenant_id=$1 AND crm_member_id=$2 ORDER BY created_at DESC` — the notes panel on the member profile. Composite FK support · `fk_member_notes__crm_members`. **`is_sensitive_category` is deliberately not in the index**: it gates *access*, not *retrieval*, and indexing it would let a plan reveal the count of sensitive notes to a principal not entitled to read them | `FR-CRM-05`, `NFR-PRV-07` | ≤20 | 10.4 MB |
| `idx_member_notes__author_staff_id` ‡ | `member_notes` | `author_staff_id` | btree | | — | FK support · `fk_member_notes__staff`; and the `editable_until` window check when the author reopens their own note | `§15.8` r6, `ERD.md` §4.4 | ≤500 | 5.6 MB |
| `uq_segments__tenant_id_name` | `segments` | `tenant_id, name` | btree | ✔ | `deleted_at IS NULL` | `WHERE tenant_id=$1 AND name=$2` — segment names are how staff refer to segments out loud, so they must be unique inside a tenant | `FR-CRM-02` | 1 | 555 KB |
| `idx_segments__tenant_id_gym_id` ‡ | `segments` | `tenant_id, gym_id` | btree | | — | Composite FK support · `fk_segments__gyms`; and the per-gym segment list | `§15.8` r6, `FR-CRM-02` | ≤10 | 469 KB |

**Declined in this group:**

| Declined | Why |
| :--- | :--- |
| `idx_attendance__checked_out_at` for `attendance.auto-checkout` | **Forbidden, not merely declined (§12.3).** `checked_out_at` is one of only two updatable columns on the table. Indexing it destroys the HOT-update path that `fillfactor = 85` exists to preserve, turning 35,000 check-out updates a day into 35,000 × 4 index writes. The job instead scans the **current partition** for `checked_out_at IS NULL AND checked_in_at < now() - $threshold`, and the existing `(tenant_id, branch_id, checked_in_at)` index bounds it |
| `idx_attendance__tenant_id_result_checked_in_at` for the denial-reason report | **IX-R02 ceiling.** `attendance` is at its two-secondary ceiling. The denial report is a monthly aggregate on the replica, and its date range prunes to one or two partitions before any index matters |
| `idx_attendance__corrects_attendance_id` | No foreign key exists (the target is cross-partition, `Schema.md` §8.3), and a correction is read *forward* from the original, not backward. The correction row carries the pointer; the original does not need to find it |
| `idx_membership_events__tenant_id_to_status_occurred_at` for the churn series | A monthly aggregate over 900,000 rows on the replica with no latency budget, against 900,000 extra index writes a year on an append-only table. `SCR-DASH-014` renders a pre-aggregated series, not a live scan |
| `idx_memberships__under_review_since` for the `BR-MEM-13` sharing review queue | The queue is produced by `§C5` `attendance.sharing-scan`, which already holds the membership ids it flagged; it does not need to re-find them. If the queue becomes a screen with its own filter, the index arrives with the screen |
| `idx_segments__definition` (GIN on `jsonb`) | `segments.definition` is **evaluated**, never **searched**. Nothing queries *"which segments filter on last-visit?"* |

> **Finding IX-F05 — `uq_attendance__checked_in_at_token_nonce` costs ≈1.24 GB/yr and 15.5 M index writes a year to back up a gate that already closes the window it protects.** The arithmetic is stated here because it is the single largest discretionary index cost in the schema and a future reviewer will ask.
> - **What it buys.** Protection against nonce replay in the window where Redis is unavailable and the application has failed open. It is a genuine second line.
> - **What it costs.** 1.24 GB/yr forever, 16% of the entire index budget of §14.2, and one index write on every scanned check-in — on the table whose write path owns `NFR-PERF-03`'s two-second budget.
> - **What it cannot do.** Express *"unique within the token's 60-second TTL"*. It over-enforces: the same nonce value presented legitimately eight months later is rejected, and it under-enforces across a month boundary, because uniqueness on a partitioned table is per partition (`Schema.md` §8.3).
> - **Two cheaper shapes, both referred out rather than taken here.** **(a)** Store `token_nonce` as `uuid` rather than `text` — the value is a generated 128-bit nonce rendered as hex for no reader, exactly the `refresh_tokens.token_hash` defect of IX-F03. That is 40 bytes to 16 and takes the index to **≈0.70 GB/yr**. Referred to `Schema.md` §8.3. **(b)** If Redis is accepted as the sole gate, drop the index and keep the column, saving 1.24 GB/yr and 15.5 M writes; the failure mode then requires *both* a Redis outage *and* a replayed token inside 60 seconds. **This document does not take (b)** — `Schema.md` §8.3 and `IX-R02` both name the index as present, and a register may not quietly delete a control. Registered as open item **OI-I4**, to be settled with (a) as the recommended outcome.

---

### 4.6 Group 9 — Money (8 tables, 26 secondary indexes)

**Write profile.** Low in absolute terms — 949,000 ledger entries and 1.25 M settlement lines a year — but **concentrated**: `settlement.build-batches` at 02:00 writes an entire day's lines in one window at `REPEATABLE READ`, and every index on `settlement_lines` is paid for in that window. `ledger_entries` carries a hard **four-index ceiling** under IX-R02, and §4.6's declined list shows what that ceiling actually costs.

| Name | Table | Columns | Type | U | Predicate | Query served | Driver | Sel. | Y1 size |
| :--- | :--- | :--- | :--- | :-: | :--- | :--- | :--- | ---: | ---: |
| `idx_ledger_entries__tenant_id_occurred_at` | `ledger_entries` | `tenant_id, occurred_at` `INCLUDE (direction, amount_minor, currency)` | btree | | — | `SELECT sum(…) WHERE tenant_id=$1 AND occurred_at < $2` — **every balance in the system** (`BR-FIN-01`: no table carries a balance column). The `INCLUDE` makes it an **index-only scan** over an append-only table whose visibility map goes and stays set — §8.3 is the treatment. Covers `fk_ledger_entries__tenants` | `BR-FIN-01`, `§C2.4`, `FR-SETL-02` | ≤500 | 65.8 MB/yr |
| `idx_ledger_entries__settlement_batch_id` | `ledger_entries` | `settlement_batch_id` | btree | | `settlement_batch_id IS NOT NULL` | `WHERE settlement_batch_id=$1` — assembling a closed batch's contributing entries for the statement. FK support · `fk_ledger_entries__settlement_batches` | `FR-SETL-01`, `§C2.4` | ≤15 | 33.6 MB/yr |
| `idx_ledger_entries__tenant_id_occurred_at__unbatched` | `ledger_entries` | `tenant_id, occurred_at` | btree | | `settlement_batch_id IS NULL` | `WHERE tenant_id=$1 AND settlement_batch_id IS NULL AND occurred_at < $cycle_end` — `§C5` `settlement.build-batches`' candidate scan. **The only query that would otherwise read a tenant's whole ledger history**, degrading linearly forever. The predicate holds it at ~50,000 live entries against a table that grows by 949,000 a year and is never pruned (`R-FIN`). §7.3 is the arithmetic | `§C5`, `FR-SETL-01`, `BR-FIN-06` | ≤600 | 2.4 MB |
| `brn_ledger_entries__occurred_at` | `ledger_entries` | `occurred_at` | **BRIN** | | — | `WHERE occurred_at >= $1 AND occurred_at < $2` with **no tenant predicate** — the platform revenue and commission series under `runElevated()`. Append-only and physically time-correlated, so 128-page block ranges answer what a **45 MB/yr b-tree** would. The whole index is smaller than one b-tree leaf level | `SCR-ADM-013`, `§C6` | wide | **80 KB** |
| `uq_settlement_batches__tenant_id_period_start_period_end` | `settlement_batches` | `tenant_id, period_start, period_end` | btree | ✔ | — | Enforcement: **one batch per tenant per cycle**, which is what makes `settlement.build-batches` safe to re-run. Dates are in the **tenant's** timezone (`TM2`); the ledger query converts to UTC instants once. Covers `fk_settlement_batches__tenants` | `FR-SETL-01`, `A6.4` | 1 | 5.0 MB |
| `idx_settlement_batches__status_period_end` † | `settlement_batches` | `status, period_end` | btree | | — | `WHERE status='OPEN' AND period_end <= $today` — `settlement.build-batches` and `settlement.reconcile`, **all tenants due**; and `SCR-ADM-008`'s payout queue including the `ON_HOLD` rows that `BR-FIN-07` parks | `§C5`, `BR-FIN-07`, `SCR-ADM-008` | ≤2,000 | 3.9 MB |
| `idx_settlement_batches__tenant_id_status_period_end_desc` | `settlement_batches` | `tenant_id, status, period_end ↓` | btree | | — | `WHERE tenant_id=$1 ORDER BY period_end DESC LIMIT 24` — the owner's settlements list and statement downloads | `SCR-DASH-022`, `FR-SETL-06` | ≤24 | 5.0 MB |
| `idx_settlement_lines__tenant_id_settlement_batch_id` | `settlement_lines` | `tenant_id, settlement_batch_id` | btree | | — | `WHERE tenant_id=$1 AND settlement_batch_id=$2 ORDER BY id` — **the statement render**, which reads all eight persisted figures (nine if **O-1** is agreed) per line. Composite FK support · `fk_settlement_lines__settlement_batches` | `FR-SETL-05`, `BR-FIN-02` | ≤600 | 73 MB/yr |
| `idx_settlement_lines__tenant_id_order_id` ‡ | `settlement_lines` | `tenant_id, order_id` | btree | | `order_id IS NOT NULL` | `WHERE tenant_id=$1 AND order_id=$2` — *"when was this sale paid out to me, and at what commission?"*, the single most common settlement support question. Composite FK support · `fk_settlement_lines__orders` | `FR-SETL-05`, `§15.8` r6 | ≤3 | 70 MB/yr |
| `uq_settlement_lines__ledger_entry_id` | `settlement_lines` | `ledger_entry_id` | btree | ✔ | — | Enforcement: **one statement line per ledger entry, ever**. This is what makes double payout structurally impossible rather than procedurally unlikely — a re-run of `settlement.build-batches` that tried to bill an entry twice fails on the constraint instead of paying twice. FK support · `fk_settlement_lines__ledger_entries` | `BR-FIN-03`, `INV-FIN-3` | 1 | 46.7 MB/yr |
| `idx_reserves__matures_on__held` † | `reserves` | `matures_on` | btree | | `status = 'HELD'` | `WHERE status='HELD' AND matures_on <= $today` — `§C5` `reserve.release`, daily, **all tenants**. `A6.4`'s default hold is 30 days, so the partial index carries roughly one month of holds | `§C5`, `A6.4` | ≤2,000 | 1.1 MB |
| `idx_reserves__tenant_id_status` | `reserves` | `tenant_id, status` | btree | | — | `WHERE tenant_id=$1 AND status='HELD'` — the *"held back"* figure on `SCR-DASH-022`, which a gym owner asks about more than any other number on the screen. Covers `fk_reserves__tenants` | `SCR-DASH-022`, `A6.4` | ≤30 | 5.0 MB |
| `idx_reserves__held_in_batch_id` ‡ | `reserves` | `held_in_batch_id` | btree | | — | FK support · `fk_reserves__settlement_batches`; and the batch's *"reserve withheld"* line | `§15.8` r6, `A6.4` | ≤3 | 3.9 MB |
| `idx_reserves__released_in_batch_id` ‡ | `reserves` | `released_in_batch_id` | btree | | `released_in_batch_id IS NOT NULL` | FK support on the second reference to the same parent; and the batch's *"reserve released"* line | `§15.8` r6, `A6.4` | ≤3 | 1.9 MB |
| `uq_refunds__order_id__active` † | `refunds` | `order_id` | btree | ✔ | `status NOT IN ('REJECTED','FAILED')` | **`BR-REF-09` as an index.** *"Refunds are never processed on a membership already refunded; the operation is idempotent on the order."* A service-layer check races between the member's request and the owner's approval. Order-leading rather than tenant-leading: an order belongs to exactly one tenant, so the policy filters ≤1 row (§3.3 Class B shape) | `BR-REF-09` | ≤1 | 300 KB |
| `uq_refunds__provider_refund_id` ✔ † | `refunds` | `provider_refund_id` | btree | ✔ | `provider_refund_id IS NOT NULL` | `WHERE provider_refund_id=$1` — the provider's refund callback carries a refund id and nothing else. §3.3 Class A | `BR-REF-04`, `BR-PAY-05` | 0–1 | 470 KB |
| `idx_refunds__original_payment_id` ‡ | `refunds` | `original_payment_id` | btree | | — | FK support · `fk_refunds__payments`. **The foreign key is the enforcement of `BR-REF-04`** — a refund is never issued to any instrument other than the original — so the index that supports it is load-bearing for a money rule, not for a screen | `BR-REF-04`, `§15.8` r6 | ≤2 | 336 KB |
| `idx_refunds__membership_id` ‡ | `refunds` | `membership_id` | btree | | `membership_id IS NOT NULL` | FK support · `fk_refunds__memberships`; and the membership timeline's refund entry | `§15.8` r6, `FR-RFND-01` | ≤1 | 261 KB |
| `idx_refunds__credit_note_id` ‡ | `refunds` | `credit_note_id` | btree | | `credit_note_id IS NOT NULL` | FK support · `fk_refunds__credit_notes` | `§15.8` r6, `BR-PAY-10` | ≤1 | 336 KB |
| `uq_disputes__provider_dispute_id` ✔ † | `disputes` | `provider_dispute_id` | btree | ✔ | — | `WHERE provider_dispute_id=$1` — the chargeback webhook. §3.3 Class A: the dispute notification is the **first** the platform hears of the case, and resolving the tenant *is* the lookup | `BR-REF-08` | 0–1 | 28 KB |
| `idx_disputes__status_evidence_due_at` † | `disputes` | `status, evidence_due_at` | btree | | — | `WHERE status='OPEN' ORDER BY evidence_due_at` — disputes by evidence deadline, **all tenants**. A missed deadline is a lost chargeback and an unrecoverable debit, so the ordering is the point | `BR-REF-08`, `FR-RFND-09`, `SCR-ADM-009` | ≤50 | 20 KB |
| `idx_disputes__tenant_id_payment_id` ‡ | `disputes` | `tenant_id, payment_id` | btree | | — | Composite FK support · `fk_disputes__payments`; and the *"this payment is disputed"* banner on the order | `§15.8` r6, `BR-REF-08` | ≤1 | 28 KB |
| `idx_dispute_evidence__tenant_id_dispute_id` ‡ | `dispute_evidence` | `tenant_id, dispute_id` | btree | | — | `WHERE tenant_id=$1 AND dispute_id=$2 ORDER BY submitted_at` — the evidence bundle. Composite FK support · `fk_dispute_evidence__disputes` | `§15.8` r6, `BR-REF-08` | ≤5 | 84 KB |
| `ex_commission_rules__no_overlap` | `commission_rules` | `scope =, COALESCE(subscription_tier_id, tenant_id, '00000000-…') =, tstzrange(effective_from, effective_to) &&` | **GiST** (`btree_gist`) | | — | Enforcement: **two rules may not both be effective for one scope at one instant**. Without it the commission resolver is non-deterministic, and `A6.3`'s persisted `commission_rate_bps` becomes unexplainable in a dispute — which is the exact failure `BR-FIN-05` exists to prevent | `BR-FIN-05`, `Schema.md` §9.4 | — | 16 KB |
| `idx_commission_rules__subscription_tier_id` ‡ | `commission_rules` | `subscription_tier_id` | btree | | `subscription_tier_id IS NOT NULL` | FK support · `fk_commission_rules__subscription_tiers`. Created despite the 40-row table because `§15.8` r6 admits no size exception | `§15.8` r6 | ≤2 | 8 KB |
| `idx_commission_rules__scope_effective_from_desc` | `commission_rules` | `scope, effective_from ↓` | btree | | — | `WHERE scope=$1 AND effective_from <= $sale_instant AND (effective_to IS NULL OR effective_to > $sale_instant) ORDER BY effective_from DESC LIMIT 1` — the **commission-rate resolution on every marketplace sale**. Survives `IX-R03` under its measured-plan exception: 40 rows, but the resolution runs 300,000 times a year on a path with a money outcome, and the table is fully cached so the index's real job is to make the cache-miss path deterministic | `A6.3`, `BR-FIN-05`, `R5` | 1 | 8 KB |

**Declined in this group:**

| Declined | Why |
| :--- | :--- |
| `idx_ledger_entries__reference_type_reference_id` for `ops.orphan-scan` and *"show me the ledger entries for this order"* | **IX-R02 ceiling, and the ceiling is doing real work here.** The index would cost ~50 MB/yr and 949,000 writes a year. `ops.orphan-scan` is a monthly full scan on the replica, where a sequential read of 140 MB is seconds. The per-order view is reached through `idx_settlement_lines__tenant_id_order_id`, which carries `ledger_entry_id` and is the path a statement already takes. **If a fifth index is ever added to `ledger_entries`, this is the candidate and the trade is against `idx_ledger_entries__settlement_batch_id`** |
| `idx_ledger_entries__entry_type` for the commission-vs-fee split | `entry_type` has twelve values (fourteen if **O-1** is agreed) over 949,000 rows a year — selectivity ≈8%. A b-tree the planner will refuse in favour of the `(tenant_id, occurred_at)` scan it is already doing |
| `idx_refunds__tenant_id_status_created_at_desc` for the refunds queue | **IX-R03.** 9,000 rows / ~3.6 MB / ~440 pages is a ~1.5 ms sequential scan from `shared_buffers`, inside `NFR-PERF-04`'s 800 ms budget with three orders of magnitude to spare. **Re-evaluate at 10×**, where 90,000 rows makes it worth having |
| `idx_settlement_lines__tenant_id_settlement_batch_id INCLUDE (…the eight figures…)` | A covering index pays only when it carries **every** column the query needs. The statement line needs all eight persisted figures, the currency, the order reference and the description; that `INCLUDE` list is wider than the heap tuple it would avoid. §8.5 states the rule this failed |
| `idx_disputes__tenant_id_status` for the owner's dispute list | **IX-R03.** 600 rows a year, platform-wide |
| `idx_dispute_evidence__storage_key` | The storage key is written by the platform and read by object id; no callback resolves a dispute-evidence row from its key the way `gym_media` and `kyc_documents` do |

---
### 4.7 Group 10 — Trust (3 tables, 9 secondary indexes)

**Write profile.** Negligible — 20,000 reviews, 8,000 responses and 600 reports a year. **Read profile: public.** `idx_reviews__gym_id_status_published_at_desc` is read by unauthenticated marketplace traffic on the busiest page in the product, which is why it is the one index in the group that does not lead with `tenant_id`.

| Name | Table | Columns | Type | U | Predicate | Query served | Driver | Sel. | Y1 size |
| :--- | :--- | :--- | :--- | :-: | :--- | :--- | :--- | ---: | ---: |
| `uq_reviews__user_id_membership_id` ✔ † | `reviews` | `user_id, membership_id` | btree | ✔ | — | **`BR-REV-02` as a constraint, not a check**: one review per member per gym per membership term. `membership_id` is `NOT NULL`, which is also what makes `BR-REV-03`'s *"verified member"* marker structural rather than stored — an unverified review is unrepresentable | `BR-REV-02`, `BR-REV-03` | 1 | 1.2 MB |
| `idx_reviews__gym_id_status_published_at_desc` † | `reviews` | `gym_id, status, published_at ↓` | btree | | — | `WHERE gym_id=$1 AND status='PUBLISHED' ORDER BY published_at DESC LIMIT 10 OFFSET n` — the paginated review block on `SCR-WEB-003`, served to **unauthenticated** traffic against a publicly approved listing. `§C2.4` row 14. Deliberately not `tenant_id`-leading: there is no tenant context on a public page load | `§C2.4`, `FR-REV-06`, `FR-DETL-05` | ≤10 | 1.2 MB |
| `idx_reviews__status_created_at__moderation` † | `reviews` | `status, created_at` | btree | | `status IN ('PENDING','HELD')` | `WHERE status IN ('PENDING','HELD') ORDER BY created_at` — the moderation queue, **all tenants**. `BR-REV-04`'s automated screening runs before publication, so this queue holds only what screening deferred | `FR-REV-07`, `FR-ADMN-12`, `SCR-ADM-012` | ≤200 | 56 KB |
| `idx_reviews__user_id_created_at_desc` † | `reviews` | `user_id, created_at ↓` | btree | | — | `WHERE user_id=$me ORDER BY created_at DESC` — the member's own reviews **including `HELD` ones only they can see**, across every gym. §3.3 Class D; requires `P-SUBJECT` (**OI-I2**) | `FR-REV-04`, `SCR-WEB-013` | ≤10 | 0.96 MB |
| `idx_reviews__tenant_id_gym_id_status` | `reviews` | `tenant_id, gym_id, status` | btree | | — | `WHERE tenant_id=$1 AND gym_id=$2 AND status='PUBLISHED'` — the owner's review inbox and the *"awaiting your response"* count. Covers `fk_reviews__gyms` as a composite. **A gym may never edit or delete a review** — this index serves reading and responding only, and the grant model is what enforces that | `FR-REV-05`, `SCR-DASH-015` | ≤500 | 1.4 MB |
| `uq_review_responses__review_id` ✔ † | `review_responses` | `review_id` | btree | ✔ | — | **`BR-REV-05` says *once*, so this is a unique index and not a use-case guard.** Also the lookup that attaches the response to each review on `SCR-WEB-003`. FK support · `fk_review_responses__reviews` | `BR-REV-05` | 0–1 | 300 KB |
| `idx_review_responses__tenant_id_author_staff_id` ‡ | `review_responses` | `tenant_id, author_staff_id` | btree | | — | Composite FK support · `fk_review_responses__staff`; and the response-rate metric per staff member | `§15.8` r6, `FR-REV-05` | ≤200 | 470 KB |
| `idx_review_reports__status_created_at` † | `review_reports` | `status, created_at` | btree | | — | `WHERE status='OPEN' ORDER BY created_at` — the reported-review queue, **all tenants** | `FR-REV-10`, `SCR-ADM-012` | ≤50 | 22 KB |
| `idx_review_reports__tenant_id_review_id` ‡ | `review_reports` | `tenant_id, review_id` | btree | | — | Composite FK support · `fk_review_reports__reviews`; and the *"reported N times"* badge the moderator sees before deciding | `§15.8` r6, `BR-REV-06` | ≤5 | 36 KB |

**Declined in this group:**

| Declined | Why |
| :--- | :--- |
| `idx_reviews__gym_id_rating` for the rating histogram on `SCR-WEB-003` | The histogram reads `gyms.rating_avg` and `gyms.rating_count`, which are the denormalised projection of this table maintained by `§C5` `review.aggregate` with ≤60 s staleness. Computing it live would defeat the projection that exists to avoid it |
| `gin_reviews__body_trgm` for moderation keyword search | 20,000 rows. A moderator searching review bodies is doing it over the ≤200 rows already in the queue |
| `idx_reviews__published_at` for `§C5` `review.anomaly-scan` rating-velocity detection | The scan is per gym, hourly, and `idx_reviews__gym_id_status_published_at_desc` serves it exactly. **Question 3 of §2.4** |
| `idx_reviews__deleted_at` for the soft-delete sweep | There is no sweep. `SD3` makes the domain vocabulary *unpublished* or *removed*; a removed review is retained because `BR-REV-06`'s moderation record must remain explicable |

---

### 4.8 Group 11 — Notifications & Support (6 tables, 15 secondary indexes)

**Write profile.** `notification_log` is the **largest table after `attendance`** — 20,075,000 rows written a year, held at ≈5 M steady state by rule `SC-R03`'s category-scoped retention. Its index ceiling under IX-R02 is **3**, and the three it has are worth 695 MB. The remaining five tables in the group are small.

**A fifth exception class.** `notification_log`, `support_tickets`, `ticket_messages` and `report_definitions` are `HYBRID` or `P-NULLABLE`: `tenant_id` is **nullable by design**, because a platform-originated message or a member's ticket about the platform itself has no tenant. A `tenant_id`-leading index on such a table cannot serve the platform-scope rows at all — they all share one `NULL` value, which a b-tree stores but cannot discriminate. This is **Class E** of §3.3 and is registered as a further amendment to **D-I01**.

| Name | Table | Columns | Type | U | Predicate | Query served | Driver | Sel. | Y1 size |
| :--- | :--- | :--- | :--- | :-: | :--- | :--- | :--- | ---: | ---: |
| `idx_notification_log__recipient_id_template_key_aggregate_id` † | `notification_log` | `recipient_id, template_key, aggregate_id` | btree | | — | `SELECT 1 WHERE recipient_id=$1 AND template_key=$2 AND aggregate_id=$3` — **ADR-0017's consumer-idempotency check, run before every dispatch**. Without it every one of 55,000 daily dispatches sequentially scans a 5 M-row table. Class E: `tenant_id` is nullable and the check is recipient-scoped, not tenant-scoped | ADR-0017, `FR-NOTF-07` | 0–1 | 507 MB |
| `idx_notification_log__category_sent_at` † | `notification_log` | `category, sent_at` | btree | | — | `WHERE category='OPERATIONAL' AND sent_at < now() - interval '90 days'` — **rule `SC-R03`'s category-scoped retention sweep, all tenants**, which is the single control holding this table at 2.0 GB instead of 8.0 GB/yr. `TRANSACTIONAL` retention follows `NFR-PRV-04` | `SC-R03`, `NFR-PRV-04` | ≤50,000 | 187 MB |
| `idx_notification_log__status_created_at__retryable` † | `notification_log` | `status, created_at` | btree | | `status IN ('QUEUED','FAILED')` | `WHERE status IN ('QUEUED','FAILED') AND attempts < $max ORDER BY created_at LIMIT 500` — the delivery-retry drain, **all tenants**. The predicate holds the index at ~20,000 live entries. **This is the third and last index the IX-R02 ceiling permits on this table** | `FR-NOTF-06`, `§C5` | ≤500 | 750 KB |
| `idx_support_tickets__status_sla_due_at` † | `support_tickets` | `status, sla_due_at` | btree | | — | `WHERE status IN ('OPEN','PENDING') ORDER BY sla_due_at` — the agent queue, ordered by the deadline `KPI-25` measures. Class E: a platform-scope ticket has `tenant_id IS NULL` and must appear in the same queue | `FR-SUP-04`, `KPI-25`, `SCR-ADM-010` | ≤100 | 710 KB |
| `idx_support_tickets__tenant_id_status_created_at_desc` | `support_tickets` | `tenant_id, status, created_at ↓` | btree | | `tenant_id IS NOT NULL` | `WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC` — the owner's own tickets. Partial on `tenant_id IS NOT NULL` so the platform-scope rows do not occupy a leading `NULL` run that no query reads | `FR-SUP-05`, `SCR-DASH-021` | ≤20 | 1.0 MB |
| `idx_support_tickets__requester_id_created_at_desc` † | `support_tickets` | `requester_id, created_at ↓` | btree | | — | `WHERE requester_id=$me ORDER BY created_at DESC` — the member's own tickets, **including the tenant-null ones about the platform**. This index is also the mechanism behind the `Schema.md` §11.2 ruling that the tenant-null read path is gated by requester identity | `FR-SUP-05`, `Schema.md` §11.2 | ≤10 | 912 KB |
| `idx_support_tickets__assigned_agent_id_status` † | `support_tickets` | `assigned_agent_id, status` | btree | | `assigned_agent_id IS NOT NULL` | `WHERE assigned_agent_id=$1 AND status IN ('OPEN','PENDING')` — an agent's own queue across tenant and platform scope | `FR-SUP-04`, `SCR-ADM-010` | ≤30 | 880 KB |
| `idx_ticket_messages__ticket_id_created_at` † | `ticket_messages` | `ticket_id, created_at` | btree | | — | `WHERE ticket_id=$1 ORDER BY created_at` — the thread. Class E and Class B together: `tenant_id` is nullable *and* a ticket belongs to at most one tenant, so a tenant lead would be both impossible and pointless. FK support · `fk_ticket_messages__support_tickets`. **`is_internal_note` is not indexed** — it is a render filter over ≤10 rows, and indexing it would let a plan count internal notes for a requester | `FR-SUP-04` | ≤10 | 3.6 MB |
| `uq_referrals__code` | `referrals` | `code` | btree | ✔ | — | `WHERE code=$1` — **the code is the invitation**, resolved on a public landing page before any authentication. `referrals` is `IDENTITY`, so `SC-R06` does not apply and no exception is needed | `FR-REFR-01`, `BR-RFL-01` | 0–1 | 1.1 MB |
| `uq_referrals__referrer_user_id_referee_user_id` | `referrals` | `referrer_user_id, referee_user_id` | btree | ✔ | `referee_user_id IS NOT NULL` | Enforcement: **one qualifying pair, once**. Partial because the referee is null until the invitation is accepted, and a referrer may hold many open invitations. Also serves *"my referrals"* as a leading-column prefix | `BR-RFL-01` | ≤50 | 1.2 MB |
| `idx_referrals__status_qualifies_at__pending` | `referrals` | `qualifies_at` | btree | | `status = 'PENDING' AND qualifies_at IS NOT NULL` | `WHERE status='PENDING' AND qualifies_at <= now()` — the qualification sweep. **`qualifies_at` is materialised from the order's refund-policy snapshot** so the sweep needs no join through order → snapshot → policy, which is the whole reason the column exists | `BR-RFL-01`, `BR-REF-02` | ≤500 | 450 KB |
| `uq_report_definitions__report_key__platform` | `report_definitions` | `report_key` | btree | ✔ | `scope = 'PLATFORM' AND deleted_at IS NULL` | `WHERE report_key=$1 AND scope='PLATFORM'` — resolving a platform-supplied report. The two-partial-unique pattern of §9.7, same shape as `coupons` | `FR-RPT-05` | 0–1 | 8 KB |
| `uq_report_definitions__tenant_id_report_key` | `report_definitions` | `tenant_id, report_key` | btree | ✔ | `scope = 'TENANT' AND deleted_at IS NULL` | `WHERE tenant_id=$1 AND report_key=$2` — a tenant-defined report, which **may legitimately share a key with a platform one**; resolution is tenant-first | `FR-RPT-05` | 0–1 | 16 KB |
| `idx_export_jobs__tenant_id_created_at_desc` | `export_jobs` | `tenant_id, created_at ↓` | btree | | — | `WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 50` — the exports list. **`BR-DAT-05` makes this a first-class screen**, not a queue artefact: a tenant must be able to export its complete operational dataset at any time without contacting support, and see what it already asked for. Covers `fk_export_jobs__tenants` | `BR-DAT-05`, `FR-RPT-07` | ≤50 | 1.15 MB |
| `idx_export_jobs__url_expires_at__live` † | `export_jobs` | `url_expires_at` | btree | | `status = 'COMPLETE' AND storage_key IS NOT NULL` | `WHERE status='COMPLETE' AND url_expires_at < now()` — the object-expiry sweep, **all tenants**. **The row is retained 90 days after the object expires** (`NFR-PRV-04`), so the sweep clears storage, not rows, and the partial predicate is what keeps the two lifecycles apart | `NFR-PRV-04`, `BR-DAT-01` | ≤200 | 80 KB |

**Declined in this group:**

| Declined | Why |
| :--- | :--- |
| `idx_notification_log__tenant_id_created_at_desc` for the tenant's own notification log | **IX-R02 ceiling — the table is at three.** The owner-facing view is reached by recipient through `idx_notification_log__recipient_id_template_key_aggregate_id`'s leading column, which is the query a staff member actually runs (*"what did we send this member?"*). A tenant-wide chronological feed of 10,000 sends a day is not a screen anyone asked for, and it would cost **240 MB** |
| `idx_notification_log__provider_message_id` for delivery-receipt callbacks | The receipt callback carries the platform's own id in its metadata (`FR-NOTF-06`), so the update is by primary key. A provider that cannot echo metadata would need this index; **the adapter contract requires it, so the index does not** |
| `idx_notification_log__aggregate_id` alone | Prefix rule inverted: `aggregate_id` is the **third** column of the idempotency index and cannot be used alone. But no query asks *"every message about this order regardless of recipient"* — the audit question is answered from `audit_log` and `outbox` |
| `idx_ticket_messages__author_id` | 76,000 rows and no query. Agent throughput is a monthly aggregate on the replica |
| `idx_referrals__referee_user_id` | Covered as a prefix? **No** — it is the *second* column of `uq_referrals__referrer_user_id_referee_user_id`. It is declined instead because the only reader is the acceptance flow, which arrives holding the `code` and uses `uq_referrals__code` |
| `gin_report_definitions__parameters` | 400 rows, and `parameters` is executed, never searched |

---
### 4.9 Group 12 — Platform Reference (11 tables, 14 secondary indexes)

**Write profile.** Near-zero. These are the `NFR-DQ-06` platform-managed reference tables — amended by
migration (`SeedStrategy.md` §3), never by application traffic. Every one is **RLS-exempt**
(`§C2.3`), so §3.1's tenant-leading rule does not apply to any of them and no `†` mark is needed:
they are outside the rule, not exceptions to it.

**The small-table rule dominates here.** Rule §2.3 says a table PostgreSQL will sequentially scan
in under a millisecond does not get an index for read speed. Ten of these eleven tables are under
5,000 rows. What they *do* get is **unique indexes that enforce the stable-identifier contract** of
`NFR-DQ-06`, because a duplicate amenity slug is a data-quality defect that survives forever in
every gym that selected it.

| Name | Table | Columns | Type | U | Predicate | Query served | Driver | Sel. | Y1 size |
| :--- | :--- | :--- | :--- | :-: | :--- | :--- | :--- | ---: | ---: |
| `uq_countries__iso2` | `countries` | `iso2` | btree | ✔ | — | `WHERE iso2='IN'` — the launch-market lookup that resolves the tax profile, KYC checklist and currency. Two rows at launch (`IN`, plus a test fixture); the uniqueness is the point, not the speed | `NFR-DQ-06`, `OBJ-09` | 0–1 | 8 KB |
| `uq_cities__country_code_slug` | `cities` | `country_code, slug` | btree | ✔ | — | `WHERE country_code='IN' AND slug=$1` — resolves `/city/:citySlug` on `SCR-WEB-002`'s SEO landing pages. Also the uniqueness that stops two *Bengaluru* rows existing after a taxonomy edit | `FR-NAV-05`, `NFR-DQ-06` | 0–1 | 40 KB |
| `idx_cities__country_code_is_served` | `cities` | `country_code` | btree | | `is_served = true` | `WHERE country_code='IN' AND is_served` — the city selector shown when a visitor denies geolocation (`SRCH` edge case: *"fall back to a city selector, never an empty state"*). Partial because `C9.4` gates cities individually and most Indian cities are unserved at launch | `FR-SRCH-01`, `C9.4` | ≤50 | 6 KB |
| `uq_localities__city_id_slug` | `localities` | `city_id, slug` | btree | ✔ | — | Locality resolution for `FR-SRCH-02` free-text search across locality names, and the `C9.4` *"≥5 localities, not clustered in one"* coverage gate | `FR-SRCH-02`, `C9.4` | 0–1 | 180 KB |
| `gin_localities__name_trgm` | `localities` | `name` | GIN (`gin_trgm_ops`) | | — | `WHERE name % $q` — typo-tolerant locality matching in `/search/suggest`. **The one index in this group justified by speed rather than uniqueness**: ~8,000 Indian localities is past the §2.3 threshold, and this path is on the `NFR-PERF-01` search budget | `FR-SRCH-02`, `NFR-PERF-01` | ≤20 | 640 KB |
| `uq_amenities__slug` | `amenities` | `slug` | btree | ✔ | — | The `FR-GYM-03` platform-controlled taxonomy. **Free-text amenities are prohibited because they break filtering** — this index is the mechanism that makes the prohibition enforceable rather than aspirational | `FR-GYM-03`, `NFR-DQ-06` | 0–1 | 8 KB |
| `uq_gym_categories__slug` | `gym_categories` | `slug` | btree | ✔ | — | Resolves `/c/:categorySlug` on `SCR-WEB-002` category landings | `FR-NAV-05` | 0–1 | 8 KB |
| `uq_subscription_tiers__code` | `subscription_tiers` | `code` | btree | ✔ | — | `WHERE code='GROWTH'` — tier resolution during commission computation. Four rows. Unique because `FR-ADMN-03`'s precedence chain (global < tier < tenant) resolves by code, and two `GROWTH` rows would make the effective rate non-deterministic | `FR-ADMN-03`, `A6.2` | 0–1 | 8 KB |
| `uq_tax_profiles__country_code_effective_from` | `tax_profiles` | `country_code, effective_from` | btree | ✔ | — | `WHERE country_code='IN' AND effective_from <= $sale_date ORDER BY effective_from DESC LIMIT 1` — **the profile in force at the moment of sale**, which is what `BR-PAY-11` requires and what makes a later rate change unable to alter an issued invoice. The unique pair stops two profiles claiming the same start date | `BR-PAY-11`, `FR-INV-05`, `FR-ADMN-05` | 0–1 | 8 KB |
| `uq_kyc_checklists__country_code_document_type` | `kyc_checklists` | `country_code, document_type` | btree | ✔ | — | The ten-row India checklist of `LAUNCH_MARKET_INDIA.md` §6, resolved at `FR-ONB-03` step 2 | `FR-ONB-03`, `FR-ADMN-06` | 0–1 | 8 KB |
| `uq_reason_codes__taxonomy_code` | `reason_codes` | `taxonomy, code` | btree | ✔ | — | All five `§C4.8` taxonomies in one table, discriminated by `taxonomy`. `WHERE taxonomy='CHECKIN_DENIAL' AND code=$1`. **A reason code is never deleted, only deprecated** — a denied check-in from 2027 must still render its reason in 2032 | `§C4.8`, `FR-ADMN-07` | 0–1 | 16 KB |
| `uq_feature_flags__key` | `feature_flags` | `key` | btree | ✔ | — | `WHERE key=$1` — server-side flag resolution (`FR-ADMN-08`, ADR-0026). The resolved set is computed per request and cached; this index serves the cache miss | `FR-ADMN-08` | 0–1 | 8 KB |
| `uq_notification_templates__template_key_channel_version` | `notification_templates` | `template_key, channel, version` | btree | ✔ | — | `FR-NOTF-03` versioned templates. The triple is unique because the same logical message exists per channel and each channel versions independently — which is precisely what lets an email template be edited instantly while its SMS sibling waits for DLT approval | `FR-NOTF-03` | 0–1 | 24 KB |
| `idx_notification_templates__channel_dlt_state` ¶ | `notification_templates` | `channel, dlt_state` | btree | | `channel = 'SMS'` | `WHERE channel='SMS' AND dlt_state='PENDING_DLT_APPROVAL'` — the TRAI DLT approval queue of `LAUNCH_MARKET_INDIA.md` §8. **Created by the India localisation migration, not the first one** — hence `¶`. Partial on SMS because no other channel has an approval state | `LAUNCH_MARKET_INDIA.md` §8, `FR-NOTF-03` | ≤20 | 8 KB |

**Declined in this group:**

| Declined | Why |
| :--- | :--- |
| `idx_amenities__sort_order`, `idx_gym_categories__sort_order` | §2.3 exactly. Forty rows, read once per page render, and already resident in cache |
| `idx_cities__name` for admin city search | An admin typing a city name is searching fewer than 800 served rows. `gin_localities__name_trgm` exists because localities are 8,000 and on the public latency budget; cities are neither |
| `idx_reason_codes__taxonomy` alone | Prefix of `uq_reason_codes__taxonomy_code`. Rule §2.1: a prefix is not a second index |
| `idx_tax_profiles__country_code` alone | Same prefix rule. And the query always carries `effective_from`, because a profile without a date is `BR-PAY-11` waiting to be violated |
| `gin_feature_flags__targeting` on the JSONB targeting rules | Forty flags. Targeting is *evaluated* in application code against a resolved set, never queried in SQL |

---

### 4.10 Group 13 — Infrastructure (3 tables, 8 secondary indexes)

**Write profile.** The highest sustained write rate in the schema after `attendance`. `outbox`
absorbs every domain event (ADR-0017), `idempotency_keys` absorbs every mutating request
(`BR-PAY-03`), and `audit_log` absorbs every state change on a governed entity (`BR-DAT-01`). None
of the three is ever read by a user-facing screen except `audit_log` through `FR-ADMN-09`.

**Two of the three are queues, and a queue index is a different object from a lookup index.** A queue
index is read by exactly one consumer, in one order, with a predicate that keeps it small no matter
how large the table grows. The `outbox` table will hold 40 M rows in a year; its drain index holds
**at most a few thousand entries at any instant**, because a row leaves the predicate the moment it
is dispatched. Sizing a queue index against table cardinality is the most common way to over-provision
a schema, and §1.2's basis explicitly sizes these against *live set*, not row count.

| Name | Table | Columns | Type | U | Predicate | Query served | Driver | Sel. | Y1 size |
| :--- | :--- | :--- | :--- | :-: | :--- | :--- | :--- | ---: | ---: |
| `idx_outbox__published_at_created_at__undispatched` † | `outbox` | `created_at` | btree | | `published_at IS NULL` | `WHERE published_at IS NULL ORDER BY created_at LIMIT 500 FOR UPDATE SKIP LOCKED` — **the outbox drain, all tenants**. `SKIP LOCKED` is what lets the worker tier scale horizontally without a distributed lock per row. The partial predicate is the entire design: 40 M rows a year, ≤5,000 live | ADR-0017, `§C5` `notification.dispatch` | ≤500 | 190 KB |
| `idx_outbox__aggregate_type_aggregate_id` ‡ | `outbox` | `aggregate_type, aggregate_id` | btree | | — | Not read in steady state. Read during **incident reconstruction**: *"every event this order emitted, in order"*. `retain-unscanned` because its value is realised on the worst day, not the average one — removing it under `IX-R04` would be removing the instrument you need precisely when you cannot create it | ADR-0017, `Monitoring.md` runbooks | ≤20 | 1.6 GB |
| `idx_outbox__attempts_published_at__poisoned` † | `outbox` | `attempts` | btree | | `published_at IS NULL AND attempts >= 5` | `WHERE published_at IS NULL AND attempts >= 5` — the dead-letter view. Feeds alert `ALRT-outbox-poison` in `Monitoring.md`. Tiny by construction; if it is not tiny, that is the alert firing | `NFR-MNT-06`, `Monitoring.md` | ≤50 | 8 KB |
| `uq_idempotency_keys__key_endpoint` ✔ † | `idempotency_keys` | `key, endpoint` | btree | ✔ | — | **`BR-PAY-03` itself.** `WHERE key=$1 AND endpoint=$2` on every mutating request, returning the stored response on a match and `409` on a fingerprint mismatch (`§C1.5`). Scoped by endpoint so the same client-supplied key on two different operations is not a false collision. Not tenant-leading: the key is client-supplied and the lookup happens **before** tenant context is fully resolved on some paths — Class C of §3.3 | `BR-PAY-03`, `§C1.5` | 0–1 | 340 MB |
| `idx_idempotency_keys__expires_at` † | `idempotency_keys` | `expires_at` | btree | | — | `WHERE expires_at < now()` — the 24-hour expiry sweep, **all tenants**. Without it the table grows without bound and `uq_idempotency_keys__key_endpoint` degrades with it | `§C1.5` | ≤200,000 | 96 MB |
| `idx_audit_log__entity_type_entity_id_occurred_at` † | `audit_log` | `entity_type, entity_id, occurred_at` | btree | | — | `WHERE entity_type=$1 AND entity_id=$2 ORDER BY occurred_at` — **`AC-ADMN-02.1`: given any entity id, every change in chronological order.** `§C2.4` row 15. Per-partition (§10.3). Not tenant-leading because an auditor reconstructs by entity, and a platform-scope entity has no tenant — Class D | `AC-ADMN-02.1`, `FR-ADMN-09`, `§C2.4` | ≤200 | 1.1 GB |
| `idx_audit_log__actor_id_occurred_at` † | `audit_log` | `actor_id, occurred_at` | btree | | — | `WHERE actor_id=$1 ORDER BY occurred_at` — the other half of `§C2.4` row 15: *"queryable by entity and by actor"* (`BAC-13`). Also the staff-activity view of `FR-STAF-05`. Per-partition | `BAC-13`, `FR-STAF-05`, `§C2.4` | ≤5,000 | 980 MB |
| `idx_audit_log__impersonated_by_occurred_at` † | `audit_log` | `impersonated_by, occurred_at` | btree | | `impersonated_by IS NOT NULL` | `WHERE impersonated_by IS NOT NULL AND ...` — **`AC-ADMN-02.2`: every action taken during an impersonation, visible and marked as impersonated**, and `BR-DAT-02`'s requirement that the impersonated user can see it in their own account activity. Partial, so it costs almost nothing: impersonation is rare by design (`FR-AUTH-12` caps it at 30 minutes and forbids financial mutations) | `BR-DAT-02`, `AC-ADMN-02.2` | ≤50 | 2.4 MB |

**Declined in this group:**

| Declined | Why |
| :--- | :--- |
| `idx_outbox__event_type` | No consumer filters by type — the drain takes everything in order. Adding it would cost 1.6 GB to serve a question nobody asks |
| `idx_idempotency_keys__tenant_id` | Class C: the lookup is by client-supplied key. A tenant-leading index here would be unusable by the only query that exists |
| `idx_audit_log__tenant_id_occurred_at` | **Considered seriously and declined.** A tenant-wide chronological audit feed sounds useful, but `FR-ADMN-09`'s explorer filters by actor, entity type, entity id, action and date range — never by tenant alone — and `B3.2` grants the tenant owner only `▪` (own records) on audit. At 2.1 GB it is the single most expensive index in the schema, and it would serve a screen that does not exist. Re-open if `FR-ADMN-09` gains a tenant-scoped timeline |
| `gin_audit_log__before`, `gin_audit_log__after` on the JSONB state columns | Searching *inside* before/after state is a forensic operation run a handful of times a year over a bounded date range. Two GIN indexes on 100 M rows of JSONB would cost more than the table |

---

### 4.11 The three foreign keys covered by neither a dedicated index nor a prefix

§4.0 requires every foreign key to be indexed, and records that three are not. Each declination is
made in writing here, as `PROJECT_CONSTITUTION.md` §15.8 rule 6 demands.

| Foreign key | Child → parent | Why no index |
| :--- | :--- | :--- |
| `fk_gym_media__branches` | `gym_media.branch_id` → `branches.id` | Nullable and rarely set — media is attached to the gym, and only a minority of rows carry a branch. The only reader is the branch detail screen, which already holds `gym_id` and filters ≤30 rows in memory (`FR-ONB-04` caps photographs at 30). A cascade delete never fires because `branches` is soft-deleted (`SD3`). **Re-open if per-branch galleries become a first-class surface** |
| `fk_reason_codes__deprecated_by` | `reason_codes.deprecated_by` → `reason_codes.id` | Self-referencing, on a 400-row RLS-exempt reference table, read only by the admin taxonomy screen. §2.3 |
| `fk_report_definitions__created_by_staff_id` | `report_definitions.created_by_staff_id` → `staff.id` | 400 rows. The attribution is rendered, never filtered on. Deleting a staff row does not cascade — `staff` is soft-deleted and `FR-STAF-04` requires historical attribution to survive removal, which is the opposite of a cascade |

> **The general principle.** An unindexed foreign key is a real risk in two situations: a cascading
> delete that must scan the child table, and a frequent join from parent to child. All three above
> fail both tests — soft delete removes the cascade, and small cardinality removes the join cost.
> A foreign key on a table that grows, or on a table with a real cascade, is **never** declined.

---

## 5. The spatial index

`branches.location` is `geography(Point, 4326)` and carries `gist_branches__location`. It is the
index the entire marketplace stands on: `FR-SRCH-01`'s radius search, `FR-DETL-01`'s *similar gyms
nearby*, and `BR-GYM-08`'s address-to-geo tolerance check all resolve through it.

### 5.1 Why `geography` and not `geometry`

| | `geography(Point,4326)` — chosen | `geometry(Point,4326)` |
| :--- | :--- | :--- |
| Distance unit | **Metres, on the spheroid** | Degrees — meaningless as a distance |
| `ST_DWithin` semantics | True great-circle distance | Planar, wrong at India's latitudes unless reprojected |
| Reprojection needed | None | To a metric SRS per region — and India spans multiple UTM zones |
| Cost | ~2× slower per comparison | Faster, but wrong |

`FR-SRCH-03` filters by *distance radius* and `SCR-WEB-002`'s result card shows a distance in
kilometres. Both are user-facing metres. Choosing `geometry` would mean reprojecting on every query
or shipping a distance that is wrong by several percent — and India spanning UTM zones 42N–47N means
there is no single planar projection that is correct nationally. **The 2× cost buys correctness we
would otherwise have to reconstruct in application code.**

### 5.2 The query plan the index must serve

```sql
-- illustrative — not committed code
SELECT b.id, b.gym_id,
       ST_Distance(b.location, $origin) AS distance_m
FROM   branches b
JOIN   gyms g ON g.id = b.gym_id
WHERE  ST_DWithin(b.location, $origin, $radius_m)   -- ← gist_branches__location
  AND  b.status = 'ACTIVE'
  AND  g.status = 'APPROVED'
  AND  g.deleted_at IS NULL
ORDER  BY b.location <-> $origin                     -- ← KNN, same index
LIMIT  20;
```

Two distinct index capabilities are used in one statement:

1. **`ST_DWithin` as a filter.** GiST answers *"which branches are within N metres"* as a bounding-box
   search followed by exact recheck. This is the selective step: a 3 km radius in a dense Indian
   metro returns tens of branches out of 5,000 nationally.
2. **`<->` as an ordering operator.** The KNN capability lets PostgreSQL walk the index in
   increasing-distance order and stop at `LIMIT 20`, rather than fetching every match and sorting.
   Without it, *"nearest 20"* becomes a full sort of the radius result set.

> **The ordering trap.** `ORDER BY ST_Distance(...)` is a function call and **cannot use the index**;
> `ORDER BY location <-> $origin` is the KNN operator and can. They return the same rows in the same
> order. Only one of them is indexable. Any review that sees `ORDER BY ST_Distance` in a hot path
> rejects it.

### 5.3 Combining spatial with the non-spatial filters of `FR-SRCH-03`

`FR-SRCH-03` lists eleven filters: distance, price range, amenities, rating, open-now, 24-hour,
gender policy, plan durations, trial available, parking. **A GiST index serves exactly one of them.**

The plan that works is: spatial index narrows to the radius set, then non-spatial predicates filter
it. That ordering is correct because distance is by far the most selective filter — 3 km of a city
holds a tiny fraction of the national catalogue, whereas *"has parking"* holds perhaps half.

The design consequence is stated in `Scalability.md` §5 and repeated here because it is an index
decision: **the non-spatial filters are answered from a denormalised search projection, not by
joining seven tables per search.** `FR-SRCH-06`'s result card needs cover photo, name, distance,
rating, review count, verified badge, lowest monthly-equivalent price, three amenities and open/closed
status. Assembling that per row from `gyms`, `branches`, `plans`, `gym_amenities`, `branch_hours` and
`gym_media` at `NFR-PERF-09`'s 2,000 searches/minute is not achievable. The projection is maintained
transactionally through the outbox (ADR-0017), so `BR-PLN-03` — *never show a price that cannot be
bought* — holds: a published price change and its projection update commit together or not at all.

| Filter | Served by |
| :--- | :--- |
| Distance radius | `gist_branches__location` |
| Amenities (multi-select) | GIN on the projection's `amenity_ids` array |
| Price range, rating, gender policy, 24-hour, trial, parking | btree on the projection's scalar columns |
| Open-now | Computed against `branch_hours` in the projection, refreshed at the hour boundary in the **gym's** timezone (`BR-MEM-03`'s timezone rule applies to hours too) |
| Free-text `q` | §6 |

### 5.4 What the spatial index does not do

- **It does not enforce `BR-GYM-08`.** The address-to-geo tolerance check computes a distance between
  the geocoded postal address and the map pin at submission time. That is one `ST_Distance` call on
  two literals — no index involved.
- **It does not order by relevance.** `FR-SRCH-10`'s ranking blends distance with rating, freshness,
  conversion and featured status. Distance enters as one weighted term; the final ordering is a
  computed expression and, per §11.4, is applied after the index has narrowed the candidate set.

---

## 6. Full-text and trigram indexes

`FR-SRCH-02` requires free-text search across gym name, locality, city and amenity synonyms, **with
typo tolerance**. `C1.1` fixes the mechanism: PostgreSQL full-text plus trigram, with OpenSearch
deferred until the catalogue exceeds roughly 50,000 listings (ADR-0007).

### 6.1 Two indexes, two different failure modes

| | `tsvector` + GIN | `pg_trgm` + GIN |
| :--- | :--- | :--- |
| Answers | *"documents containing these words"* | *"strings that look like this string"* |
| Handles | Stemming, stop words, weighting | **Misspelling, transposition, partial words** |
| Fails on | `"Iorn Works"` — no lexeme matches | Long multi-word queries; it is O(query length) |
| Used for | The `q` parameter against name + description + locality | Autocomplete and fuzzy name matching |

`FR-SRCH-02` needs both, because *typo tolerance* is not a property full-text search has. A member
typing `"crossfitt bandra"` gets nothing from `tsvector` and the right answer from `pg_trgm`.

### 6.2 The generated-column approach

The searchable document is a **stored generated column** on the search projection rather than a
trigger-maintained one:

```sql
-- illustrative — not committed code
ALTER TABLE gym_search_projection
  ADD COLUMN search_document tsvector
  GENERATED ALWAYS AS (
      setweight(to_tsvector('simple', coalesce(gym_name,     '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(locality_name,'')), 'B') ||
      setweight(to_tsvector('simple', coalesce(city_name,    '')), 'C') ||
      setweight(to_tsvector('simple', coalesce(amenity_text, '')), 'D')
  ) STORED;

CREATE INDEX gin_gym_search_projection__search_document
  ON gym_search_projection USING GIN (search_document);
```

Generated beats trigger-maintained for three reasons: it cannot drift from its source columns, it
needs no test coverage of its own beyond the column definition, and it is visible in the schema
rather than hidden in a trigger body — which matters under `PROJECT_CONSTITUTION.md` §15's rule that
business logic never lives in a trigger.

**`'simple'`, not `'english'`.** Indian gym names blend English, transliterated Hindi and proper
nouns — *Shakti*, *Talwalkars*, *Gold's Gym Koramangala*. English stemming would mangle them and
English stop-word removal would silently delete meaningful tokens. `'simple'` lower-cases and splits
without stemming, and the recall that stemming would have provided is supplied by trigram instead.
This is recorded as an open item for the launch-city language review.

### 6.3 The synonym problem

`FR-SRCH-02` says *"amenity synonyms"*. Neither index provides them: *"weights"* and *"free weights"*
and *"dumbbells"* are different strings and different lexemes. A maintained synonym mapping is
required — a platform reference table expanding a query term to its equivalents before the search
runs. This is registered in `TECH_DEBT.md` as the cost of not running a search engine: a synonym ring
is configuration in OpenSearch and a table plus a join here.

### 6.4 Index cost

| Index | Table | Rows | Size | Rebuild cost |
| :--- | :--- | ---: | ---: | :--- |
| `gin_gym_search_projection__search_document` | projection | 5,000 | 12 MB | Seconds |
| `gin_gym_search_projection__gym_name_trgm` | projection | 5,000 | 9 MB | Seconds |
| `gin_localities__name_trgm` | `localities` | 8,000 | 640 KB | Seconds |

All three are trivially small because they index a **projection of 5,000 branches**, not 100 M
attendance rows. This is the argument for the projection restated as an index cost: search indexes
over a projection are cheap to build, cheap to rebuild, and cheap to get wrong and fix.

> **The OpenSearch trigger, restated.** ADR-0007 sets it at ~50,000 listings. §6.3's synonym table
> and §5.3's eleven-filter projection are both workarounds for capabilities a search engine has
> natively. When the second of those becomes painful before the row count does, the trigger has
> effectively fired early — and that is a legitimate reason to migrate.

---

## 7. Partial indexes

A partial index is the highest-leverage tool in this schema, because almost every hot query in the
system is interested in a **small, bounded subset of a large, growing table**. The pattern recurs so
often that it is worth stating as a rule rather than rediscovering per table.

> **`IX-R05`.** Where a query's predicate is stable, discriminating, and matches a minority of rows,
> the index carries that predicate. An index that is 2% of its table's size answers the same question
> and costs 2% of the write amplification.

| Index | Table rows (Y1) | Predicate | Live entries | Full size | Partial size | Saving |
| :--- | ---: | :--- | ---: | ---: | ---: | ---: |
| `idx_outbox__…__undispatched` | 40,000,000 | `published_at IS NULL` | ≤5,000 | 1.6 GB | 190 KB | **99.99%** |
| `idx_memberships__…__active` | 300,000 | `status = 'ACTIVE'` | 100,000 | 14 MB | 4.7 MB | 66% |
| `idx_orders__…__pending` | 500,000 | `status = 'PENDING'` | ≤2,000 | 24 MB | 96 KB | 99.6% |
| `idx_plans__…__published` | 20,000 | `status='PUBLISHED' AND visibility='PUBLIC'` | 12,000 | 940 KB | 560 KB | 40% |
| `idx_reviews__…__moderation` | 20,000 | `status IN ('PENDING','HELD')` | ≤200 | 940 KB | 56 KB | 94% |
| `idx_notification_log__…__retryable` | 5,000,000 | `status IN ('QUEUED','FAILED')` | ≤20,000 | 187 MB | 750 KB | 99.6% |
| `idx_audit_log__impersonated_by…` | 100,000,000 | `impersonated_by IS NOT NULL` | ≤3,000 | 2.4 GB | 2.4 MB | 99.9% |

**Total saving across the seven: ≈4.2 GB of index, and the corresponding write amplification.**

### 7.1 The two ways a partial index betrays you

1. **The predicate must be *provably* implied by the query.** PostgreSQL uses a partial index only
   when it can prove the query's `WHERE` implies the index predicate. `WHERE status = 'ACTIVE'`
   matches `WHERE status = 'ACTIVE'`. `WHERE status = ANY($1)` — a parameterised array, which is what
   an ORM often emits — **does not**, because the planner cannot see the array's contents at plan
   time. Prisma's `in:` filter generates exactly this shape. Every partial index in the catalogue is
   paired with a note in `Schema.md` about the query form the repository must emit, and the
   integration test asserts the plan uses the index rather than merely returning correct rows.
2. **A status value added to an enum silently falls outside the predicate.** Adding `SUSPENDED` to
   the membership status enum does not add it to `WHERE status = 'ACTIVE'` — correct here, but the
   same change against `status IN ('QUEUED','FAILED')` would silently exclude a new retryable state.
   §12 lists this as a review-time check on every enum addition.

---

## 8. Covering and `INCLUDE` indexes

An index-only scan avoids the heap entirely. It is available when every column the query needs is in
the index and the page is visible in the visibility map. `INCLUDE` adds payload columns to a b-tree
leaf without adding them to the sort key — so they cost storage but not comparison depth, and they do
not participate in uniqueness.

**Four places in this schema justify it. No others do.**

| Index | Key columns | `INCLUDE` | Query made index-only | Why it earns the payload |
| :--- | :--- | :--- | :--- | :--- |
| `idx_memberships__…__active_covering` | `tenant_id, gym_id, status` | `user_id, end_date, sessions_total, sessions_used` | The check-in entitlement lookup | On the `NFR-PERF-03` 2 s budget at `NFR-PERF-08`'s 500 check-ins/minute. Every avoided heap fetch is a random I/O in the one path that must never degrade |
| `idx_plans__…__published_covering` | `gym_id, status, visibility` | `price_minor, currency, duration_value, duration_unit` | The plan strip on `SCR-WEB-003` | Read on every gym detail page view — the highest-volume authenticated-optional read in the system, and on the `NFR-PERF-02` LCP budget |
| `idx_settlement_lines__batch_covering` | `settlement_batch_id` | the eight `A6.3` figures | Statement rendering | `BR-FIN-02` forbids recomputation at display time, so the figures are read exactly as stored. If they are read and never computed, they may as well be in the index |
| `idx_attendance__membership_covering` | `membership_id, checked_in_at ↓` | `branch_id, result` | The `BR-CHK-04` cooldown check | Runs before every check-in, inside the same latency budget as the entitlement lookup |

### 8.1 Why not more

`INCLUDE` columns are stored in every leaf tuple and are **rewritten on every update to the row**.
On `memberships`, `sessions_used` is in the payload and changes on every session-plan check-in — so
the covering index is deliberately scoped to the columns that change rarely relative to how often
they are read. Adding `updated_at` to any payload would make the index churn on every write and is
categorically forbidden.

The visibility-map dependency also matters: an index-only scan degrades to a heap fetch on
recently-updated pages. On `attendance`, which is append-only and never updated, the visibility map
stays clean and the index-only scan is reliable. On a hot-updated table it would not be, and that
asymmetry is why two of the four are on append-only or near-static data.

---

## 9. Unique indexes that enforce business rules

Some uniqueness in this schema is a data-quality nicety. Some of it **is the business rule**, and the
index is the only thing standing between the platform and a rule violation that no amount of
application code can reliably prevent under concurrency.

`Constraints.md` §4 owns the full unique inventory. This section covers the six where the *index
mechanics* are the interesting part.

### 9.1 `BR-PAY-03` — idempotency

`uq_idempotency_keys__key_endpoint`. Two concurrent requests carrying the same key race to insert;
exactly one wins, the loser catches the unique violation and returns the stored response. **The race
is resolved by the index, not by a check-then-insert**, which under any isolation level below
serialisable would let both through.

### 9.2 Webhook replay protection — `BR-PAY-05`

`uq_payment_events__provider_event_id`. Razorpay may deliver the same event twice; the PRD requires
deduplication by provider event id. Same mechanic: insert-and-catch, never select-then-insert.

### 9.3 `FR-INV-02` — the gapless sequence, and why an index cannot deliver it

`uq_invoices__tenant_id_financial_year_invoice_number` guarantees **uniqueness**. It does not
guarantee **gaplessness**, and no index can.

Gaplessness requires that the number allocated to a failed invoice is either reused by the retry or
occupied by a documented void record (`AC-INV-01.2`: *"a silently skipped number is a defect"*). A
PostgreSQL sequence cannot do this — sequences deliberately leak values on rollback, which is what
makes them fast. The allocation is therefore a **row lock on a per-tenant-per-financial-year counter
row**, taken inside the same transaction as the invoice insert.

**India makes this sharper.** The financial year runs **April–March**, so the counter resets on
1 April. Two transactions straddling midnight on 31 March must land in different years and different
sequences, computed in `Asia/Kolkata`, not UTC — and UTC+05:30 means the boundary falls at 18:30 UTC
on 31 March. `MigrationStrategy.md` names the FY rollover as a freeze window for anything touching
`invoices` for exactly this reason.

### 9.4 `BR-MEM-04` — concurrent memberships

*"Concurrent memberships at the same gym are rejected unless the plans are explicitly marked
stackable."* The partial unique index covers the non-stackable case:

```sql
-- illustrative — not committed code
CREATE UNIQUE INDEX uq_memberships__user_gym_active_nonstackable
  ON memberships (user_id, gym_id)
  WHERE status IN ('PENDING','ACTIVE','FROZEN') AND is_stackable = false;
```

`is_stackable` is **copied onto the membership at purchase**, not joined from `plans`. A partial
index predicate cannot reference another table, and — more importantly — `BR-PLN-02` freezes
purchased terms, so a later change to the plan's stackability must not retroactively make an existing
pair of memberships illegal. `ERD.md` §7.2 records the same denormalisation from the relationship
side.

### 9.5 `BR-REV-02` — one review per membership term

`uq_reviews__user_id_membership_id`, with `membership_id NOT NULL`. Scoping to the *membership* rather
than to `(user, gym)` is what implements *per membership term*: a member who lapses and rejoins holds
a new membership and may review again. And because the column is `NOT NULL`, a review with no
membership behind it **cannot be represented** — which is `BR-REV-03`'s *"there is no unverified
review type"* enforced structurally rather than by a status flag.

### 9.6 `BR-PLN-07` — at most one active promotion

Uniqueness is the wrong tool; two promotions on one plan are illegal only if their windows *overlap*.
That is an exclusion constraint over a `tstzrange`, backed by a GiST index — `Constraints.md` §5 owns
it. Noted here because reviewers reach for a unique index first and it does not work.

### 9.7 The two-partial-unique pattern for soft delete and dual scope

Two distinct problems share one solution, and both appear in the catalogue above.

**Soft delete (`SD7`).** A plain unique index on `gyms.slug` would let a soft-deleted gym block a
legitimate re-registration of the same slug forever. The index is partial on
`WHERE deleted_at IS NULL`, so only live rows compete.

**Dual scope.** `coupons` and `report_definitions` each hold platform-scoped rows (`tenant_id IS NULL`)
and tenant-scoped rows in one table. A single unique index cannot express *"unique per tenant, and
separately unique among platform rows"*, because `NULL` never equals `NULL` in a unique index —
meaning unlimited platform rows could share one code. Two partial unique indexes express it exactly:

```sql
-- illustrative — not committed code
CREATE UNIQUE INDEX uq_coupons__code__platform ON coupons (code)
  WHERE scope = 'PLATFORM' AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_coupons__tenant_id_code ON coupons (tenant_id, code)
  WHERE scope = 'TENANT'   AND deleted_at IS NULL;
```

A tenant may legitimately mint `NEW20` while the platform also runs `NEW20`; `FR-CPN-02`'s resolution
order decides which applies. Both predicates also carry the soft-delete clause, so the two problems
are solved by one pair of indexes.

---

## 10. Indexes on partitioned tables

Two tables are partitioned by time under `NFR-SCAL-06`: `attendance` monthly on `checked_in_at`, and
`audit_log` monthly on `occurred_at`. Together they are **83% of all row volume** in the schema and
would otherwise dominate every maintenance operation.

### 10.1 Why these two and no others

Partitioning earns its complexity when a table is large, append-only, queried within a bounded time
window, and expired wholesale. Both qualify on all four counts; nothing else does.

| | `attendance` | `audit_log` |
| :--- | :--- | :--- |
| Y1 rows | 18,250,000 | 100,000,000 |
| Written by | Every check-in (`FR-CHK-04`) | Every governed state change (`BR-DAT-01`) |
| Updated after write | **Never** (`BR-CHK-09` — corrections are reversal records) | **Never** (append-only, no UPDATE grant) |
| Typical query window | Last 30–90 days | A named entity, or a date range |
| Retention | Operational + 12 months (`NFR-PRV-04`) | **7 years** (`NFR-PRV-04`) |
| Expiry mechanism | `DETACH` + archive | `DETACH` + archive to cold storage |

The retention line is the decisive one. Deleting 18 M expired attendance rows with `DELETE` produces
18 M dead tuples, a multi-hour vacuum, and index bloat across every index on the table. `ALTER TABLE
… DETACH PARTITION` is a catalogue update measured in milliseconds and leaves no bloat at all.
`audit_log`'s seven-year horizon makes the difference starker still.

### 10.2 The primary-key consequence, stated once in §4.0 and explained here

PostgreSQL requires that **every unique constraint on a partitioned table include the partition key**.
So the primary keys are composite:

- `pk_attendance` on `(checked_in_at, id)`
- `pk_audit_log` on `(occurred_at, id)`

`id` alone is not unique *as declared*, though it remains globally unique in practice because it is a
UUID. Two consequences that reviewers must internalise:

1. **A foreign key cannot reference these tables.** Nothing does, by design — attendance and audit
   rows are referenced by id from application code and from `Monitoring.md` runbooks, never by a
   database-level FK. `Relationships.md` §9 records this as a deliberate no-FK relationship.
2. **Prisma must model the composite key.** A `@@id([checkedInAt, id])` block, not `@id` on `id`.
   Fetching by id alone requires the timestamp too, or accepts a scan across partitions — so the
   repository interface takes both, and `Schema.md` §12.4 specifies the signature.

### 10.3 Indexes are per-partition, and that is mostly good news

An index created on the partitioned parent is a template: PostgreSQL creates a matching index on
every existing partition and on every future one automatically.

| Effect | Consequence |
| :--- | :--- |
| **Each partition's index is independently sized** | A query with a `checked_in_at` range hits one or two small b-trees, not one enormous one. Index depth stays at 3–4 levels instead of 5–6 |
| **Partition pruning happens before index access** | `WHERE checked_in_at >= now() - interval '30 days'` touches two partitions. The other 10 are never opened |
| **`REINDEX` is per-partition** | A bloated index on one month is rebuilt in minutes without touching the other eleven |
| **`CREATE INDEX` on the parent takes a lock on every partition** | ⚠️ The one piece of bad news. It must be done partition-by-partition with `CONCURRENTLY`, then attached to the parent — §10.5 |
| **Index count multiplies** | 3 indexes × 12 monthly partitions = 36 physical indexes on `attendance`. The `IX-R02` ceiling is counted **per logical index**, not per physical one, or the ceiling would be meaningless |

### 10.4 Partition maintenance

`§C5` schedules `audit.partition-maintenance` monthly. It does three things, and the ordering matters:

1. **Create ahead.** Provision the next **three** months of partitions, not one. A missing partition
   is an insert failure on the check-in path — the single worst place in the system to discover a
   scheduling bug. Three months of headroom means the job can fail twice without user impact, and
   `Monitoring.md` alerts on a horizon below two months.
2. **Detach expired.** `DETACH PARTITION CONCURRENTLY`, then archive the detached table to object
   storage, then drop. Detach and drop are separate steps separated by a retention hold, so a
   mistaken detach is recoverable.
3. **Verify.** Assert every partition in the retention window exists, has its full index set attached,
   and that no row landed in a `DEFAULT` partition. **A `DEFAULT` partition with rows in it means the
   create-ahead job failed silently** — it is configured to exist purely as a tripwire, and any row
   arriving in it raises an alert rather than being quietly absorbed.

### 10.5 Creating a new index on a partitioned table without downtime

```sql
-- illustrative — not committed code
-- 1. Build on the parent as an unattached template (fast: no data, ACCESS EXCLUSIVE briefly)
CREATE INDEX idx_attendance__new ON ONLY attendance (tenant_id, result);

-- 2. Build on each partition concurrently — no long lock on any one of them
CREATE INDEX CONCURRENTLY idx_attendance_2026_08__new
  ON attendance_2026_08 (tenant_id, result);
-- … repeat per partition …

-- 3. Attach each child; the parent index becomes valid once all children are attached
ALTER INDEX idx_attendance__new
  ATTACH PARTITION idx_attendance_2026_08__new;
```

The naive `CREATE INDEX ON attendance (...)` takes `ACCESS EXCLUSIVE` on **every** partition for the
whole build and would stop check-ins nationally. `MigrationStrategy.md` carries this as a worked
pattern; it is repeated here because it is an index operation and this is where a reviewer will look.

---

## 11. Index maintenance

### 11.1 Bloat

B-tree indexes bloat when rows are updated or deleted and the freed space is not reusable. In this
schema bloat concentrates in exactly the tables that are updated rather than appended:
`memberships` (status transitions, `sessions_used`), `orders` (status transitions), `gyms`
(denormalised rating and freshness recomputation), and the search projection.

The append-only tables — `attendance`, `audit_log`, `ledger_entries`, `payment_events`,
`membership_events` — **do not bloat**, because nothing is ever updated or deleted. This is a real
operational dividend of the append-only rule that is easy to overlook when justifying it.

| Threshold | Action |
| :--- | :--- |
| Bloat > 30% on an index above 100 MB | Schedule `REINDEX INDEX CONCURRENTLY` in the next maintenance window |
| Bloat > 50% on any index | Raise a ticket; investigate the write pattern, not just the symptom |
| Bloat > 30% on a partitioned table's index | Reindex the affected partition only |

`REINDEX … CONCURRENTLY` is the only permitted form in production. The blocking form is forbidden by
`NFR-AVL-06`.

### 11.2 Unused-index detection — rule `IX-R04`

`pg_stat_user_indexes.idx_scan` is reviewed quarterly on the primary **and on every replica
separately** — an index unused on the primary may be the one serving every report on the replica, and
dropping it based on primary statistics alone is a classic self-inflicted outage.

> **`IX-R04`.** An index with `idx_scan = 0` across all nodes for two consecutive quarterly reviews,
> that is not marked `‡ retain-unscanned`, and that is not a unique or exclusion constraint, is
> dropped. The drop is a migration with a written justification and is reversible.

The `‡` mark exists precisely so this rule cannot delete the instruments that only earn their keep
during an incident — `idx_outbox__aggregate_type_aggregate_id` being the clearest case. Its value is
realised on the worst day of the year, and that is the one day you cannot build it.

Statistics reset on `pg_stat_reset()` and on a major-version upgrade. The review records the
statistics-collection start time alongside the scan counts, and a window shorter than one full
quarter invalidates that review rather than producing a decision on partial data.

### 11.3 `ANALYZE`, statistics targets, and the correlation trap

Autovacuum's `ANALYZE` is adequate for most tables. Three need help:

| Table | Adjustment | Why |
| :--- | :--- | :--- |
| `attendance` | `ALTER TABLE … ALTER COLUMN tenant_id SET STATISTICS 500` | Tenant cardinality is extremely skewed — a handful of large tenants hold most rows, and the default 100 buckets make the planner badly misestimate selectivity for the long tail |
| `memberships` | Extended statistics on `(tenant_id, status)` | The columns are correlated: a suspended tenant's memberships are disproportionately `EXPIRED`. Without `CREATE STATISTICS` the planner multiplies independent selectivities and underestimates by an order of magnitude |
| Search projection | More aggressive autovacuum scale factor | Rebuilt continuously by the outbox consumer; stale statistics here directly violate `NFR-PERF-01` |

### 11.4 The ranking-expression caveat

`FR-SRCH-10` requires the ranking formula to be *"configurable without deployment"*. A configurable
expression **cannot be indexed** — an expression index is fixed at creation, and changing the formula
would silently stop using it while continuing to return correct results, slowly. This is exactly the
failure mode that looks like a capacity problem and is actually a configuration change.

The design therefore applies ranking **after** the index has narrowed the candidate set: spatial and
scalar filters produce tens to low hundreds of candidates, ranking sorts those in memory. The index
serves selectivity; the expression serves ordering. `Scalability.md` §5 sets the candidate-set ceiling
that keeps this honest, and `Monitoring.md` alerts if the ceiling is exceeded rather than letting the
sort quietly grow.

### 11.5 The maintenance calendar

| Cadence | Activity |
| :--- | :--- |
| Continuous | Autovacuum and autoanalyze, with per-table overrides above |
| Daily | Bloat estimate on indexes above 100 MB; partition-horizon check |
| Weekly | Index size growth trend; slow-query review against `pg_stat_statements` |
| Monthly | `audit.partition-maintenance`; reindex anything past threshold |
| Quarterly | `IX-R04` unused-index review across all nodes; statistics-target review |
| Per release | Plan-regression check on the twelve hot-path queries listed in `Scalability.md` §8 |

---

## 12. Anti-patterns forbidden in this schema

Each is forbidden because it has a specific, named way of going wrong here — not because it is
generally discouraged.

| # | Anti-pattern | Why it is forbidden here |
| :-: | :--- | :--- |
| 1 | **An index per column, added defensively** | The `IX-R02` ceiling exists to prevent it. On `attendance` at 50,000 writes/day, each additional index is a measurable share of the `NFR-PERF-03` check-in budget |
| 2 | **A single-column index that is already a prefix** | `(tenant_id)` when `(tenant_id, status, end_date)` exists. Pure cost. Rule §2.1 |
| 3 | **Indexing a low-cardinality boolean alone** | `is_primary`, `is_offline`, `is_internal_note`. Half the table matches; the planner correctly ignores it. Use it as a **partial predicate** on another index instead |
| 4 | **`ORDER BY ST_Distance(...)` in a hot path** | Not indexable. Use the `<->` KNN operator. §5.2 |
| 5 | **A `tenant_id`-leading index on a `HYBRID` or `P-NULLABLE` table** | Class E of §3.3. All platform-scope rows share one `NULL` and cannot be discriminated |
| 6 | **A partial index whose predicate the query cannot prove** | Prisma's `in:` emits `= ANY($1)`, which does not match `status IN ('A','B')` at plan time. §7.1 |
| 7 | **`updated_at` in an `INCLUDE` payload** | Churns the index on every write. §8.1 |
| 8 | **A unique index intended to prevent overlap** | Overlap is an exclusion constraint. `BR-PLN-07`, §9.6 |
| 9 | **A unique index on a soft-deleted table without the partial predicate** | A deleted row blocks re-creation forever. `SD7`, §9.7 |
| 10 | **`CREATE INDEX` without `CONCURRENTLY` in production** | `ACCESS EXCLUSIVE` for the build duration. On a partitioned parent it locks every partition. §10.5 |
| 11 | **A GIN index on JSONB "in case we search it later"** | `audit_log.before`/`after` at 100 M rows would exceed the table's own size to serve a query run a handful of times a year |
| 12 | **Dropping an index on primary statistics alone** | Replicas serve reports. `IX-R04` requires all nodes |
| 13 | **An expression index over a runtime-configurable formula** | Silently stops being used when the configuration changes. §11.4 |
| 14 | **Adding an enum value without re-checking partial predicates** | A new retryable status outside `status IN ('QUEUED','FAILED')` is invisible to the drain. §7.1 |

---

## 13. Summary

### 13.1 The numbers

| Measure | Value |
| :--- | ---: |
| Tables | 79 |
| Primary-key indexes | 79 (**≈1.35 GB**) |
| Secondary indexes, logical | **201** |
| Secondary indexes, physical (partitions expanded) | 267 |
| Unique indexes enforcing a business rule | 26 |
| Partial indexes | 41 |
| Covering (`INCLUDE`) indexes | 4 |
| GiST (spatial + exclusion) | 5 |
| GIN (full-text + trigram + array) | 6 |
| Indexes declined in writing | 63 |
| Foreign keys covered | 159 of 162 (3 declined, §4.11) |
| **Total index footprint at Year 1** | **≈ 11.4 GB** |
| Index-to-table size ratio | 0.38 |
| Saving from partial predicates alone | **≈ 4.2 GB** |

### 13.2 The five indexes that matter most

If only five survived, the platform would still work and the other 196 would be optimisations.

| Index | Without it |
| :--- | :--- |
| `gist_branches__location` | No marketplace. Every search becomes a full scan with a distance computation per row |
| `idx_memberships__…__active_covering` | Check-in misses `NFR-PERF-03` immediately; `NFR-PERF-08`'s 500/minute is unreachable |
| `uq_idempotency_keys__key_endpoint` | `BR-PAY-03` is unenforceable. Double charges under any concurrency |
| `idx_outbox__…__undispatched` | The outbox drain scans 40 M rows per poll. Notifications and projections stall; `BR-PLN-03` breaks as prices go stale |
| `idx_audit_log__entity_type_entity_id_occurred_at` | `AC-ADMN-02.1` and `BAC-13` fail. An auditor cannot reconstruct anything |

### 13.3 Open items handed forward

| # | Item | Owner |
| :-: | :--- | :--- |
| **OI-X1** | The `'simple'` text-search configuration is provisional pending the launch-city language review. If Hindi or regional-script search is required at launch, §6.2 is revisited before Sprint 4 | Product · `OQ-01` follow-up |
| **OI-X2** | The amenity synonym ring (§6.3) has no owner. It is reference data requiring editorial maintenance, and no `FR-ADMN-07` screen currently manages it | Operations |
| **OI-X3** | `idx_audit_log__tenant_id_occurred_at` is declined (§4.10) on the basis that no tenant-scoped audit timeline exists. Re-open if `FR-ADMN-09` gains one | Engineering |
| **OI-X4** | If `BLK-03` conflict 2 resolves in favour, `commission_tax_minor` joins the `idx_settlement_lines__batch_covering` payload. Sized: +18 MB | Finance · `BLK-03` |
| **OI-X5** | Candidate-set ceiling for §11.4's post-index ranking is set in `Scalability.md` §5 but not yet alerted on in `Monitoring.md` | Engineering |

### 13.4 What this document guarantees, and what it does not

**Guarantees.** Every index has a named query and a named requirement. Every foreign key is covered
or declined in writing. Every declination is recorded with its reason, so a future engineer
re-proposing it meets the argument rather than the silence. Every partial predicate is stated so the
repository knows the query form it must emit.

**Does not guarantee.** That these are the *right* indexes at real production volume. Sizing rests on
`§1.2`'s stated basis and `NFR-SCAL-01`'s Year-1 anchors, both of which are projections. The first
month of production traffic will contradict some of this. The controls that catch it are `IX-R04`'s
quarterly review, the weekly `pg_stat_statements` pass, and the per-release plan-regression check —
and the discipline that an index added in response to real traffic still gets a catalogue row and a
named query, exactly like every index above.

---

*End of Indexes.md.*

