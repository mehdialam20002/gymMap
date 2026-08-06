# Naming Convention — The Database Naming Law

> **Phase:** 4 — Physical database design (pre-code) · **Status:** Authoritative for every identifier
> in the PostgreSQL 16 schema · **Date:** 2026-08-06 · **Launch market:** India
>
> **Precedence.** `PROJECT_CONSTITUTION.md` §8.6 and §8.7 **bind** this document and win any
> disagreement. §8.6 says so in terms: *"The database naming rules restate and bind
> `/docs/database/NamingConvention.md`; where the two ever differ, this section wins."* Everything
> here either restates §8.6/§8.7 or extends it into territory the constitution does not cover —
> schemas, views, functions, triggers, roles, sequences, the 63-byte limit, the abbreviation list,
> the Prisma mapping law, and the CI lint that enforces the whole thing.
>
> **No `schema.prisma`, no migration and no application code exists.** Every fenced block is
> **illustrative — not committed code**.

---

## 1. The four laws

| # | Law | Consequence |
| :-: | :--- | :--- |
| **L1** | **One name for one thing, everywhere.** A concept that is `settlement_batch` in SQL is `SettlementBatch` in Prisma, `SettlementBatch` in the domain, `settlement_batch_id` in a foreign key, `settlement-batches` in a URL path and `settlement_batch_id` in a JSON body | A rename is a three-release `MG3` expand-migrate-contract, so getting it right the first time is the only cheap option |
| **L2** | **The SQL identifier is the contract.** Prisma model names, TypeScript types and JSON field names are all derived from it and may differ in *case*, never in *substance* | §20 |
| **L3** | **Every identifier fits in 63 bytes without truncation by PostgreSQL.** PostgreSQL silently truncates at `NAMEDATALEN - 1 = 63`; two long constraint names that truncate to the same string produce a duplicate-object error at migration time and an unnameable object at drop time | §3.3 |
| **L4** | **Every identifier is greppable.** Searching the repository for `payable_to_gym_minor` must find the column, the Prisma field, the DTO field, the report and the test. A name that appears in three spellings is a name that cannot be audited | The abbreviation list (§23) is closed for exactly this reason |

---

## 2. Character set, case and quoting

| Rule | Statement |
| :--- | :--- |
| **N1** | Identifiers use `[a-z0-9_]` only. No uppercase, no hyphens, no dots, no Unicode |
| **N2** | Identifiers begin with a letter, never a digit or an underscore. A leading underscore is reserved for Prisma's implicit relation tables, which are **banned** (`Relationships.md` §13.3) — the CI lint fails on `^_` for exactly this reason |
| **N3** | **Double-quoted identifiers are forbidden.** PostgreSQL folds unquoted identifiers to lower case; quoting preserves case and creates an object that can only ever be referenced quoted. `"createdAt"` and `createdat` are different columns, and one of them is a bug |
| **N4** | Words are separated by a single underscore. Never two, never a hyphen: `check_in_at`, not `check__in_at`, not `check-in-at`. The **double** underscore is reserved as the section separator in constraint and index names (§7–§11) and appears nowhere else |
| **N5** | Numbers appear in identifiers only where they carry meaning: `address_line1`, `address_line2`, `iso_3166_alpha2`. Never as disambiguators: `status2`, `idx1`, `fk1` |

| Good | Bad | Why the bad one is bad |
| :--- | :--- | :--- |
| `payable_to_gym_minor` | `"payableToGymMinor"` | Requires quoting forever; breaks every hand-written query |
| `checked_in_at` | `CheckedInAt` | Folds to `checkedinat`, which is unreadable and un-greppable |
| `idx_memberships__tenant_id_status_end_date` | `idx_memberships_tenant_id_status_end_date` | Single underscore makes `memberships_tenant` ambiguous with a table named `memberships_tenant` |

---

## 3. Schemas and the length budget

### 3.1 Schemas

| Rule | Statement |
| :--- | :--- |
| **S1** | The application schema is `public`. One schema, shared across tenants — `ADR-0006`, `PROJECT_CONSTITUTION.md` §11.1. Schema-per-tenant was rejected (`STACK_ADDITIONS.md` Part 3) and the migration path for a single large account (`TL5`) creates a schema named `tenant_<first-8-of-uuid>`, never `tenant_<legal_name>` |
| **S2** | PostGIS objects live in a dedicated `extensions` schema, not in `public`, so `pg_dump` of the application schema does not carry the extension's 800 functions. `search_path = public, extensions` |
| **S3** | No `app`, `core`, `data` or `main` schema. A second schema in Phase 1 would be a boundary the module structure already provides in code |

| Good | Bad |
| :--- | :--- |
| `public.memberships`, `extensions.st_dwithin` | `gymmap.memberships`, `public.st_dwithin` |
| `tenant_7f3a91c2` | `tenant_iron_paradise_andheri` |

### 3.2 The 63-byte budget

Every identifier must fit. The worst case in this schema is a composite index on a long table with
four columns and a predicate. Budget:

| Object | Prefix | Body | Worst real case | Bytes |
| :--- | :--- | :--- | :--- | ---: |
| Table | — | ≤ 30 | `branch_hour_exceptions` | 22 |
| Column | — | ≤ 30 | `renewal_commission_rate_bps` | 27 |
| FK | `fk_` + `__` | child + parent + role | `fk_notification_templates__notification_templates__supersedes` | 61 |
| Index | `idx_` + `__` | table + columns | `idx_attendance__tenant_id_branch_id_checked_in_at` | 49 |
| Partial index | `idx_` + `__` + `__` | + predicate | `idx_gyms__status_rating_avg__approved_not_deleted` | 49 |
| RLS policy | `rls_` + `__` | table + purpose | `rls_branch_hour_exceptions__tenant_isolation` | 44 |
| Partition | — | table + `_yYYYYmMM` | `branch_hour_exceptions_y2026m08` | 31 |

### 3.3 The truncation algorithm — applied in order, stopping at the first that fits

An identifier over 63 bytes is **never** left to PostgreSQL. Apply these in order and stop:

| # | Step | Example |
| :-: | :--- | :--- |
| 1 | Drop the `_id` suffix from every column name in an index or constraint body | `idx_orders__tenant_id_status_created_at` → `idx_orders__tenant_status_created_at` |
| 2 | Apply the approved abbreviations of §23 to the **non-leading** words only | `notification_templates` → `notif_templates` in the role position |
| 3 | Drop the repeated table name from a self-referencing FK | `fk_notification_templates__notification_templates__supersedes` → `fk_notif_templates__self__supersedes` |
| 4 | Truncate the **column list**, never the table name, and append a 4-character lowercase base-36 hash of the full intended name | `idx_memberships__tenant_status_end_date_gym_plan` → `idx_memberships__tenant_status_end_date_k3xq` |

Step 4 is a last resort and every use of it is recorded in the checked-in `identifier-exceptions.json`
fixture that the CI lint reads (§28). **Two objects may never share a truncated name**; the hash
exists to guarantee that.

| Good | Bad |
| :--- | :--- |
| `fk_notif_templates__self__supersedes` (step 3 applied, 36 bytes) | `fk_notification_templates__notification_templates__supersedes_version` (69 bytes — PostgreSQL silently makes it `..._supersedes_versi`) |
| `idx_memberships__tenant_status_end_date_k3xq` with a fixture entry | `idx_memberships__t_s_e_g_p` (unreadable, and the hash is missing so a second truncation can collide) |

---

## 4. Tables

| Rule | Statement | Source |
| :--- | :--- | :--- |
| **T1** | `snake_case`, **plural** | §8.6 |
| **T2** | A noun phrase naming the *thing recorded*, not the action that records it | `A3.4` ubiquitous language |
| **T3** | No prefixes. No `tbl_`, no module prefix, no `gm_` | §8.6 |
| **T4** | Join tables name **both sides**, in the order parent-then-child, using the PRD's own naming | §8.6 |
| **T5** | Event/journal tables are `<subject>_events`; log tables are `<subject>_log` (singular `log`, because it is a mass noun) | `§C2.2` uses both forms and they mean different things: `_events` is a domain journal, `_log` is a delivery or audit record |
| **T6** | A table's name is never a reserved word (§22) and is never the singular of another table |

| Good (from this schema) | Bad | Why |
| :--- | :--- | :--- |
| `settlement_batches` | `SettlementBatch`, `settlement_batch`, `tblSettlementBatch` | Case, number, prefix |
| `branch_hour_exceptions` | `branch_exceptions`, `exceptions` | Loses which hours; `exceptions` is meaningless in isolation |
| `plan_branches`, `gym_amenities`, `staff_branches`, `coupon_redemptions` | `plan_branch_map`, `PlanToBranch`, `_GymToAmenity` | `_map` is noise; `PascalCase` breaks N3; `_Gym…` is Prisma's implicit table, banned |
| `membership_events` (domain journal), `notification_log` (delivery record), `audit_log` (mutation record) | `membership_log`, `notification_events` | T5: a journal of state transitions is not a delivery log |
| `attribution_events` | `attributions` | The row records an **event** at an instant, and is append-only |
| `idempotency_keys` | `idempotency`, `idem_keys` | T1 plural; `idem` is not on the §23 list |

**The one table whose name looks wrong and is right:** `audit_log`, not `audit_logs`. It is a single
log with many rows, and `§C2.2`, `PROJECT_CONSTITUTION.md` §15.7 and `NFR-SEC-13` all name it in the
singular. Recorded as a permanent exception in the lint fixture rather than renamed, because
`audit_log` appears in nine documents and a rename buys nothing.

---

## 5. Columns

### 5.1 The general rule

| Rule | Statement |
| :--- | :--- |
| **C1** | `snake_case`, singular unless the value is itself a collection (`reason_codes text[]`, `applicable_plan_ids uuid[]`) |
| **C2** | The name states **what the value is**, never its type: `status`, not `status_enum`; `location`, not `location_geog` |
| **C3** | The name is not prefixed with the table name. `memberships.status`, never `memberships.membership_status`. The exception is `<table>_code`/`<table>_ref` where the value is a human-facing external identifier: `membership_code`, `order_ref`, `invoice_number` |
| **C4** | Every column has a documented purpose (`NFR-PRV-01`); a column whose meaning is not obvious from its name has failed before the documentation is written |

### 5.2 The typed suffix and prefix table — the whole convention in one place

