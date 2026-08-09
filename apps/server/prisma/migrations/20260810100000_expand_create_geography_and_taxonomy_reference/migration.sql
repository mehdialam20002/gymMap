-- migration: 20260810100000_expand_create_geography_and_taxonomy_reference
-- phase:            expand                     -- MG3
-- requirement:      M-031, NFR-DQ-06, FR-SRCH-03, Schema.md §12.1, §12.2, §C2.3, ADR-0007,
--                   ADR-0028, KL-103, KL-111
-- tables:           countries, cities, localities, gym_categories, amenities
-- rls:              NONE — all five are GLOBAL platform reference on the CLOSED exemption list
--                   of Schema.md §1.3. RLS on a table with no tenant_id has nothing to key on
-- grants:           G-REF — SELECT to app_rw and app_platform_ro. No INSERT/UPDATE for anybody
--                   yet; the FR-ADMN-05/06 audited write path is M-116. See THE GRANT below
-- append_only:      not append-only by class, but no write grant exists, so it is one in practice
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE on five tables that do not exist yet
-- rewrite:          none
-- est_duration:     < 80 ms                                               -- MG11
-- backfill_job:     none. The five tables are created empty; SeedStrategy.md §3 owns their rows
-- rollback:         FREE. DROP in reverse dependency order: localities, cities, countries are a
--                   chain; gym_categories and amenities are independent
-- concurrent_steps: none. The two GiST indexes are built on empty tables, where CONCURRENTLY buys
--                   nothing and costs a second transaction (MG4 applies to populated tables)
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Schema.md §12.1, §12.2, §1.3 exemption list, §2.7 G-REF, ERD.md §12.6
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- M-031 · The five reference tables the catalogue's foreign keys point at.
--
-- ┌─ NO MILESTONE OWNS THESE, AND M-031 CANNOT BE BUILT WITHOUT THEM ────────────────────────────┐
-- │ `Schema.md` §5.1 and §5.2 give `gyms` and `branches` six foreign keys into platform reference │
-- │ data: `fk_gyms__cities`, `fk_gyms__gym_categories`, `fk_branches__cities`,                     │
-- │ `fk_branches__localities`, `fk_branches__countries`, and `gym_amenities.amenity_id`.           │
-- │                                                                                              │
-- │ None of the five targets exists. Searching the whole roadmap for a milestone that creates      │
-- │ `cities`, `countries`, `localities`, `gym_categories` or `amenities` returns M-031, M-032 and  │
-- │ M-036 — all three CONSUMERS. `KL-103` already recorded half of this from the other side, when  │
-- │ `kyc_checklists` could not carry `fk_kyc_checklists__countries` because `countries` was not    │
-- │ there. This is an ordering gap in the plan, recorded as `KL-111`.                              │
-- │                                                                                              │
-- │ The alternative was `city_id uuid` with no foreign key. `NFR-DQ-06` forbids it in as many      │
-- │ words: *"Reference data is platform-managed with stable identifiers; free-text alternatives    │
-- │ are not offered where filtering depends on the value."* A uuid nothing points at IS the        │
-- │ free-text alternative, with the type system's blessing — every city filter, every landing      │
-- │ page and every place-of-supply calculation would rest on a value no constraint checks.         │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ WHY THERE IS NO RLS HERE, AND WHY THAT IS NOT AN OMISSION ──────────────────────────────────┐
-- │ Every other table this project has built carries `ENABLE` + `FORCE ROW LEVEL SECURITY` and a  │
-- │ policy pair. These five do not, and the reason is that RLS is the WRONG CONTROL rather than a  │
-- │ control that was skipped: a policy keys off `tenant_id`, and there is no `tenant_id` to key    │
-- │ off. Bengaluru is not owned by a gym.                                                          │
-- │                                                                                              │
-- │ `Schema.md` §1.3 makes this reviewable rather than a judgement call — the exemption list is    │
-- │ CLOSED and all five appear on it by name, and `RS4` says *"adding to it requires the same      │
-- │ scrutiny as a new elevation."* The `ci:isolation-coverage` gate diffs the tables it finds      │
-- │ against that committed list, so a sixth exempt table cannot be added quietly.                  │
-- │                                                                                              │
-- │ The control that DOES apply is the grant, below.                                              │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 12.1 GEOGRAPHY — countries, cities, localities
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS countries (
  id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     country_code NOT NULL,
  name                     text         NOT NULL,
  default_currency         currency_code NOT NULL,
  calling_code             text         NOT NULL,

  -- Nullable FKs added by a later migration: `tax_profiles` does not exist, and
  -- `kyc_checklists` does — but pointing at it here would invert the direction KL-103 already
  -- describes. Both land together when `tax_profiles` does. ADR-0028.
  default_tax_profile_id   uuid,
  default_kyc_checklist_id uuid,

  /*
   * India is 4, and this column exists because the tax profile might not.
   *
   * `ERD.md` §12.6 denormalises the financial-year start onto the country for the case where a
   * country has been added but has no tax profile yet — which is exactly the state every country
   * is in today, `tax_profiles` being unbuilt. Reading the FY start through a NULL FK would give
   * January for India and put every financial report a quarter out.
   */
  fy_start_month           smallint     NOT NULL DEFAULT 1,

  is_active                boolean      NOT NULL DEFAULT false,
  created_at               timestamptz  NOT NULL DEFAULT now(),
  updated_at               timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT ck_countries__fy_start_month CHECK (fy_start_month BETWEEN 1 AND 12)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_countries__code ON countries (code);

CREATE TABLE IF NOT EXISTS cities (
  id           uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code country_code           NOT NULL,
  name         text                   NOT NULL,
  slug         slug                   NOT NULL,

  -- `geography`, never `geometry` — ADR-0007 and the §5.2 note. `ST_Distance(geometry, …)`
  -- returns DEGREES, which is a plausible-looking number and a wrong one.
  centroid     geography(Point, 4326) NOT NULL,

  status       city_status_enum       NOT NULL DEFAULT 'PLANNED',

  /*
   * Presentation default, and NEVER authoritative — `TM3`.
   *
   * The tenant's own timezone decides when a day starts for a check-in or a settlement. This is
   * what a map centres on and what an unauthenticated visitor's "open now" is guessed against.
   */
  timezone     iana_timezone          NOT NULL,
  created_at   timestamptz            NOT NULL DEFAULT now(),
  updated_at   timestamptz            NOT NULL DEFAULT now(),

  CONSTRAINT fk_cities__countries FOREIGN KEY (country_code) REFERENCES countries (code)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cities__country_slug ON cities (country_code, slug);
CREATE INDEX IF NOT EXISTS gix_cities__centroid ON cities USING gist (centroid);

CREATE TABLE IF NOT EXISTS localities (
  id         uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id    uuid                   NOT NULL,
  name       text                   NOT NULL,
  slug       slug                   NOT NULL,
  centroid   geography(Point, 4326),
  created_at timestamptz            NOT NULL DEFAULT now(),
  updated_at timestamptz            NOT NULL DEFAULT now(),

  CONSTRAINT fk_localities__cities FOREIGN KEY (city_id) REFERENCES cities (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_localities__city_slug ON localities (city_id, slug);
CREATE INDEX IF NOT EXISTS gix_localities__centroid ON localities USING gist (centroid);

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 12.2 TAXONOMY — gym_categories, amenities
--
-- `reason_codes` and `help_articles` share this section of `Schema.md` and are deliberately NOT
-- created here. `reason_codes` carries `fk_reason_codes__help_articles` and a CI rule that diffs
-- its rows against the five §C4.8 enum catalogues; neither belongs in a migration whose subject is
-- the catalogue's foreign keys. Scope kept to what M-031 cannot proceed without.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gym_categories (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  /*
   * `key` is the STABLE IDENTIFIER of `NFR-DQ-06`, and it is a different thing from the uuid.
   *
   * §12's own definition: *"a `uuid` primary key that never changes, and a human-stable
   * `code`/`key` that is unique, never re-pointed, and only ever retired — never reused for a
   * different meaning."* The uuid is what rows point at; the key is what a seed file, a filter
   * URL and a support conversation can say out loud.
   */
  key        text        NOT NULL,
  name       text        NOT NULL,
  slug       slug        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gym_categories__key ON gym_categories (key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gym_categories__slug ON gym_categories (slug);

CREATE TABLE IF NOT EXISTS amenities (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text        NOT NULL,
  name          text        NOT NULL,
  icon          text        NOT NULL,
  display_group text        NOT NULL,

  /*
   * Retired, never deleted — `NFR-DQ-06`.
   *
   * A deleted amenity takes its meaning with it: every gym that declared "steam room" would lose
   * the claim retroactively, and a member who filtered on it last week would get different
   * results for the same search with no explanation. `is_active = false` hides it from the picker
   * and leaves every historical declaration readable.
   */
  is_active     boolean     NOT NULL DEFAULT true,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_amenities__key ON amenities (key);

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- THE GRANT — G-REF, minus the write half, and the missing half is the point
--
-- `Schema.md` §2.7 defines G-REF as *"`SELECT` only to `app_rw`; `SELECT, INSERT, UPDATE` to the
-- `admin/` path, which also runs as `app_rw` but is gated by permission and reason"*.
--
-- That second clause cannot be expressed as a grant. `admin/` connects as the SAME role as every
-- other request — the separation is a permission check and an audited reason at `L6-UC`, not a
-- database privilege. So granting `INSERT, UPDATE` to `app_rw` today would hand the write to every
-- request in the system and rely entirely on application code to hold it back, which is the exact
-- shape §2.7 opens by rejecting: *"a grant is the only control that holds when the application is
-- the attacker"*.
--
-- The reference-data write path is `FR-ADMN-05`/`FR-ADMN-06` and arrives at **M-116**, along with
-- the audited reason it requires. Until then these five tables are read-only to the application
-- and written only by the migration role, which is a smaller surface than the specification asks
-- for rather than a larger one.
--
-- Same shape as `kyc_checklists` (BLK-15), and for a related reason.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

GRANT SELECT ON countries, cities, localities, gym_categories, amenities
  TO app_rw, app_platform_ro;
