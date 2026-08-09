-- migration: 20260810130000_expand_create_gym_amenities
-- phase:            expand                     -- MG3
-- requirement:      M-031 AC-1, Schema.md §5.4, §2.7 G-CRUD-D, BR-TEN-01, NFR-DQ-06, FR-SRCH-03
-- tables:           gym_amenities
-- rls:              ENABLE + FORCE, P-STD pair plus the platform SELECT policy. TENANT-OWNED —
--                   the DECLARATION belongs to a gym even though the vocabulary does not
-- grants:           G-CRUD-D — SELECT, INSERT, UPDATE, DELETE. One of the five tables in §2.7
--                   where a hard delete is the correct domain operation. See THE DELETE below
-- append_only:      no. The opposite: this is the deliberate hard-delete case
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE on a table that does not exist yet
-- rewrite:          none
-- est_duration:     < 40 ms                                               -- MG11
-- backfill_job:     none. Created empty; catalog.seed.ts owns its rows
-- rollback:         FREE while empty
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Schema.md §5.4, §2.7, NFR-DQ-06
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- M-031 · `gym_amenities` — a gym declares an amenity from the platform's vocabulary.
--
-- ┌─ WHY THIS TABLE IS TENANT-OWNED WHILE `amenities` IS NOT ────────────────────────────────────┐
-- │ The two look adjacent and belong to opposite classes. `amenities` is the VOCABULARY — sixty   │
-- │ rows, platform-managed, no `tenant_id`, on the §1.3 exemption list, because "steam room"      │
-- │ means the same thing to every gym and filtering across tenants depends on it meaning the      │
-- │ same thing.                                                                                    │
-- │                                                                                              │
-- │ `gym_amenities` is a CLAIM: this gym says it has one. That is a tenant's assertion about a    │
-- │ tenant's premises, it is read on that gym's public page, and a tenant editing another         │
-- │ tenant's claims is a `BR-TEN-01` breach. So it carries `tenant_id`, RLS and both policy       │
-- │ halves like any other tenant-owned table.                                                      │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ THE DELETE — G-CRUD-D, AND IT IS AN EXCEPTION THAT HAD TO BE ARGUED ────────────────────────┐
-- │ ADR-0024 grants `DELETE` on no table that has a `deleted_at`, and `NFR-DQ-04` soft-deletes    │
-- │ almost everything. `Schema.md` §2.7 names five tables where a hard delete is the correct      │
-- │ domain operation and destroys no history — `favourites`, `saved_searches`, `gym_amenities`,   │
-- │ `plan_branches`, `staff_branches` — and this is one of them.                                   │
-- │                                                                                              │
-- │ The test is whether anything downstream ever needs to know the row existed. It does not: a    │
-- │ de-selected amenity is a gym correcting its own listing, no invoice references it, no         │
-- │ check-in depends on it, and no report is retrospectively wrong once it is gone. Keeping a     │
-- │ tombstone would mean every read of "what does this gym offer" carries a `WHERE deleted_at IS  │
-- │ NULL` that exists to serve nothing — and one query that forgets it shows a sauna the gym      │
-- │ removed two years ago.                                                                         │
-- │                                                                                              │
-- │ Note what is NOT hard-deletable: the amenity itself. `amenities.is_active` retires a term     │
-- │ and leaves every historical declaration readable, because deleting a vocabulary entry would   │
-- │ silently revoke a claim from every gym that ever made it.                                      │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

CREATE TABLE IF NOT EXISTS gym_amenities (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL,
  gym_id     uuid        NOT NULL,
  amenity_id uuid        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_gym_amenities__tenants   FOREIGN KEY (tenant_id)  REFERENCES tenants (id),
  CONSTRAINT fk_gym_amenities__gyms      FOREIGN KEY (gym_id)     REFERENCES gyms (id),
  CONSTRAINT fk_gym_amenities__amenities FOREIGN KEY (amenity_id) REFERENCES amenities (id)
);

/*
 * Keyed on `(gym_id, amenity_id)` and NOT on `(tenant_id, gym_id, amenity_id)`.
 *
 * A gym belongs to exactly one tenant — `fk_gyms__tenants` says so — and adding `tenant_id` to the
 * key would let the SAME gym hold the same amenity twice under two tenant ids, which is a state the
 * schema should not be able to represent at all. The narrower key makes it unrepresentable.
 */
CREATE UNIQUE INDEX IF NOT EXISTS uq_gym_amenities__gym_amenity
  ON gym_amenities (gym_id, amenity_id);

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- RLS — P-STD, in this file (R-6, MG10, P9)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE gym_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_amenities FORCE  ROW LEVEL SECURITY;

-- FOR ALL covers the DELETE this table uniquely grants: without `WITH CHECK` on the same policy a
-- tenant could not insert cross-tenant, but the `USING` half is what stops it DELETING one.
CREATE POLICY rls_gym_amenities__tenant_isolation
    ON gym_amenities
    FOR ALL
    TO app_rw, app_append
    USING      (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY rls_gym_amenities__platform_read
    ON gym_amenities
    FOR SELECT
    TO app_platform_ro
    USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- GRANTS — G-CRUD-D. The only DELETE this milestone grants, and the reasoning is above.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON gym_amenities TO app_rw;
GRANT SELECT                         ON gym_amenities TO app_platform_ro;