| Kind | Pattern | Type | Good | Bad |
| :--- | :--- | :--- | :--- | :--- |
| Primary key | `id` | `uuid` | `id` | `membership_id`, `pk`, `uid`, `guid` |
| Foreign key | `<referenced_table_singular>_id` | `uuid` | `tenant_id`, `settlement_batch_id`, `original_invoice_id` | `tenant`, `fk_tenant`, `tenantId`, `batch` |
| **Money** | `<name>_minor` **+ adjacent `currency`** | `bigint`, `char(3)` | `payable_to_gym_minor`, `commission_tax_minor`, `currency` | `gross numeric(10,2)`, `amount`, `price_paise`, `total_rupees` |
| Rate | `<name>_bps` | `int` | `commission_rate_bps`, `reserve_bps`, `renewal_commission_rate_bps` | `commission_rate numeric(5,4)`, `rate_pct` |
| Instant | `<past-participle-verb>_at` | `timestamptz` | `created_at`, `issued_at`, `checked_in_at`, `evidence_due_at`, `attributed_at` | `created`, `timestamp`, `date_created`, `checkin_time` |
| Calendar date | `<name>_date` **or** the bare period noun | `date` | `start_date`, `end_date`, `period_start`, `period_end` | `start`, `from_dt`, `valid_from_date` where the value is an instant |
| Boolean | `is_` / `has_` / `allows_` / `<verb>_allowed` | `boolean` | `is_primary`, `is_offline`, `is_closed`, `has_balance_due`, `freeze_allowed`, `transfer_allowed`, `first_purchase_only` | `primary`, `offline`, `flag`, `disabled`, `not_active` |
| Enum column | `snake_case` noun | named enum type | `status`, `denial_reason`, `entry_type`, `funding_source`, `entity_type` | `status_code`, `type` alone, `state` |
| Count | `<noun>_count` | `int` | `rating_count`, `redemption_count`, `sessions_used`, `attempts` | `num_ratings`, `ratings`, `cnt` |
| Duration | `<noun>_<unit>` | `int` | `duration_minutes`, `freeze_max_days`, `settlement_cycle_days`, `window_days`, `fy_start_month` | `duration`, `freeze_limit`, `interval` |
| JSONB snapshot | `<name>_snapshot` | `jsonb` | `refund_policy_snapshot`, `tax_snapshot`, `tenant_snapshot`, `customer_snapshot` | `data`, `meta`, `json1`, `payload` where it freezes state |
| JSONB open shape | `<name>` | `jsonb` | `purchased_terms`, `access_window`, `renditions`, `computation`, `tax_breakdown`, `edit_history` | `extra`, `attributes`, `props` |
| Array | `<noun>s` plural | `<type>[]` | `reason_codes`, `applicable_plan_ids`, `target_tenant_ids` | `reason_code_list`, `plan_ids_arr` |
| Geography | `location` | `geography(Point,4326)` | `location` | `geo`, `latlng`, `coords`, `point` |
| External identifier | `provider_<noun>_id` / `<system>_<noun>_id` | `text` | `provider_intent_id`, `provider_charge_id`, `provider_event_id`, `provider_refund_id`, `dlt_template_id` | `external_id`, `stripe_id`, `razorpay_ref` |
| Free text reason | `<context>_reason` / `reason_text` | `text` | `override_reason`, `failure_message`, `reason_text` | `notes` where it is structured, `comment` |
| Sort position | `sort_order` | `int` | `sort_order` | `order` (**reserved word**, §22), `position`, `seq` |
| Soft delete | `deleted_at` | `timestamptz null` | `deleted_at` | `is_deleted`, `active`, `archived` (see below) |
| Audit quartet | fixed | — | `created_at`, `updated_at`, `created_by`, `updated_by` | omitting any of the four (`NFR-DQ-05`) |
| Tenancy key | `tenant_id` | `uuid not null` | `tenant_id` | `org_id`, `account_id`, `owner_id` |

**`archived` is not a soft delete and must not be spelled like one.** `plans` uses
`status = 'ARCHIVED'` (`BR-PLN-04`, `SD3`) *and* carries `deleted_at`. They mean different things: an
archived plan is a live business object that can no longer be sold; a soft-deleted plan is gone.
`SD3` requires domain vocabulary where the PRD supplies it, so the enum value is `ARCHIVED` and the
column is still `deleted_at`.

### 5.3 The money convention, stated as law

> **A monetary column is `bigint`, named `<name>_minor`, and there is a `currency char(3)` column on
> the same row. There are no exceptions, in any table, in any JSONB snapshot, in any report.**

| Rule | Statement | Source |
| :--- | :--- | :--- |
| **M1** | `_minor` means *"an integer count of the currency's minor unit"*. For India that is **paise**, 100 per rupee | `BR-PAY-01`, `LAUNCH_MARKET_INDIA.md` §2 |
| **M2** | The suffix is `_minor` and never the unit name. `price_paise` is **wrong** — it hardcodes India into a column name on a platform that `OBJ-09` requires to be country-agnostic, and it becomes a lie the day a second currency appears | `OBJ-09`, `ADR-0028` |
| **M3** | The adjacent currency column is `currency char(3)`, ISO-4217, upper case, on the **same table**. One `currency` per row serves every `_minor` column on that row; a row never mixes currencies | `NFR-DQ-02`, `MO2` |
| **M4** | `numeric`, `decimal`, `real`, `double precision` and PostgreSQL's `money` type are forbidden for a monetary value. CI check **L7** (§28) scans `information_schema.columns` for `%_minor` with a non-`bigint` type and for any column of type `money` | `DB2`, `MO6` |
| **M5** | Inside a JSONB snapshot the same convention holds, with the integer serialised as a **JSON string** so it survives `JSON.parse` | `ERD.md` §9.7 `S6` |
| **M6** | A column that is a money **rate** is `_bps`, not `_minor`. A column that is a money **cap** is still `_minor`: `max_discount_minor` | `R1` |

**The nine figures of `A6.3` + `ERD.md` §12.4, spelled exactly:** `gross_minor`, `discount_minor`,
`net_minor`, `tax_minor`, `commission_base_minor`, `commission_minor`, `commission_tax_minor`
*(pending `OI-5`)*, `gateway_fee_minor`, `payable_to_gym_minor` — plus `total_minor` on `orders`.
These ten names appear on `orders` and on `settlement_lines` **identically**, because `BR-FIN-02`
requires the settlement line to carry the same figures and a divergent name would make the
reconciliation query a mapping exercise.

| Good | Bad | Why |
| :--- | :--- | :--- |
| `commission_tax_minor bigint`, `currency char(3)` | `commission_gst_minor` | `GST` is India-specific; the ledger entry type is `COMMISSION_TAX` and the column must match it |
| `max_discount_minor` | `max_discount`, `discount_cap` | No unit; no `_minor` |
| `reserve_bps int` | `reserve_rate numeric(5,4)`, `reserve_pct` | `R3`: a rate is never a decimal fraction |
| `opening_balance_minor` | `opening_balance` | Every figure on a statement is money and is suffixed |

### 5.4 The timestamp convention

> **An instant is `timestamptz`, stored UTC, and its column name ends in `_at`. A calendar date that
> carries business meaning is `date` and its name ends in `_date` or is a bare period noun.**

| Rule | Statement | Source |
| :--- | :--- | :--- |
| **TS1** | `timestamp without time zone` is forbidden anywhere in the schema | `DB6` |
| **TS2** | `_at` columns are named with a **past participle**: `created_at`, `issued_at`, `published_at`, `checked_in_at`, `resolved_at`, `redeemed_at`, `attributed_at`. Not `create_at`, not `checkin_at` |
| **TS3** | A future-dated instant uses `_due_at` or `_expires_at`: `evidence_due_at`, `expires_at`, `url_expires_at`, `featured_until`. `_until` is permitted where the PRD uses it and the value is an exclusive bound |
| **TS4** | `date` columns interpret in an explicitly stored timezone. `tenants.timezone` (IANA) is authoritative for membership validity | `BR-MEM-03`, `TM3`, `ADR-0025` |
| **TS5** | A timezone column is named `timezone` and holds an IANA identifier — `Asia/Kolkata`, never `IST`, never `+05:30`. An abbreviation is ambiguous (`IST` is also Irish and Israel Standard Time) and a fixed offset cannot survive a DST-observing market | `LAUNCH_MARKET_INDIA.md` §3 |
| **TS6** | A financial-year label is `financial_year text` holding the printed form `'2026-27'`, **not** an integer year. A stored `2026` is ambiguous on 31 March | `ERD.md` §12.6 |
| **TS7** | The FY start month is `fy_start_month smallint` on `tax_profiles` — configuration, never a constant. India = `4` | `OBJ-09`, `LAUNCH_MARKET_INDIA.md` §5 |

| Good | Bad | Why |
| :--- | :--- | :--- |
| `checked_in_at timestamptz`, `checked_out_at timestamptz` | `checkin_time`, `check_in`, `entry_ts` | TS2 |
| `start_date date`, `end_date date` | `start_at`, `valid_from timestamptz` | `BR-MEM-03` computes validity in the **gym's** timezone from calendar dates; an instant would fix the boundary in UTC and expire an Indian membership at 18:30 IST |
| `period_start date`, `period_end date` | `period_start_date` | The period nouns are already dates; the suffix is redundant and `§C2.2` names them bare |
| `timezone text` = `'Asia/Kolkata'` | `tz` = `'IST'`, `utc_offset` = `330` | TS5 |
| `financial_year text` = `'2026-27'` | `financial_year int` = `2026`, `fy` | TS6 |

### 5.5 The boolean convention

> **A boolean column begins with `is_`, `has_`, `allows_`, or ends with `_allowed` / `_only`, and is
> always phrased affirmatively.**

| Rule | Statement |
| :--- | :--- |
| **B1** | Never a negative name. `is_active`, never `is_inactive`; `freeze_allowed`, never `freeze_disabled`. A `NOT is_disabled` predicate is where reading bugs live |
| **B2** | Never a bare adjective or noun: `primary`, `offline`, `flag`, `enabled` |
| **B3** | Where the PRD names the field, the PRD's name wins even if it does not begin with `is_`: `§C2.2` gives `freeze_allowed`, `transfer_allowed`, `stackable`, `first_purchase_only`, `is_primary`, `is_offline`, `is_closed`, `is_cover`, `auto_renew`. All are accepted; `stackable` and `auto_renew` are the two grandfathered bare adjectives and are recorded in the lint fixture |
| **B4** | A boolean that is really a state machine is an **enum**, not a boolean. `status` is never `is_approved` + `is_suspended` + `is_closed` |
| **B5** | A nullable boolean is a three-state value in disguise and requires a written justification. There are **none** in this schema |

| Good | Bad | Why |
| :--- | :--- | :--- |
| `is_primary`, `is_offline`, `is_closed`, `is_cover`, `is_default` | `primary`, `offline`, `closed`, `cover`, `default` (**reserved word**) | B2, §22 |
| `freeze_allowed`, `transfer_allowed`, `first_purchase_only` | `no_freeze`, `disable_transfer`, `not_first_only` | B1 |
| `has_balance_due` | `balance_due boolean` | Ambiguous with a money column named `balance_due_minor` |
| `status membership_status_enum` | `is_active` + `is_frozen` + `is_expired` | B4; `INV-MEM-1` requires *exactly one of six states* |

