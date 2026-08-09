-- migration: 20260810110000_expand_create_gyms
-- phase:            expand                     -- MG3
-- requirement:      M-031 AC-1, AC-7, Schema.md §5.1, BR-TEN-01, BR-GYM-01, BR-GYM-03,
--                   NFR-DQ-04, NFR-DQ-06, ERD.md §7.6, §8.1, §8.2, A4.2
-- tables:           gyms
-- rls:              ENABLE + FORCE, P-STD pair (USING and WITH CHECK) plus the platform SELECT
--                   policy. TENANT-OWNED — the whole point of the table is whose gym it is
-- grants:           G-CRUD — SELECT, INSERT, UPDATE. No DELETE: the table has deleted_at
--                   (ADR-0024), and a hard delete runs as app_migrator in a reviewed job
-- append_only:      no
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE on a table that does not exist yet
-- rewrite:          none
-- est_duration:     < 60 ms                                               -- MG11
-- backfill_job:     none. Created empty; catalog.seed.ts owns its rows at SEED_VERSION 0.6
-- rollback:         FREE while the table is empty. After M-036 publishes a listing it never is
--                   again — this is the only point in this table's life where a drop is reversible
-- concurrent_steps: none. Every index here is built on an empty table
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Schema.md §5.1, §2.6 P-STD, §2.7 G-CRUD, ERD.md §7.6
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- M-031 · `gyms` — a tenant's public brand and listing identity.
--
-- ┌─ THE SLUG IS UNIQUE PER CITY, NOT GLOBALLY, AND THAT IS WHY `city_id` IS DENORMALISED ───────┐
-- │ `Schema.md` §5.1: *"two 'Iron Temple' gyms in different cities are both legitimate"*. A       │
-- │ global unique would refuse the second one and force it to trade under a name nobody calls it. │
-- │                                                                                              │
-- │ Scoping the index needs the city ON THIS ROW, and the city is really a property of the        │
-- │ primary branch. So `city_id` is denormalised *"to make the slug scope enforceable by an        │
-- │ index"* — the denormalisation exists for the constraint, not for read speed, which is the      │
-- │ only kind of denormalisation `NFR-DQ-06` tolerates.                                            │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ `ck_gyms__no_hierarchy` — A COLUMN THAT EXISTS ONLY TO BE NULL ─────────────────────────────┐
-- │ `parent_gym_id` is reserved for the franchise hierarchy of `ERD.md` §7.6, deferred out of     │
-- │ Phase 1. The `CHECK` is there so the first developer who needs a "group" concept gets a LOUD  │
-- │ FAILURE rather than half a system quietly behaving as though hierarchy were supported —       │
-- │ rating rollups, search grouping and settlement attribution all change when it lands, and      │
-- │ each of them would otherwise be discovered one at a time in production.                       │
-- │                                                                                              │
-- │ `A4.2`. Lifting the constraint costs the list in §7.6, which is considerably more than        │
-- │ "add a column".                                                                                │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ `rating_avg numeric(2,1)` IS NOT A `DB2` VIOLATION ─────────────────────────────────────────┐
-- │ `DB2` and invariant 2 forbid `numeric` and `float` FOR MONEY. A rating is not money: it is    │
-- │ not summed, not reconciled, and being 0.05 out never leaves a statement that will not balance.│
-- │ §5.1 says so directly, and records that `rating_avg_x10 smallint` was considered and rejected │
-- │ as obscurity for no gain. `gymmap/no-float-money` agrees — the name matches nothing it        │
-- │ polices.                                                                                       │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

