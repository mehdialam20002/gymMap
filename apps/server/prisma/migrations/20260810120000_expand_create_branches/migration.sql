-- migration: 20260810120000_expand_create_branches
-- phase:            expand                     -- MG3
-- requirement:      M-031 AC-1, AC-2, AC-3, Schema.md §5.2, ADR-0007, BR-TEN-01, BR-GYM-08,
--                   FR-SRCH-01, NFR-DQ-04, LAUNCH_MARKET_INDIA.md §4, ERD.md §7.5
-- tables:           branches
-- rls:              ENABLE + FORCE, P-STD pair plus the platform SELECT policy. TENANT-OWNED
-- grants:           G-CRUD — SELECT, INSERT, UPDATE. No DELETE; the table has deleted_at
-- append_only:      no
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE on a table that does not exist yet
-- rewrite:          none
-- est_duration:     < 60 ms                                               -- MG11
-- backfill_job:     none. Created empty; catalog.seed.ts owns its rows at SEED_VERSION 0.6
-- rollback:         FREE while empty. DROP branches before gyms — the FK runs that way
-- concurrent_steps: none while empty. MG4 requires gix_branches__location to be rebuilt
--                   CONCURRENTLY if it is ever recreated on a populated table; concurrent.sql
--                   carries that form for exactly that case
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Schema.md §5.2, §2.6 P-STD, ADR-0007, Scalability.md §6.2
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- M-031 · `branches` — a physical location, and the one PostGIS point four features share.
--
-- ┌─ `geography`, NEVER `geometry`. THIS IS THE TRAP THE MILESTONE NOTES OPEN WITH ──────────────┐
-- │ `ST_DWithin(geometry, point, 3000)` does not fail. It measures in DEGREES and returns a       │
-- │ plausible-looking, wrong set of rows — at Bengaluru's latitude a "3,000" radius is roughly    │
-- │ three hundred thousand kilometres, so a search for gyms near you returns the whole country    │
-- │ and looks like a ranking bug rather than a units bug.                                          │
-- │                                                                                              │
-- │ `geography` measures metres on a spheroid with no projection step, which is what              │
-- │ `ST_DWithin(location, point, metres)` needs. `Schema.md` §5.2 fixes it for this reason and    │
-- │ ADR-0007 records the decision.                                                                 │
-- │                                                                                              │
-- │ Declared in raw SQL because Prisma has no geography scalar — the model carries it as          │
-- │ `Unsupported("geography(Point, 4326)")`, which Prisma can migrate around but not read.        │
-- │ Every radius query is therefore `$queryRaw`, and `AC-2` pins the plan with EXPLAIN so a       │
-- │ sequential scan cannot creep in unnoticed.                                                     │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ ONE PRIMARY PER GYM IS A PARTIAL UNIQUE INDEX, NOT A TRIGGER — AC-3 ────────────────────────┐
-- │ Promotion and demotion happen in ONE transaction: the new primary is set and the old one      │
-- │ cleared together. A counting trigger fires per row, sees the intermediate state where two     │
-- │ rows are primary or none is, and either refuses a legitimate swap or — worse, under           │
-- │ concurrency — lets two through.                                                                │
-- │                                                                                              │
-- │ A partial unique index is evaluated by the index itself at COMMIT-visible time and races      │
-- │ correctly by construction. `Schema.md` §5.2 states the reasoning; `one-primary-per-gym`       │
-- │ int-spec runs two concurrent transactions and asserts exactly one survives.                    │
-- │                                                                                              │
-- │ The other half of the rule — *at least one* branch — cannot be an index, because an index     │
-- │ cannot see an absence. It is asserted at the `PENDING_REVIEW` transition.                      │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ `state_code char(2)` DECIDES TAX, NOT GEOGRAPHY ────────────────────────────────────────────┐
-- │ `LAUNCH_MARKET_INDIA.md` §4: the branch's state is the PLACE OF SUPPLY, and place of supply   │
-- │ decides CGST+SGST versus IGST on every invoice for a sale made at this branch. A wrong two    │
-- │ characters here is a wrong tax split on every invoice that branch ever issues — recoverable   │
-- │ only by re-issuing them, which for a GST invoice means a credit note per document.            │
-- │                                                                                              │
-- │ It sits beside free-text `state` deliberately: the text is what an address prints, the code   │
-- │ is what arithmetic reads, and conflating them is how a typo becomes a tax position.           │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