### 5.6 The id convention

| Rule | Statement | Source |
| :--- | :--- | :--- |
| **ID1** | Every table's primary key is a single column named `id` of type `uuid`. Never `<table>_id`, never `pk`, never composite — with the two partitioned exceptions of §15 | §8.6, `§C2.2` |
| **ID2** | Values are **UUIDv7** — time-ordered, so B-tree inserts stay right-most and partition pruning by id stays meaningful | `ERD.md` §1.1, §11.5 |
| **ID3** | Sequential integer surrogate keys are forbidden: they leak per-tenant volume across tenants | `PROJECT_CONSTITUTION.md` §15.8 rule 2 |
| **ID4** | A foreign key is `<referenced_table_singular>_id`. Where a child holds several FKs to one parent, the column carries a **role prefix**, not a numeric suffix: `held_in_batch_id`, `released_in_batch_id`, `referrer_user_id`, `referee_user_id`, `original_invoice_id`, `preceded_by_token_id` |
| **ID5** | A human-facing identifier is **not** `id`. It is `<subject>_code`, `<subject>_ref` or `<subject>_number`, is `text`, and carries its own unique constraint: `membership_code`, `order_ref`, `invoice_number`, `payout_reference` |
| **ID6** | An external system's identifier is `provider_<noun>_id` or `<system>_<noun>_id` and is `text`, never `uuid` — the provider's format is not ours to assume |

| Good | Bad | Why |
| :--- | :--- | :--- |
| `id uuid` on `memberships` | `membership_id uuid` as the PK of `memberships` | ID1; the FK on children is `membership_id`, so a self-named PK makes every join read `m.membership_id = a.membership_id` and hides which side is which |
| `held_in_batch_id`, `released_in_batch_id` | `batch_id_1`, `batch_id_2` | N5, ID4 |
| `invoice_number text` + `uq_invoices__tenant_id_financial_year_invoice_number` | `invoice_id int` | `FR-INV-02` requires gapless per tenant per FY; a global integer is neither |
| `provider_event_id text` | `event_uuid uuid` | ID6; the provider chooses the format |

---

## 6. Primary keys

| Rule | Pattern | Good | Bad |
| :--- | :--- | :--- | :--- |
| Constraint name | `pk_<table>` | `pk_settlement_lines`, `pk_memberships` | `settlement_lines_pkey`, `settlement_lines_pkey1`, `PK_SettlementLines` |
| Column | `id uuid` | `id` | `membership_id`, `rowid` |
| Partitioned table | `pk_<table>` on `(<partition_key>, id)` | `pk_attendance` on `(checked_in_at, id)`; `pk_audit_log` on `(occurred_at, id)` | `pk_attendance` on `(id)` — PostgreSQL rejects it |

`settlement_lines_pkey` is what PostgreSQL and Prisma both generate by default. It is rejected on
sight: it is inconsistent with `fk_`/`uq_`/`ck_`, it collides under truncation with
`settlement_lines_pkey1` when a table is rebuilt, and it cannot be grepped alongside the other
constraint families. Every Prisma `@@id` therefore carries an explicit `map:` (§21).

---

## 7. Foreign keys

| Rule | Pattern | Good | Bad |
| :--- | :--- | :--- | :--- |
| Unambiguous | `fk_<child>__<parent>` | `fk_memberships__plans`, `fk_settlement_lines__ledger_entries` | `fk1`, `memberships_plan_id_fkey`, `fk_plans__memberships` (direction inverted) |
| Child holds >1 FK to the same parent | `fk_<child>__<parent>__<role>` | `fk_reserves__settlement_batches__held_in`, `fk_referrals__users__referrer`, `fk_review_reports__users__reporter` | `fk_reserves__settlement_batches_2`, `fk_referrals__users_a` |
| Self-reference | `fk_<table>__<table>__<role>`, or `fk_<table>__self__<role>` when the doubled name breaks the 63-byte budget | `fk_gyms__gyms__parent`, `fk_memberships__memberships__renewed_from`, `fk_notif_templates__self__supersedes` | `fk_gyms__parent`, `fk_gyms_self` |
| Composite tenant FK | Same name; the composite-ness is in the column list, not the name | `fk_memberships__gyms` on `(tenant_id, gym_id)` | `fk_memberships__gyms__composite`, `fk_memberships__gyms__tenant_gym` |

**`<role>` derivation.** Take the child column name, strip the trailing `_id`, strip any leading copy
of the parent table's singular name. `reserves.held_in_batch_id` → `held_in`.
`referrals.referrer_user_id` → `referrer`. `credit_notes.original_invoice_id` → `original`.

**Direction is always child-then-parent.** `fk_memberships__plans` reads *"the memberships table's
foreign key to plans"*. Reversing it makes `pg_constraint` unsortable by owning table, which is the
one grouping an on-call engineer needs at 03:00.

`Relationships.md` §1.1 and §4 hold the full 162-constraint register; this section holds only the
grammar.

---

## 8. Unique constraints and unique indexes

| Rule | Pattern | Good | Bad |
| :--- | :--- | :--- | :--- |
| Unique constraint / index | `uq_<table>__<col1>_<col2>…` | `uq_orders__idempotency_key`, `uq_payment_events__provider_event_id`, `uq_invoices__tenant_id_financial_year_invoice_number` | `orders_unique`, `uq1`, `orders_idempotency_key_key` |
| Partial unique (the soft-delete form, `SD7`) | `uq_<table>__<cols>__<predicate>` | `uq_plans__tenant_id_code__active`, `uq_user_roles__platform_scoped`, `uq_credit_notes__refund_id` | `uq_plans__tenant_id_code_partial`, `uq_plans__tenant_id_code_where_deleted_at_is_null` |
| The composite-FK referent | `uq_<table>__tenant_id_id` | `uq_gyms__tenant_id_id`, `uq_orders__tenant_id_id` | `uq_gyms__composite`, `gyms_tenant_id_id_key` |
| Predicate suffix vocabulary | A **closed** set: `__active`, `__approved`, `__published`, `__primary`, `__current`, `__pending`, `__platform_scoped`, `__tenant_scoped`, `__not_deleted` | `uq_branches__gym_id__primary` | `__filter1`, `__cond` |

**Tenant-prefix law.** `ERD.md` §5.4 is binding: *"Every other unique constraint in the schema is
`(tenant_id, …)`-prefixed"* except two named exceptions. The naming follows the columns, so the
prefix is visible in the name and the CI lint (**L4**, §28) can check both at once:

| Good | Bad | Why |
| :--- | :--- | :--- |
| `uq_memberships__tenant_id_membership_code` | `uq_memberships__membership_code` | A global unique on an RLS table leaks another tenant's row through a constraint-violation error |
| `uq_orders__idempotency_key` (**named exception**) | — | `BR-PAY-03`: the interceptor runs before tenant resolution; `ERD.md` §5.4 justifies it |
| `uq_payment_events__provider_event_id` (**named exception**) | — | `BR-PAY-05`: the webhook carries the provider event id and nothing else |

**`UNIQUE NULLS NOT DISTINCT` is not used.** PostgreSQL 15+ supports it, and it would collapse
`Relationships.md` §9.2's two `user_roles` indexes into one. It is refused because the partial form
also carries the `SD7` soft-delete predicate, and one index expressing two different mechanisms is
harder to read than two indexes with explicit `WHERE` clauses.

---

## 9. Check constraints

| Rule | Pattern | Good | Bad |
| :--- | :--- | :--- | :--- |
| Name | `ck_<table>__<rule_in_words>` | `ck_orders__net_equals_gross_minus_discount`, `ck_ledger_entries__amount_non_negative`, `ck_attendance__denial_reason_required_when_denied` | `ck_orders_1`, `orders_check`, `ck_orders__chk` |
| The rule fragment | A **predicate read as a positive assertion**, in words, not in operators | `ck_gyms__no_parent_in_phase_1`, `ck_coupons__platform_scope_no_targets`, `ck_review_reports__one_reporter` | `ck_gyms__parent_gym_id_is_null` (restates the SQL, adds nothing), `ck_gyms__cc1` |
| Currency pairing | `ck_<table>__currency_matches_<parent>` where a child's currency must equal its parent's | `ck_order_items__currency_matches_order` | `ck_order_items__currency` |
| India tax identity | Named for the identifier, not the regex | `ck_tenants__pan_format`, `ck_tenants__gstin_format`, `ck_tenants__gstin_embeds_pan`, `ck_tenants__state_code_matches_gstin` | `ck_tenants__regex1`, `ck_tenants__india_check` |

**The India constraints, spelled out**, because they are the ones a reviewer will most want to find
by name:

| Constraint | Asserts | Source |
| :--- | :--- | :--- |
| `ck_tenants__pan_format` | `pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'` | `LAUNCH_MARKET_INDIA.md` §6 item 1 |
| `ck_tenants__pan_entity_type_agrees` | The 4th PAN character agrees with `entity_type` | `ERD.md` §12.3 |
| `ck_tenants__gstin_format` | 15 characters, `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$` | `LAUNCH_MARKET_INDIA.md` §6 item 2 |
| `ck_tenants__gstin_embeds_pan` | `substring(gstin, 3, 10) = pan` when both are present | `ERD.md` §12.3 |
| `ck_tenants__state_code_matches_gstin` | `state_code = substring(gstin, 1, 2)` when `gstin` is present | Drives intra-state vs inter-state |
| `ck_invoices__tax_components_sum_to_tax` | `SUM(tax_breakdown[].amount_minor) = orders.tax_minor` — asserted at issuance, blocks the invoice on mismatch | `ERD.md` §12.3 |
| `ck_tax_profiles__fy_start_month_valid` | `fy_start_month BETWEEN 1 AND 12` | `OBJ-09` |

**A check constraint is never named after the error it prevents.** `ck_orders__no_negative_payable`
is worse than `ck_orders__payable_non_negative`, because the constraint asserts a positive fact and
the error message quotes the constraint name back to the reader.

---

## 10. Exclusion constraints

| Rule | Pattern | Good | Bad |
| :--- | :--- | :--- | :--- |
| Name | `ex_<table>__<rule_in_words>` | `ex_branch_hours__no_overlap_per_weekday`, `ex_plans__one_active_promotion` | `plans_excl`, `ex_plans_1` |

Two exist in Phase 1:

| Constraint | Shape | Rule |
| :--- | :--- | :--- |
| `ex_branch_hours__no_overlap_per_weekday` | `EXCLUDE USING gist (branch_id WITH =, weekday WITH =, timerange(opens_at, closes_at) WITH &&)` | `ERD.md` §7.4 — split hours are legal, overlapping hours are not |
| `ex_plans__one_active_promotion` | `EXCLUDE USING gist (plan_id WITH =, tstzrange(promo_starts_at, promo_ends_at) WITH &&) WHERE (promo_price_minor IS NOT NULL)` | `BR-PLN-07` — at most one active promotion per plan |

Both require `btree_gist`, installed into the `extensions` schema (§3.1).

---

## 11. Indexes

| Kind | Pattern | Good | Bad |
| :--- | :--- | :--- | :--- |
| B-tree | `idx_<table>__<col1>_<col2>…` | `idx_memberships__tenant_id_status_end_date`, `idx_orders__tenant_id_status_created_at` | `memberships_idx`, `idx1`, `idx_memberships_all` |
| Unique | `uq_…` (§8) — never `idx_` | `uq_reviews__membership_id` | `idx_reviews__membership_id_unique` |
| Partial | `idx_<table>__<cols>__<predicate>` | `idx_gyms__status_rating_avg__approved`, `idx_ledger_entries__tenant_id_occurred_at__unbatched` | `idx_gyms__partial`, `idx_gyms__status_rating_avg_where_approved` |
| Expression | `idx_<table>__<expression_in_words>` | `idx_gyms__lower_name`, `idx_tenants__lower_registration_number`, `idx_invoices__issued_at_date_ist` | `idx_gyms__expr`, `idx_gyms__lower_name_text_pattern_ops_v2` |
| GiST / spatial | `gix_<table>__<col>` | `gix_branches__location` | `branches_geo`, `idx_branches__location` |
| GiST / range (exclusion backing) | `gix_<table>__<cols>` | `gix_branch_hours__branch_id_weekday_range` | — |
| GIN — full text | `gin_<table>__<col>` | `gin_search_documents__search_vector` | `gyms_fts`, `idx_gyms__tsv` |
| GIN — trigram | `gin_<table>__<col>_trgm` | `gin_search_documents__name_trgm`, `gin_search_documents__locality_trgm` | `gin_gyms__name` (loses that it is trigram, and trigram and FTS on the same column are different indexes) |
| GIN — JSONB / array | `gin_<table>__<col>` | `gin_coupons__applicable_plan_ids`, `gin_audit_log__before` | `idx_coupons__plans_json` |
| BRIN | `brn_<table>__<col>` | `brn_ledger_entries__occurred_at` | `idx_ledger_entries__occurred_at_brin` |
| Covering (`INCLUDE`) | `idx_<table>__<key_cols>__covering` | `idx_memberships__tenant_id_status__covering` | `idx_memberships__tenant_id_status_include_end_date` |
| Sort direction | Encoded only when it is **not** the default | `idx_attendance__membership_id_checked_in_at_desc`, `idx_reviews__gym_id_status_published_at_desc` | `idx_reviews__gym_id_status_published_at` when the index is actually `DESC` |

**Rules that go with the names.**

| # | Rule |
| :-: | :--- |
| **IX1** | Column order in the name matches column order in the index, exactly. A name that lists columns in a different order than the definition is worse than no name |
| **IX2** | Every index is created for a **named query** (`PROJECT_CONSTITUTION.md` §15.1). `Schema.md` records the query beside the index; an index with no query is dead or undocumented, and both are defects |
| **IX3** | On an RLS table, the index leads with `tenant_id` unless there is a written reason not to. The policy predicate is always present, so a non-leading `tenant_id` wastes the index (`Relationships.md` §12.2, and §12.4 for the one deliberate inversion) |
| **IX4** | Indexes on a partitioned parent are declared on the **parent** so PostgreSQL propagates them; per-partition index names are generated by PostgreSQL as `<partition>_<cols>_idx` and are **exempt** from this convention, because they are not ours to name |
| **IX5** | `CREATE INDEX CONCURRENTLY` on any populated table, outside the migration transaction (`MG4`) |
| **IX6** | The predicate suffix vocabulary of §8 applies unchanged to partial indexes |

---

## 12. Enum types and enum values

| Rule | Pattern | Good | Bad |
| :--- | :--- | :--- | :--- |
| Type name | `snake_case` **singular** + `_enum` | `membership_status_enum`, `check_in_denial_reason_enum`, `ledger_entry_type_enum`, `dlt_approval_status_enum` | `MembershipStatus`, `statuses`, `membership_status`, `enum_membership_status` |
| Values | `SCREAMING_SNAKE_CASE`, matching the PRD verbatim | `PENDING_REVIEW`, `OUTSIDE_PLAN_ACCESS_WINDOW`, `COMMISSION_TAX_REVERSAL`, `PENDING_DLT_APPROVAL` | `pending_review`, `PendingReview`, `pending-review` |
| Column holding it | The concept, not the type | `status`, `denial_reason`, `entry_type` | `membership_status_enum`, `status_enum` |

**Why `_enum` on the type but not the column.** The type and the column live in different namespaces
and are read in different places. `status membership_status_enum` reads naturally in DDL and in
`\d memberships`; `status_enum membership_status_enum` is a stutter. The suffix on the type exists so
that `\dT` output is scannable and so that a type never collides with a table name — `plan_type` the
column, `plan_type_enum` the type, and no table called `plan_type`.

**Enum evolution.** `MG9`: values are **added**, never removed while any row holds them, and never
renamed. A renamed value is a silent data corruption for every consumer that switched on the old
string. The India-driven additions are the model:

| Addition | Type | Trigger | Status |
| :--- | :--- | :--- | :--- |
| `COMMISSION_TAX`, `COMMISSION_TAX_REVERSAL` | `ledger_entry_type_enum` | `ERD.md` §12.4 GST on commission | **PENDING CLIENT DECISION** (`OI-5`) |
| `TCS_COLLECTED`, `TDS_WITHHELD` | `ledger_entry_type_enum` | `ERD.md` §12.7 | Seam only; requires a tax advisor |
| `NOT_REGISTERED`, `REGISTERED`, `COMPOSITION`, `PENDING` | `tax_registration_status_enum` | `ERD.md` §12.3 | Adopted |
| `NOT_REQUIRED`, `PENDING_DLT_APPROVAL`, `APPROVED`, `REJECTED` | `dlt_approval_status_enum` | `ERD.md` §12.5, TRAI DLT | Adopted |
| `TRANSACTIONAL`, `PROMOTIONAL` | `notification_routing_class_enum` | `ERD.md` §12.5 | Adopted |

**Native enum, not a lookup table, and not `text` + `CHECK`.** A native `CREATE TYPE … AS ENUM` gives
a compile-time-checkable Prisma enum, a 4-byte on-disk representation, and a hard failure on an
unknown value. A lookup table would give configurability that `C4.8` explicitly does not want — the
denial-reason taxonomy is fixed at fifteen values and `PROJECT_CONSTITUTION.md` §13.5 makes them part
of a **200** response contract. `reason_codes` is the *one* vocabulary that is a table, because
`FR-ADMN-05` requires Super Admin to add and retire codes without a deployment.

---

## 13. Sequences

| Rule | Pattern | Good | Bad |
| :--- | :--- | :--- | :--- |
| Name | `seq_<table>__<purpose>` | `seq_export_jobs__batch_ordinal` | `invoice_seq`, `export_jobs_id_seq` |

**There are almost none, and the absence is the design.**

| Would-be sequence | Why it does not exist |
| :--- | :--- |
| Primary keys | `id` is UUIDv7 (`ID2`, `ID3`). No table has a serial or identity column |
| `invoices.invoice_number` | `FR-INV-02` requires **gapless** numbering per tenant per financial year. A PostgreSQL `SEQUENCE` is non-transactional: `nextval()` is not rolled back, so a failed transaction leaves a permanent gap. `ERD.md` §12.6 rules a **row-locked counter table** instead, keyed `(tenant_id, financial_year)`, allocated inside the issuing transaction, with `AC-INV-01.2`'s reuse-or-documented-void rule on post-allocation failure |
| `credit_notes.credit_note_number` | Same rule, its own counter row |
| `subscription_invoices.invoice_number` | Same rule, its own counter row |
| `order_ref`, `membership_code` | Human-facing but **not** required to be gapless. Generated from a UUIDv7-derived base-32 string with a check character, so they carry no volume signal (`ID3`) |

The counter table is `document_number_counters`, keyed
`uq_document_number_counters__tenant_id_document_type_financial_year`, and the allocation is
`SELECT … FOR UPDATE` on that one row. `GRANT USAGE ON ALL SEQUENCES` in `ERD.md` §10.3's grant
sketch is therefore a near-empty grant retained for future-proofing.

---

## 14. Partitions

| Rule | Pattern | Good | Bad |
| :--- | :--- | :--- | :--- |
| Monthly partition | `<table>_y<YYYY>m<MM>` | `attendance_y2026m08`, `audit_log_y2026m11` | `attendance_2026_11`, `attendance_aug`, `attendance_p1`, `attendance_202611` |
| Daily partition (if ever) | `<table>_y<YYYY>m<MM>d<DD>` | `outbox_y2026m08d06` | `outbox_20260806` |
| Default partition | `<table>_default` | `attendance_default` | `attendance_catchall` |

`PROJECT_CONSTITUTION.md` §8.7 fixes `<table>_y<YYYY>m<MM>` and it wins. **`ERD.md` §11.4's
illustrative `attendance_2026_11` is off-pattern and is a defect in that document** — recorded as
`Relationships.md` open item and corrected here. `MM` is zero-padded; `attendance_y2026m8` would sort
after `attendance_y2026m10` in every `\dt` listing and every `pg_class` scan.

**The `y`/`m` letters are not decoration.** `attendance_202611` is ambiguous with a partition keyed by
a six-digit tenant ordinal, and `attendance_2026_11` is ambiguous with a table version suffix. The
letters make the partition scheme self-describing in a directory listing of 84 audit partitions.

**Default partitions:** `ERD.md` §11.2 rules **no** default partition on `attendance`;
`Scalability.md` §5.7.3 rules that a default exists on both and must always be empty. The two
conflict; `Relationships.md` §16 does not resolve it and neither does this document — it is a
behaviour question, not a naming one. The **name** is fixed either way.

---

## 15. Partitioned-table primary keys

Two tables, and the naming interacts with the constraint:

| Table | PK constraint | Columns | Note |
| :--- | :--- | :--- | :--- |
| `attendance` | `pk_attendance` | `(checked_in_at, id)` | The partition key must be in every unique constraint. `ERD.md` §11.2 gives this order; `Scalability.md` §5.7.2 gives `(id, checked_in_at)` — an unresolved conflict, `Relationships.md` `OI-7` |
| `audit_log` | `pk_audit_log` | `(occurred_at, id)` | Same rule |