CREATE TABLE IF NOT EXISTS gyms (
  id              uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid               NOT NULL,
  name            text               NOT NULL,
  slug            slug               NOT NULL,
  city_id         uuid               NOT NULL,

  -- Sanitised HTML. Sanitisation happens on WRITE — `NFR-SEC-05`, and the M-032 aggregate owns
  -- it. The column never holds raw input, so a reader is never the last line of defence.
  description     text,

  -- FK only, deliberately no snapshot: reclassifying a category SHOULD apply retroactively, so a
  -- gym moved from "Gym" to "CrossFit box" is found under the new taxonomy immediately.
  category_id     uuid               NOT NULL,

  gender_policy   gender_policy_enum NOT NULL DEFAULT 'MIXED',

  /*
   * `DRAFT`, and no automated path may ever set `APPROVED`.
   *
   * `BR-GYM-01` and `BR-GYM-03`: verification before visibility, and approval is a human act. The
   * database default is the safe end of that — a row inserted by any path that forgets to think
   * about status is invisible rather than live. The `HumanActor` type in the M-028 state machine
   * is what makes the prohibition structural; this default is what makes the accident harmless.
   */
  status          gym_status_enum    NOT NULL DEFAULT 'DRAFT',

  -- Denormalised, owned by the reviews/ event handler, staleness <= 60 s, rebuilt nightly.
  rating_avg      numeric(2,1),
  rating_count    integer            NOT NULL DEFAULT 0,
  freshness_score smallint           NOT NULL DEFAULT 0,
  featured_until  timestamptz,
  parent_gym_id   uuid,
  deleted_at      timestamptz,
  created_at      timestamptz        NOT NULL DEFAULT now(),
  updated_at      timestamptz        NOT NULL DEFAULT now(),

  CONSTRAINT fk_gyms__tenants         FOREIGN KEY (tenant_id)     REFERENCES tenants (id),
  CONSTRAINT fk_gyms__cities          FOREIGN KEY (city_id)       REFERENCES cities (id),
  CONSTRAINT fk_gyms__gym_categories  FOREIGN KEY (category_id)   REFERENCES gym_categories (id),
  CONSTRAINT fk_gyms__parent_gym      FOREIGN KEY (parent_gym_id) REFERENCES gyms (id),

  CONSTRAINT ck_gyms__name_length   CHECK (char_length(name) BETWEEN 2 AND 120),
  CONSTRAINT ck_gyms__rating_range  CHECK (rating_avg IS NULL OR (rating_avg >= 0.0 AND rating_avg <= 5.0)),
  CONSTRAINT ck_gyms__rating_count  CHECK (rating_count >= 0),
  CONSTRAINT ck_gyms__freshness     CHECK (freshness_score BETWEEN 0 AND 100),
  CONSTRAINT ck_gyms__no_hierarchy  CHECK (parent_gym_id IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gyms__city_slug
  ON gyms (city_id, slug) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gyms__tenant_id_status ON gyms (tenant_id, status);

/*
 * `§C2.4`'s ranking pre-sort, and it deliberately does NOT lead with `tenant_id`.
 *
 * §5.1 names this as the third `SC-R06`-adjacent case: the query it serves is a PLATFORM ranking
 * read from the `search_documents` projection, not a tenant session. Where a tenant session reads
 * its own gyms, `idx_gyms__tenant_id_status` is the index for it.
 */
CREATE INDEX IF NOT EXISTS idx_gyms__status_rating_freshness
  ON gyms (status, rating_avg DESC, freshness_score DESC);

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- RLS — P-STD, in this file (R-6, MG10, P9, CI job 11)
--
-- In the SAME migration as the CREATE TABLE, and not because of a style rule: a tenant-owned table
-- that exists for even one commit without a policy is queryable across tenants for that commit.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyms FORCE  ROW LEVEL SECURITY;

-- USING filters READS, WITH CHECK constrains WRITES. Both, always: a USING-only policy permits a
-- cross-tenant INSERT the inserting tenant then cannot see, so nothing looks wrong from either
-- side and the row sits in another tenant's scope indefinitely (`AC-FND-01.1`).
CREATE POLICY rls_gyms__tenant_isolation
    ON gyms
    FOR ALL
    TO app_rw, app_append
    USING      (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- `current_setting` carries NO `missing_ok` argument, here or anywhere — `Constraints.md` §8.3:
-- *"missing_ok is false. It is never written."* With it, an unset variable yields NULL, the
-- comparison yields NULL, and the policy silently matches nothing instead of raising.

-- The platform read. SELECT only, across tenants, for the elevation role alone — this is what
-- makes an admin listing possible without BYPASSRLS anywhere. It must never gain INSERT, UPDATE
-- or DELETE: an approval is written through `app_rw` inside the tenant.
CREATE POLICY rls_gyms__platform_read
    ON gyms
    FOR SELECT
    TO app_platform_ro
    USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- GRANTS — G-CRUD. No DELETE, because the table carries `deleted_at` (ADR-0024).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE ON gyms TO app_rw;
GRANT SELECT                 ON gyms TO app_platform_ro;