CREATE TABLE IF NOT EXISTS branches (
  id                   uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid                   NOT NULL,
  gym_id               uuid                   NOT NULL,
  name                 text                   NOT NULL,
  address_line1        text                   NOT NULL,
  address_line2        text,
  city_id              uuid                   NOT NULL,
  locality_id          uuid,
  state                text                   NOT NULL,
  state_code           char(2)                NOT NULL,

  -- Geocoded for the BR-GYM-08 tolerance check, which is M-030's GEO_DISTANCE pre-check.
  postal_code          text                   NOT NULL,
  country_code         country_code           NOT NULL DEFAULT 'IN',

  location             geography(Point, 4326) NOT NULL,

  /*
   * The measured distance between `location` and the geocoded postal address at submission.
   *
   * Stored rather than recomputed: the geocoder's answer at submission time is the evidence the
   * reviewer acted on, and re-geocoding six months later to explain a decision would compare
   * against a different vendor answer. `BR-GYM-08`.
   */
  geo_tolerance_metres integer,

  capacity             integer,
  status               branch_status_enum     NOT NULL DEFAULT 'ACTIVE',
  is_primary           boolean                NOT NULL DEFAULT false,
  deleted_at           timestamptz,
  created_at           timestamptz            NOT NULL DEFAULT now(),
  updated_at           timestamptz            NOT NULL DEFAULT now(),

  CONSTRAINT fk_branches__tenants    FOREIGN KEY (tenant_id)    REFERENCES tenants (id),
  CONSTRAINT fk_branches__gyms       FOREIGN KEY (gym_id)       REFERENCES gyms (id),
  CONSTRAINT fk_branches__cities     FOREIGN KEY (city_id)      REFERENCES cities (id),
  CONSTRAINT fk_branches__localities FOREIGN KEY (locality_id)  REFERENCES localities (id),
  CONSTRAINT fk_branches__countries  FOREIGN KEY (country_code) REFERENCES countries (code),

  CONSTRAINT ck_branches__capacity_positive CHECK (capacity IS NULL OR capacity > 0),
  CONSTRAINT ck_branches__state_code_shape  CHECK (state_code ~ '^[A-Z0-9]{2}$')
);

-- GiST. Radius search, nearby, comparison and the approval geo-check — one index, four features
-- (§5.2). The k-NN ordering of `Scalability.md` §6.2 rides the same index.
CREATE INDEX IF NOT EXISTS gix_branches__location ON branches USING gist (location);

CREATE INDEX IF NOT EXISTS idx_branches__city_status ON branches (city_id, status);

-- AC-3. Partial, so a soft-deleted former primary does not occupy the slot forever.
CREATE UNIQUE INDEX IF NOT EXISTS uq_branches__one_primary_per_gym
  ON branches (gym_id) WHERE is_primary AND deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- RLS — P-STD, in this file (R-6, MG10, P9)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE  ROW LEVEL SECURITY;

CREATE POLICY rls_branches__tenant_isolation
    ON branches
    FOR ALL
    TO app_rw, app_append
    USING      (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY rls_branches__platform_read
    ON branches
    FOR SELECT
    TO app_platform_ro
    USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- GRANTS — G-CRUD. No DELETE; `deleted_at` is on the table, and AC-6 makes deactivation a STATUS
-- CHANGE so that a historical read still resolves the branch name and address (`NFR-DQ-04`).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE ON branches TO app_rw;
GRANT SELECT                 ON branches TO app_platform_ro;