The **token-nonce** index on `attendance` is `uq_attendance__checked_in_at_token_nonce`, not
`uq_attendance__token_nonce`, because the partition key must be included — and the name must say so,
or a reader will believe a global uniqueness guarantee that does not exist (`ERD.md` §11.2).

---

## 16. Views and materialised views

| Rule | Pattern | Good | Bad |
| :--- | :--- | :--- | :--- |
| View | `vw_<subject>` | `vw_tenant_balance`, `vw_membership_current_state` | `tenant_balance_view`, `v_balance`, `balances` |
| Materialised view | `mvw_<subject>` | `mvw_search_documents`, `mvw_platform_daily_metrics` | `search_documents_mv`, `mv_search` |
| Index on a materialised view | Same rules as a table | `gin_mvw_search_documents__name_trgm`, `gix_mvw_search_documents__location` | `search_idx` |
| Unique index required for `REFRESH … CONCURRENTLY` | `uq_mvw_<subject>__<col>` | `uq_mvw_search_documents__gym_id` | — |

**Why the prefix.** A view and a table are interchangeable in a `FROM` clause and are not
interchangeable in a `WHERE tenant_id = …` conversation: **a view does not inherit RLS from its base
tables unless it is created `WITH (security_invoker = true)`**. A reader must be able to tell, from
the name alone in a code review diff, that they are looking at an object whose isolation properties
need checking. `PROJECT_CONSTITUTION.md` §8 does not cover views; this is the extension, and it
carries a matching rule:

> **Every view over a tenant-owned table is created `WITH (security_invoker = true)`.** Without it the
> view executes with the *definer's* privileges and the base table's RLS policy is evaluated against
> the definer — which is `app_migrator`, the table owner. That is a cross-tenant read primitive with
> a view's name on it. CI check **L9** (§28) asserts `reloptions` contains `security_invoker=true` for
> every view whose dependency graph reaches a table with a `tenant_id` column.

`mvw_search_documents` is the exception and it is deliberate: it is a **public** projection of
`APPROVED` gyms only (`Scalability.md` §5.4, `ADR-0007`), holds no tenant-private data, and is read by
`PublicPrismaService` with no tenant context. It is listed in the RLS-exemption register in
`Schema.md` alongside the eleven `§C2.3` reference tables.

---

## 17. Functions and procedures

| Rule | Pattern | Good | Bad |
| :--- | :--- | :--- | :--- |
| Trigger function | `fn_<table>__<what_it_enforces>` | `fn_orders__freeze_money_after_paid`, `fn_memberships__freeze_purchased_terms`, `fn_orders__validate_coupon_scope` | `trg_func1`, `check_order`, `orders_trigger_fn` |
| Utility function | `fn_<verb>_<noun>` | `fn_allocate_document_number`, `fn_resolve_financial_year` | `get_number`, `doit` |
| Maintenance function | `fn_maintain_<subject>` | `fn_maintain_partitions` | `maintenance` |

| # | Rule |
| :-: | :--- |
| **F1** | Every function declares `LANGUAGE plpgsql` (or `sql`) **and** a volatility category explicitly: `IMMUTABLE`, `STABLE` or `VOLATILE`. The default is `VOLATILE`, which silently disables expression-index use |
| **F2** | Every function sets `SET search_path = pg_catalog, public, extensions`. A function without a pinned `search_path` is a privilege-escalation vector when it is `SECURITY DEFINER` |
| **F3** | **`SECURITY DEFINER` requires a written justification in `Schema.md`.** A definer function owned by `app_migrator` bypasses RLS on everything it touches. There are **zero** in Phase 1 |
| **F4** | A function never contains a business rule that the domain layer also contains. The only functions in Phase 1 are the three immutability triggers (`ERD.md` §10.4), the coupon-scope trigger (`Relationships.md` §3.4), and partition maintenance |

---

## 18. Triggers

| Rule | Pattern | Good | Bad |
| :--- | :--- | :--- | :--- |
| Name | `trg_<table>__<timing>_<event>__<purpose>` | `trg_orders__before_update__freeze_money`, `trg_memberships__before_update__freeze_terms`, `trg_settlement_batches__before_update__freeze_after_locked` | `orders_trigger`, `trg1`, `trg_orders` |
| `<timing>` | `before` \| `after` \| `instead_of` | `before` | `b`, `pre` |
| `<event>` | `insert` \| `update` \| `delete` \| `insert_update` | `update` | `upd`, `u` |

| # | Rule |
| :-: | :--- |
| **TR1** | Triggers exist **only** where a grant or a constraint cannot express the rule (`ERD.md` §10.2, §10.4). The four in Phase 1 are named above plus `trg_orders__before_insert__validate_coupon_scope` |
| **TR2** | `updated_at` is **not** maintained by a trigger. `AC3`: the application maintains it through the Prisma extension so a bulk job's updates stay attributable to that job |
| **TR3** | Every trigger raises with a **stable error code** via `RAISE EXCEPTION USING ERRCODE = 'GM001'`, mapped by `§C1.5`'s error model, so the message never leaks SQL |
| **TR4** | Every trigger has a paired negative test (`BAC-06`) that attempts the forbidden write and asserts the exception |

---

## 19. Roles

**This section resolves a live inconsistency.** Four documents name the database roles four different
ways:

| Source | Names used |
| :--- | :--- |
| `DECISION_LOG.md` ADR-0004 implementation notes | `app_rw`, `app_platform`, `app_migrate` |
| `engineering/Security.md` §4.5 | `app_rw`, `app_platform_ro`, `app_append`, `app_migrator` |
| `engineering/Monitoring.md` | `app_rw`, `app_ro`, `app_audit`, `app_platform` |
| `engineering/ERD.md` §10.3 | `gm_app`, `gm_platform`, `gm_audit_writer`, `gm_migrator` |

**Ruling.** `DECISION_LOG.md` outranks every `engineering/*` document (§Precedence), and `Security.md`
is the most complete of the four. The names are therefore the `app_` family, with `Security.md`'s
spellings adopted where `ADR-0004` is silent:

| Role | Purpose | Grants | `BYPASSRLS` |
| :--- | :--- | :--- | :---: |
| `app_rw` | API and worker request path | `SELECT`, `INSERT` everywhere; `UPDATE`/`DELETE` only where `ERD.md` §10.1 permits | **No** |
| `app_platform_ro` | The audited `runElevated()` elevation only | `SELECT` across tenants via a second policy | **No** |
| `app_append` | The audit interceptor's dedicated connection | `INSERT` on `audit_log` only | **No** |
| `app_migrator` | Prisma Migrate in CI/CD; owns every table | DDL + full DML; never present in a running app container | **No** (`Deployment.md` §863) |

| Rule | Statement |
| :--- | :--- |
| **RL1** | Pattern `app_<capability>`, lower snake, no product prefix. `gm_` is rejected: the cluster hosts one application, the prefix is noise, and four documents already use `app_` |
| **RL2** | The role name states the **capability**, not the consumer. `app_rw`, not `app_api`; the worker uses it too |
| **RL3** | `app_ro` in `Monitoring.md` is a **fifth** role that no other document grants. It is either `app_platform_ro` under another name or a genuine read-only observability role. Recorded as `Relationships.md` `OI-6`; this document does not invent it |
| **RL4** | No role is named `postgres`, `admin`, `root` or `gymmap`. Login roles are per-workload identities (`Deployment.md` `SEC-3`) named `svc_<workload>` — `svc_api`, `svc_worker`, `svc_migrator`, `svc_pdf` — which are `GRANT`ed membership of the capability roles above |
| **RL5** | Every capability role is `NOLOGIN`. Only `svc_*` roles log in |

| Good | Bad |
| :--- | :--- |
| `app_rw`, `app_platform_ro`, `app_append`, `app_migrator`, `svc_api` | `gm_app`, `app_api`, `readwrite`, `postgres`, `gymmap_user` |

---

## 20. RLS policies

| Rule | Pattern | Good | Bad |
| :--- | :--- | :--- | :--- |
| Tenant-isolation policy (the `app_rw` policy) | `rls_<table>__tenant_isolation` | `rls_memberships__tenant_isolation`, `rls_branch_hour_exceptions__tenant_isolation` | `policy1`, `tenant_policy`, `memberships_rls` |
| Platform read policy (the `app_platform_ro` policy) | `rls_<table>__platform_read` | `rls_memberships__platform_read` | `rls_memberships__admin`, `bypass_policy` |
| Hybrid-scope policy where the predicate is not the standard form | `rls_<table>__<what_it_admits>` | `rls_coupons__platform_or_tenant`, `rls_support_tickets__tenant_or_requester`, `rls_tenants__self` | `rls_coupons__tenant_isolation` (the name would lie — the predicate is not `tenant_id = …`) |
| Partition policy | Identical to the parent's name, on the partition | `rls_attendance_y2026m08__tenant_isolation` | `tenant_isolation` (`ERD.md` §11.4's illustrative name — off-pattern) |

`PROJECT_CONSTITUTION.md` §15.6 `RS1` fixes `rls_<table>__tenant_isolation` and states that the
`pg_policies` CI check *"greps for exactly this shape"* (`Security.md` §4.4). Three naming rules
follow from that being a **grep**, not a semantic check:

| # | Rule |
| :-: | :--- |
| **P1** | A table whose predicate is **not** `tenant_id = current_setting('app.tenant_id')::uuid` must **not** be named `__tenant_isolation`. Four tables qualify: `tenants` (`id = …`), `coupons` (`scope = 'PLATFORM' OR tenant_id = …`), `support_tickets` (`tenant_id IS NULL OR tenant_id = …`), `notification_log` (hybrid). Each carries a descriptive name **and** an entry in the checked-in policy-exception fixture, so the grep can assert *"every `tenant_id` table has either a `__tenant_isolation` policy or a fixture entry"* |
| **P2** | Every partition of `attendance` and `audit_log` carries its own policy under its own name. Policies are **not** inherited when a partition is addressed directly (`ERD.md` §11.4 guarantee 1), so `rls_attendance_y2026m08__tenant_isolation` must exist as a distinct object — and must be named so the check can find it by pattern rather than by enumeration |
| **P3** | The policy name never encodes the role. `TO app_rw` and `TO app_platform_ro` are in the definition; putting them in the name doubles the rename cost if `OI-6` changes a role name |

**The `app_rw` policy is always `FOR ALL` with a matching `WITH CHECK`.** One policy covering all four
verbs, because *"four separate policies is four opportunities to write one of them wrongly"*
(`Security.md` §4.4). The naming convention reflects that: there is no
`rls_memberships__tenant_isolation_select`.

---

## 21. Prisma model and field mapping

### 21.1 The law

> **The SQL name is the contract; the Prisma name is a TypeScript-idiomatic alias. Every Prisma
> identifier that differs from its SQL identifier carries an explicit `@map` / `@@map`, and every
> constraint and index carries an explicit `map:`.**

| Prisma object | Prisma name | SQL name | Mechanism |
| :--- | :--- | :--- | :--- |
| Model | `PascalCase` **singular** | `snake_case` **plural** | `@@map("settlement_batches")` |
| Scalar field | `camelCase` | `snake_case` | `@map("payable_to_gym_minor")` |
| Relation field | `camelCase`, singular for `1:1`/`n:1`, plural for `1:n` | *(no column)* | — |
| Enum | `PascalCase` singular | `snake_case` + `_enum` | `@@map("membership_status_enum")` |
| Enum value | `SCREAMING_SNAKE_CASE` | identical | `@map` only if they differ, which they never do |
| Primary key | — | `pk_<table>` | `@@id([id], map: "pk_memberships")` |
| Foreign key | — | `fk_<child>__<parent>` | `@relation(..., map: "fk_memberships__plans")` |
| Unique | — | `uq_<table>__<cols>` | `@@unique([...], map: "uq_...")` |
| Index | — | `idx_<table>__<cols>` | `@@index([...], map: "idx_...")` |

```prisma
// illustrative — not committed code
model SettlementLine {
  id                 String   @db.Uuid
  tenantId           String   @map("tenant_id")            @db.Uuid
  settlementBatchId  String   @map("settlement_batch_id")  @db.Uuid
  ledgerEntryId      String   @map("ledger_entry_id")      @db.Uuid
  grossMinor         BigInt   @map("gross_minor")
  discountMinor      BigInt   @map("discount_minor")
  netMinor           BigInt   @map("net_minor")
  taxMinor           BigInt   @map("tax_minor")
  commissionBaseMinor BigInt  @map("commission_base_minor")
  commissionMinor    BigInt   @map("commission_minor")
  commissionTaxMinor BigInt?  @map("commission_tax_minor")   // ERD.md §12.4 — PENDING CLIENT DECISION
  gatewayFeeMinor    BigInt?  @map("gateway_fee_minor")      // null until the provider reports (BR-FIN-06)
  payableToGymMinor  BigInt   @map("payable_to_gym_minor")
  currency           String   @db.Char(3)
  createdAt          DateTime @map("created_at")  @db.Timestamptz(6)
  updatedAt          DateTime @map("updated_at")  @db.Timestamptz(6)
  createdBy          String?  @map("created_by")  @db.Uuid
  updatedBy          String?  @map("updated_by")  @db.Uuid

  @@id([id], map: "pk_settlement_lines")
  @@unique([tenantId, id],       map: "uq_settlement_lines__tenant_id_id")
  @@unique([tenantId, ledgerEntryId], map: "uq_settlement_lines__ledger_entry_id")
  @@index([tenantId, settlementBatchId], map: "idx_settlement_lines__tenant_id_settlement_batch_id")
  @@map("settlement_lines")
}
```

### 21.2 Why the two names differ at all

The obvious alternative is to name the Prisma fields `snake_case` and drop every `@map`. It is
rejected for five reasons, in descending order of weight:

| # | Reason |
| :--- | :--- |
| **1** | `PROJECT_CONSTITUTION.md` §8.4 requires TypeScript variables to be `camelCase` and §8.3 requires types to be `PascalCase`. A `snake_case` Prisma field propagates into every domain object, every mapper and every test as a violation of the language convention the rest of the codebase follows |
| **2** | `§C3.1` fixes **JSON body and response fields as `snake_case`**. If the Prisma field were also `snake_case`, the mapper from persistence model to DTO would look like an identity function and developers would start returning Prisma objects directly from controllers — which leaks `deleted_at`, `created_by` and every internal column into the API |
| **3** | Prisma's own generated types are the ones autocomplete surfaces. `payableToGymMinor` reads correctly beside `Money.amountMinor`; `payable_to_gym_minor` does not |
| **4** | The `@map` is a **visible seam**. A developer editing `schema.prisma` sees the SQL name on the same line and cannot accidentally rename the column by renaming the field |
| **5** | Prisma's `camelCase` default for *generated* names is what produces `Membership_gym_id_fkey`. Making every name explicit is the only way to keep `pg_constraint` conformant to §7 |

### 21.3 The rules that make the mapping enforceable

| # | Rule |
| :-: | :--- |
| **PR1** | **`map:` is mandatory on every `@@id`, `@@unique`, `@@index` and `@relation`.** Prisma's defaults (`<table>_pkey`, `<table>_<col>_key`, `<table>_<col>_idx`, `<Model>_<field>_fkey`) violate §6–§11 in every case |
| **PR2** | **`@map` is mandatory on every field whose SQL name differs**, which is every multi-word field. A single-word field (`id`, `status`, `currency`, `slug`, `rating`, `body`) needs none |
| **PR3** | `@@map` is mandatory on every model, because every table is plural and every model is singular |
| **PR4** | Native type annotations are mandatory where Prisma's default is wrong for this schema: `@db.Uuid` (default is `text`), `@db.Char(3)` for `currency`, `@db.Timestamptz(6)` for every instant, `@db.Date` for every calendar date, `@db.SmallInt` for `fy_start_month` |
| **PR5** | Money is `BigInt` in Prisma, never `Int`, never `Decimal`, never `Float`. `Decimal` is the trap: it is *correct* arithmetically and *forbidden* by `BR-PAY-01`, and it would pass a naive review |
| **PR6** | PostGIS `geography(Point,4326)` has no Prisma type. `branches.location` is declared `Unsupported("geography(Point, 4326)")`, which Prisma preserves in migrations and refuses to select — correct, because every spatial read goes through the raw-SQL PostGIS repository (`P7`) |
| **PR7** | Implicit many-to-many relations are **banned**. They generate `_ModelAToModelB` with columns `A` and `B`, no audit columns, no `tenant_id` and no RLS policy (`Relationships.md` §13.3). CI check **L10** fails on any relation whose name matches `^_` |
| **PR8** | `@default(uuid())` is **not** used: it emits UUIDv4. Ids are UUIDv7 (`ID2`), generated in the application through a single `IdGenerator` port, so the value is known before the insert and can be returned by an idempotent handler without a round trip |

### 21.4 Field-name mapping table — the recurring cases

| SQL column | Prisma field | Note |
| :--- | :--- | :--- |
| `tenant_id` | `tenantId` | On every RLS model |
| `created_at` / `updated_at` / `created_by` / `updated_by` / `deleted_at` | `createdAt` / `updatedAt` / `createdBy` / `updatedBy` / `deletedAt` | `NFR-DQ-05`, `NFR-DQ-04` |
| `payable_to_gym_minor` | `payableToGymMinor` | `BigInt` |
| `commission_rate_bps` | `commissionRateBps` | `Int` — **not** `Bps` capitalised as `BPS`; §8.4's `camelCase` treats an acronym as a word |
| `is_primary` / `freeze_allowed` / `first_purchase_only` | `isPrimary` / `freezeAllowed` / `firstPurchaseOnly` | Booleans keep their affirmative phrasing |
| `checked_in_at` | `checkedInAt` | `DateTime @db.Timestamptz(6)` |
| `start_date` | `startDate` | `DateTime @db.Date` — Prisma has no date-only type, so the domain wraps it in a `BusinessDate` value object immediately |
| `gstin` / `pan` / `state_code` | `gstin` / `pan` / `stateCode` | Acronyms stay lower in SQL and in Prisma; `gSTIN` would be absurd |
| `financial_year` | `financialYear` | `String`, `'2026-27'` (§5.4 TS6) |
| `purchased_terms` / `tax_snapshot` | `purchasedTerms` / `taxSnapshot` | `Json` in Prisma, validated by the Zod schema named in `ERD.md` §9.7 `S2` |

---

## 22. Reserved words

PostgreSQL's reserved and non-reserved-but-problematic keywords must never be used unquoted, and §2
`N3` forbids quoting. The practical effect: these words are **banned as identifiers** anywhere in the
schema.

### 22.1 Hard-banned — PostgreSQL reserved

`all`, `analyse`, `analyze`, `and`, `any`, `array`, `as`, `asc`, `asymmetric`, `both`, `case`, `cast`,
`check`, `collate`, `column`, `constraint`, `create`, `current_catalog`, `current_date`,
`current_role`, `current_time`, `current_timestamp`, `current_user`, `default`, `deferrable`, `desc`,
`distinct`, `do`, `else`, `end`, `except`, `false`, `fetch`, `for`, `foreign`, `from`, `grant`,
`group`, `having`, `in`, `initially`, `intersect`, `into`, `lateral`, `leading`, `limit`, `localtime`,
`localtimestamp`, `not`, `null`, `offset`, `on`, `only`, `or`, `order`, `placing`, `primary`,
`references`, `returning`, `select`, `session_user`, `some`, `symmetric`, `table`, `then`, `to`,
`trailing`, `true`, `union`, `unique`, `user`, `using`, `variadic`, `when`, `where`, `window`, `with`

### 22.2 Soft-banned — legal but confusing

| Word | Why banned | Use instead |
| :--- | :--- | :--- |
| `order` | Reserved, **and** we have an `orders` table | `sort_order`, `order_ref` |
| `user` | Reserved, **and** we have a `users` table | `user_id`, `requested_by`, `actor_id` |
| `type` | Legal but meaningless alone | `entity_type`, `plan_type`, `entry_type`, `method` |
| `key` | Legal; collides with `_key` constraint suffixes | `idempotency_key`, `storage_key`, `template_key` |
| `value` | Legal; meaningless alone | `discount_value`, `duration_value` |
| `status` alone on a table with two lifecycles | — | `status` is fine where there is one lifecycle; use `moderation_status`, `subscription_status`, `dlt_approval_status`, `tax_registration_status` where there are several |
| `data`, `meta`, `info`, `payload`, `content`, `misc`, `temp`, `flag`, `state` | Say nothing. `PROJECT_CONSTITUTION.md` §15.8 rule 5 rejects a JSONB column used to avoid designing a schema, and these are its usual names | Name the actual shape: `renditions`, `computation`, `precheck_results`, `screening_result`, `edit_history`, `tax_breakdown`, `raw_payload` |
| `timestamp`, `date`, `time`, `interval` | Type names | `_at`, `_date` suffixes |
| `text`, `char`, `int`, `boolean`, `uuid`, `json`, `jsonb` | Type names | Name the concept |
| `id` as anything other than the primary key | Ambiguous | `<parent>_id` |
| `active`, `deleted`, `archived` as booleans | Collide with `deleted_at` and with `status` enums (`SD1`, `SD3`) | `deleted_at`, `status` |

`§C2.2` already contains one soft-banned name — `plans.status` is fine, but the PRD's prose refers to
a plan's `visibility` **and** `status`, which is the correct split and is retained. No table in this
schema uses a hard-banned word.

---

## 23. Abbreviation policy

> **Words are spelled out. The allowed-abbreviation list below is closed; adding to it is a change to
> this document, reviewed like any other.**

### 23.1 The allowed list — complete

| Abbrev. | Expansion | Where permitted | Example |
| :--- | :--- | :--- | :--- |
| `id` | identifier | Anywhere | `tenant_id` |
| `uuid` | universally unique identifier | Type names only | `uuid` |
| `bps` | basis points | Money-rate column suffix (§5.2) | `commission_rate_bps` |
| `minor` | minor currency unit | Money column suffix (§5.2) | `gross_minor` |
| `min` / `max` | minimum / maximum | Column-name prefix | `min_age`, `max_discount_minor`, `freeze_max_days` |
| `avg` | average | Column names | `rating_avg` |
| `ref` | reference (human-facing) | Column names | `order_ref`, `payout_reference` *(prefer the full word where it fits)* |
| `qr` | quick-response code | Column and enum values | `qr_token_nonce` |
| `url` | uniform resource locator | Column names | `pdf_url`, `statement_url`, `url_expires_at` |
| `pdf` | portable document format | Column names | `pdf_url` |
| `ip` | internet protocol address | Column names | `ip` |
| `sms` | short message service | Enum values, column names | `channel = 'SMS'` |
| `otp` | one-time password | Column and job names | `otp_attempts` |
| `kyc` | know your customer | Table and column names | `kyc_documents`, `kyc_checklists` |
| `crm` | customer relationship management | Table names | `crm_members` |
| `rls` | row-level security | Policy prefix (§20) | `rls_memberships__tenant_isolation` |
| `fk` / `pk` / `uq` / `ck` / `ex` / `idx` / `gix` / `gin` / `brn` / `seq` / `trg` / `fn` / `vw` / `mvw` | constraint and object prefixes | Object-name prefixes only (§6–§18) | `fk_orders__plans` |
| `fy` | financial year | Column names | `fy_start_month` |
| `gst` / `cgst` / `sgst` / `igst` | India tax components | **Enum values only**, never a column name | `component = 'CGST'` |
| `gstin` / `pan` | India tax identifiers | Column names — they *are* the legal names | `gstin`, `pan` |
| `sac` / `hsn` | India service/goods accounting codes | Column names | `sac_code` |
| `dlt` | Distributed Ledger Technology (TRAI SMS registry) | Column names and enum values | `dlt_template_id`, `dlt_approval_status` |
| `upi` | Unified Payments Interface | Enum values | `method = 'UPI'` |
| `iso` | International Organization for Standardization | Column names | `iso_3166_alpha2` |
| `tz` | — | **NOT ALLOWED.** Use `timezone` | — |
| `notif` | notification | **Only** inside a §3.3 step-2 truncation | `fk_notif_templates__self__supersedes` |

### 23.2 The banned abbreviations, with their expansions

`amt` → `amount` · `qty` → `quantity` · `num` → the `_count` suffix · `cnt` → `_count` ·
`desc` → `description` (also reserved, §22) · `addr` → `address` · `cust` → `customer` ·
`mbr` → `member` · `memb` → `membership` · `sub` → `subscription` · `txn` / `trx` → `transaction` ·
`cfg` / `conf` → `configuration` · `img` → `image` · `attr` → `attribute` · `val` → the actual name ·
`dt` / `ts` → the `_at` or `_date` suffix · `nbr` / `no` → `number` · `pct` → the `_bps` suffix ·
`tmp` → nothing; a temporary column is a `MG3` expand-phase column and is named `<final_name>_v2` ·
`chk` → `check_in` (and `ck_` is the constraint prefix, which is different) ·
`idem` → `idempotency` · `st` → `state` or `status`, spelled out ·
`org` → `tenant` (the ubiquitous language word is **tenant**, `A3.4`, and `org` would be a second name
for one thing, violating **L1**)

### 23.3 Why the list is closed

An open abbreviation policy produces `cust_addr`, `customer_address` and `cust_address` in the same
schema within a year, and **L4** — greppability — dies. Each entry above earned its place by being
either (a) an acronym that is the thing's actual name (`GSTIN`, `PAN`, `UPI`, `DLT`, `SAC`), (b) a
suffix that is part of a typed convention (`_minor`, `_bps`, `_count`), or (c) an object prefix whose
whole purpose is to be short and sortable (`fk_`, `idx_`). Nothing else qualifies.

---

## 24. Migration file names

| Rule | Pattern | Good | Bad |
| :--- | :--- | :--- | :--- |
| Prisma Migrate directory (`A-07`) | `<UTC timestamp>_<verb>_<subject>` | `20260901120000_add_coupon_funding_source`, `20261015093000_create_settlement_lines`, `20261120140000_enable_rls_on_attendance_partitions` | `20260901120000_update`, `20260901120000_fix`, `20260901120000_migration` |
| Verb list is closed | `create`, `add`, `drop`, `rename`, `alter`, `backfill`, `enable`, `grant`, `revoke`, `partition`, `index`, `seed` | `20261201080000_index_gyms_freshness_score` | `20261201080000_stuff`, `..._wip` |
| Subject is the object, `snake_case`, singular action | `..._add_commission_tax_minor_to_orders` | `..._india_changes` |

| # | Rule |
| :-: | :--- |
| **MF1** | One logical change per migration. A migration that both creates a table and backfills another is two migrations (`MG6`: backfills are **jobs**, not migrations) |
| **MF2** | A migration is never edited after it has been applied anywhere beyond `local` (`MG7`). A correction is a new forward migration (`MG1`) |
| **MF3** | The `expand` / `migrate` / `contract` phase appears in the name when `MG3` applies: `..._expand_add_role_id_to_staff`, `..._migrate_backfill_staff_role_id`, `..._contract_drop_staff_role_enum`. Three releases, three names, greppable as a set |
| **MF4** | Raw SQL for RLS policies, grants, partial indexes, exclusion constraints, triggers and partitions lives **inside** the Prisma migration file, never in a side-channel directory, so there is exactly one migration history (`ADR-0004` implementation notes) |

---

## 25. Renaming an object

There is no rename. There is an expand-migrate-contract across three releases (`MG2`, `MG3`), because
during a rolling deploy both application versions run against one database.

| Phase | Release | Action | Naming consequence |
| :--- | :--- | :--- | :--- |
| **Expand** | N | Add the new column with the new name; dual-write both | The old name still exists; the new one is the final name, never a temporary one. **There is no `_new` suffix** |
| **Migrate** | N+1 | Backfill as a job; switch reads to the new name | Both names present; the lint's exception fixture carries the old name with an expiry date |
| **Contract** | N+2 | Stop writing the old name, then drop it | The fixture entry is removed in the same PR; a fixture entry past its expiry date **fails the build** |

| # | Rule |
| :-: | :--- |
| **RN1** | The transitional column is named for what it will be, not for what it is transitionally. `staff.role_id`, never `staff.role_id_new`, never `staff.role_id_v2` |
| **RN2** | Where two columns of the same concept must coexist and the final name is already taken, the **old** one is renamed to `<name>_legacy` in the expand phase, and its fixture entry names the migration that will drop it |
| **RN3** | Enum values are **never** renamed (`MG9`). A value that must change meaning becomes a new value plus a data migration; the old value stays until no row holds it |
| **RN4** | A constraint or index rename is a drop-and-create in one migration and needs no expand-migrate-contract, because no application code references a constraint name — except the error-mapper, which maps every `23503` to one opaque code (`Relationships.md` §2.3 M3) and therefore references none |

---

## 26. India-specific identifiers

Everything the launch market adds, in one place, so that a second market can see exactly what it must
supply.

| Identifier | Kind | Rule | Country-agnostic? |
| :--- | :--- | :--- | :--- |
| `tenants.pan` | column | India's legal name for the identifier. Not `tax_id_1` | **No — deliberately.** `ERD.md` §12.3: named columns make validation, invoice rendering and duplicate detection correct rather than string-typed guesswork |
| `tenants.gstin` | column | 15 chars; embeds state code + PAN | No — deliberately |
| `tenants.state_code` | column | `char(2)`; drives intra-state vs inter-state | Reusable; most federal tax systems need one |
| `tenants.tax_registration_status` | enum column | `tax_registration_status_enum` | Yes |
| `tax_profiles.fy_start_month` | column | `smallint`; India = `4`. **Configuration, never a constant** | **Yes** — `OBJ-09`; hardcoding January is a defect that surfaces in April |
| `tax_profiles.components` | jsonb | `[{CGST,50%},{SGST,50%}]` of an 1800 bps total, or `[{IGST,100%}]` | **Yes** — the *shape* is agnostic, the *data* is Indian |
| `invoices.financial_year` | column | `text`, `'2026-27'` (§5.4 TS6) | Yes |
| `invoices.tax_breakdown` | jsonb | Array of `{component, rate_bps, taxable_value_minor, amount_minor}` | Yes |
| `invoices.place_of_supply_state_code`, `invoices.sac_code` | columns | Printed on the invoice; place of supply is the **branch** state | Partly — `sac_code` generalises to `service_tax_code` in a later market, and that rename is an `MG3` when it happens |
| `orders.commission_tax_minor`, `settlement_lines.commission_tax_minor` | columns | The ninth figure. `_minor` + adjacent `currency` like every other | **Yes** — the name says `COMMISSION_TAX`, not `COMMISSION_GST`. **PENDING CLIENT DECISION** (`ERD.md` §12.4) |
| `ledger_entry_type_enum` values `COMMISSION_TAX`, `COMMISSION_TAX_REVERSAL` | enum values | Mirror `COMMISSION` / `COMMISSION_REVERSAL` | Yes. **PENDING CLIENT DECISION** |
| `notification_templates.dlt_template_id`, `dlt_approval_status`, `supersedes_version_id`, `routing_class` | columns | Meaningful only where `channel = 'SMS'` | No — TRAI-specific, and honestly so. `dlt_approval_status = 'NOT_REQUIRED'` is the value every other channel and every other market carries |
| `tenants.timezone` = `'Asia/Kolkata'` | data | IANA identifier, never `IST`, never `+05:30` (§5.4 TS5) | Yes |
| `currency` = `'INR'` | data | ISO-4217; minor unit is paise, and the column suffix stays `_minor` (§5.3 M2) | Yes |

**Nothing in this table is named for India except the four legal identifiers that *are* Indian
words** — `pan`, `gstin`, `sac_code`, `dlt_template_id`. Every rate, threshold, component split and
financial-year boundary is data in `tax_profiles`, `commission_rules` or `kyc_checklists`, per
`ADR-0028`.

---

## 27. Quick-reference card

| Object | Pattern | Example from this schema |
| :--- | :--- | :--- |
| Schema | `public` (+ `extensions`) | `public` |
| Table | `snake_case` plural | `settlement_lines` |
| Column | `snake_case` singular | `payable_to_gym_minor` |
| Primary key | `pk_<table>` on `id uuid` | `pk_settlement_lines` |
| Foreign key | `fk_<child>__<parent>[__<role>]` | `fk_reserves__settlement_batches__held_in` |
| Unique | `uq_<table>__<cols>[__<predicate>]` | `uq_invoices__tenant_id_financial_year_invoice_number` |
| Check | `ck_<table>__<rule_in_words>` | `ck_orders__net_equals_gross_minus_discount` |
| Exclusion | `ex_<table>__<rule_in_words>` | `ex_branch_hours__no_overlap_per_weekday` |
| B-tree index | `idx_<table>__<cols>` | `idx_memberships__tenant_id_status_end_date` |
| Partial index | `idx_<table>__<cols>__<predicate>` | `idx_gyms__status_rating_avg__approved` |
| Expression index | `idx_<table>__<expr_in_words>` | `idx_gyms__lower_name` |
| GiST index | `gix_<table>__<col>` | `gix_branches__location` |
| GIN index | `gin_<table>__<col>[_trgm]` | `gin_search_documents__name_trgm` |
| BRIN index | `brn_<table>__<col>` | `brn_ledger_entries__occurred_at` |
| Enum type | `snake_case` singular + `_enum` | `membership_status_enum` |
| Enum value | `SCREAMING_SNAKE_CASE` | `OUTSIDE_PLAN_ACCESS_WINDOW` |
| Sequence | `seq_<table>__<purpose>` | *(none — §13)* |
| Partition | `<table>_y<YYYY>m<MM>` | `attendance_y2026m08` |
| View | `vw_<subject>` | `vw_tenant_balance` |
| Materialised view | `mvw_<subject>` | `mvw_search_documents` |
| Function | `fn_<table>__<purpose>` / `fn_<verb>_<noun>` | `fn_orders__freeze_money_after_paid` |
| Trigger | `trg_<table>__<timing>_<event>__<purpose>` | `trg_orders__before_update__freeze_money` |
| RLS policy | `rls_<table>__tenant_isolation` \| `__platform_read` \| `__<predicate>` | `rls_coupons__platform_or_tenant` |
| Capability role | `app_<capability>` | `app_platform_ro` |
| Login role | `svc_<workload>` | `svc_migrator` |
| Migration | `<ts>_<verb>_<subject>` | `20260901120000_add_coupon_funding_source` |
| Prisma model | `PascalCase` singular + `@@map` | `SettlementLine` → `settlement_lines` |
| Prisma field | `camelCase` + `@map` | `payableToGymMinor` → `payable_to_gym_minor` |

---

## 28. The CI lint

One job, `db:naming-lint`, in the CI pipeline's schema stage. It runs against the database Prisma
Migrate produced inside a Testcontainers PostgreSQL 16 + PostGIS instance (`A-06`) — **never against
`schema.prisma` as text**, because the text is not what ships.

Every check is a `FAIL`. There is no warning level: a warning in a naming lint is a rule nobody
follows.

| # | Check | Mechanism | Fails when |
| :-: | :--- | :--- | :--- |
| **L1** | Table names | `pg_class` where `relkind = 'r'`, excluding partitions: `^[a-z][a-z0-9_]*$`, plural, no `^_`, not in §22.1 | Any table off-pattern or hidden-implicit |
| **L2** | Column names | `information_schema.columns`: `^[a-z][a-z0-9_]*$`, no `__`, not in §22.1 | Any column off-pattern |
| **L3** | Constraint prefixes | `pg_constraint`: `contype` → required prefix (`p`→`pk_`, `f`→`fk_`, `u`→`uq_`, `c`→`ck_`, `x`→`ex_`) and the `__` separator present | Any Prisma- or PostgreSQL-generated name (`%_pkey`, `%_key`, `%_fkey`, `%_check`) |
| **L4** | Index prefixes and tenant prefix | `pg_indexes`: prefix in `{idx_, uq_, gix_, gin_, brn_}`; and for any unique index on a table with a `tenant_id` column, assert the leading column is `tenant_id` **or** the index is in the two-entry `ERD.md` §5.4 exception fixture | An untenanted unique on an RLS table; an off-pattern index prefix |
| **L5** | Identifier length | Every name ≤ 63 bytes **and** — since PostgreSQL already truncated anything longer — every name in the intended-names fixture matches what is in the catalogue | A silent truncation |
| **L6** | Audit quartet | `information_schema.columns`: every table has `created_at`, `updated_at`, `created_by`, `updated_by` | `NFR-DQ-05` violated (this check already exists as `AC6`; the lint reuses it) |
| **L7** | Money columns | Every `%_minor` column is `bigint`; every table containing a `%_minor` column also has a `currency char(3)`; no column anywhere has type `money`, `numeric`, `decimal`, `real` or `double precision` whose name matches `/(amount\|price\|fee\|total\|gross\|net\|tax\|commission\|discount\|payable\|balance\|reserve)/` | `BR-PAY-01`, `NFR-DQ-02`, `DB2` |
| **L8** | Timestamp columns | Every `%_at` column is `timestamptz`; no column anywhere is `timestamp without time zone`; every `%_date` column is `date` | `NFR-DQ-03`, `DB4`, `DB6` |
| **L9** | Views | Every view whose dependency closure reaches a table with `tenant_id` has `security_invoker=true` in `reloptions`; name matches `^vw_` or `^mvw_`; `mvw_search_documents` is the one fixture exemption | §16 |
| **L10** | Prisma hygiene | No relation, table or index named `^_`; every `@@id`/`@@unique`/`@@index`/`@relation` in `schema.prisma` carries `map:` (a text check on the schema file, the **only** text check in the job) | `PR1`, `PR7` |
| **L11** | Enum types and values | `pg_type` where `typtype = 'e'`: name ends `_enum`, is singular; every value matches `^[A-Z][A-Z0-9_]*$` | A `PascalCase` value; a type without the suffix |
| **L12** | RLS policy names | `pg_policies`: every table with `tenant_id` has a policy named `rls_<table>__tenant_isolation` **or** an entry in the §20 `P1` exception fixture; every partition of `attendance`/`audit_log` has its own | Extends `IS6` (`PROJECT_CONSTITUTION.md` §11.7) to partitions and to hybrid predicates |
| **L13** | Roles | `pg_roles`: every non-system role matches `^(app|svc)_[a-z_]+$`; none has `rolbypassrls` or `rolsuper` | `RS3`, `PE1`, `RL1` |
| **L14** | Abbreviations | Every column and table name is tokenised on `_` and each token is either an English word from a checked-in dictionary or an entry in the §23.1 allowed list | `cust_addr` ships |
| **L15** | Partition names | Every partition of a partitioned table matches `^<parent>_y[0-9]{4}m[0-9]{2}$` or `^<parent>_default$` | `attendance_2026_11` |
| **L16** | Fixture hygiene | Every entry in every exception fixture has an owner, a reason and — for `MG3` transitional entries — an expiry date that has not passed | A permanent exception acquired by accident |

### 28.1 The exception fixtures

Four checked-in JSON files. They exist so that a legitimate exception is **reviewed once and visible
forever**, rather than the check being weakened for everyone.

| Fixture | Contents today |
| :--- | :--- |
| `identifier-exceptions.json` | `audit_log` (singular table, §4); `stackable` and `auto_renew` (bare-adjective booleans, `B3`); any §3.3 step-4 hash truncation |
| `unique-index-exceptions.json` | `uq_orders__idempotency_key`, `uq_payment_events__provider_event_id` (`ERD.md` §5.4) |
| `rls-policy-exceptions.json` | `tenants` (`rls_tenants__self`), `coupons`, `support_tickets`, `notification_log` (§20 `P1`); `mvw_search_documents` and the eleven `§C2.3` reference tables as RLS-exempt |
| `index-coverage-exceptions.json` | The five FKs served by an existing composite index (`Relationships.md` §12.3); `idx_orders__coupon_id` as the one deliberately non-tenant-leading index (`Relationships.md` §12.4) |

### 28.2 What the lint deliberately does not check

| Not checked | Why |
| :--- | :--- |
| Whether an index is *useful* | `IX2` requires a named query in `Schema.md`; that is a review gate, not a lint. A machine cannot tell a dead index from a rare one |
| Whether a check constraint's name matches its predicate | Semantic. The review catches `ck_orders__payable_non_negative` guarding the wrong column |
| Whether a column's name matches its meaning | `NFR-PRV-01` requires a documented purpose per field; the lint verifies the documentation **exists** (via `Schema.md` coverage), not that it is true |
| English grammar in `ck_`/`ex_` rule fragments | Diminishing returns; §9's examples set the standard by demonstration |

---

## 29. Document control

| Field | Value |
| :--- | :--- |
| **Owns** | Every identifier in the PostgreSQL schema: schemas, tables, columns, all six constraint families, all seven index families, enums, sequences, partitions, views, functions, triggers, RLS policies, roles, migration file names, and the Prisma ↔ SQL mapping law |
| **Bound by** | `PROJECT_CONSTITUTION.md` §8.6 and §8.7, which win any disagreement |
| **Does not own** | Which objects exist (`Schema.md`), which relationships exist (`Relationships.md`), what the RLS predicates say (`Security.md` §4.4), which grants each role holds (`ERD.md` §10.3, pending `OI-6`) |
| **Conflicts resolved here** | Database role names — `app_*` adopted over `ERD.md` §10.3's `gm_*` (§19). Partition names — `<table>_y<YYYY>m<MM>` adopted over `ERD.md` §11.4's `attendance_2026_11` (§14). Policy names on partitions — `rls_<partition>__tenant_isolation` adopted over `ERD.md` §11.4's bare `tenant_isolation` (§20 `P2`) |
| **Conflicts raised, not resolved** | `attendance` primary-key column order (`Relationships.md` `OI-7`); whether `app_ro` in `Monitoring.md` is a fifth role (`RL3`, `OI-6`); whether `attendance` has a `DEFAULT` partition (§14) |
| **Enforced by** | `db:naming-lint`, 16 checks, four exception fixtures (§28) |
| **Reviewers** | Engineering Lead / CTO, Technical Lead / Architect |

*End of NamingConvention.md.*

