-- M-005 · A-28 · Environment ASSERTIONS, run once on an empty data volume.
--
-- ┌─ WHAT THIS FILE DOES AND DELIBERATELY DOES NOT DO ─────────────────────────────────────┐
-- │ It ASSERTS that the container can satisfy the design. It does NOT create extensions.   │
-- │                                                                                         │
-- │ Extensions are created by the `0_init` Prisma migration in M-006 (roadmap ruling R-M1:  │
-- │ "0_init carries the physical foundations only — extensions, domains, the enum           │
-- │ catalogue, the four roles"). If this file created them too, local would get its         │
-- │ extensions from Docker and production would get them from the migration — two different │
-- │ provenances for the same objects, which is precisely the local/production divergence    │
-- │ M-005 exists to eliminate. `CREATE EXTENSION IF NOT EXISTS` in the migration would then  │
-- │ be a silent no-op locally and the only real code path in production, so the migration   │
-- │ would ship having never actually run anywhere.                                          │
-- │                                                                                         │
-- │ Changed from the pre-Phase-8 version of this file, which created them. Safe to change   │
-- │ now: no migration and no table exists yet, so nothing depends on the old behaviour.     │
-- └─────────────────────────────────────────────────────────────────────────────────────────┘
--
-- Runs only on an empty data volume. After `pnpm infra:reset`, it runs again.

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- ASSERTION 1 — the server is PostgreSQL 16. THE TRAP THIS MILESTONE NAMES.
--
-- Several PostGIS images ship an older Postgres than their tag implies, and a mismatch is
-- invisible for months: everything works until a GiST predicate in Indexes.md plans
-- differently, or an NFR-DQ-* guarantee quietly stops holding. By then the schema has been
-- built on the wrong assumption.
--
-- Refusing to start is the cheap failure. A developer sees it in the first thirty seconds.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    major_version int := current_setting('server_version_num')::int / 10000;
BEGIN
    IF major_version <> 16 THEN
        RAISE EXCEPTION
            E'\n\n'
            '  GymMap requires PostgreSQL 16. This container is running PostgreSQL %.\n\n'
            '  The image tag says 16 but the server disagrees — several PostGIS images ship a\n'
            '  different Postgres than their tag suggests.\n\n'
            '  This matters because Indexes.md GiST predicates and the NFR-DQ-* guarantees are\n'
            '  written against 16''s planner. A mismatch does not fail here; it fails months\n'
            '  later as an unexplained planner regression.\n\n'
            '  Fix the image digest in infra/compose/compose.yaml, then: pnpm infra:reset\n',
            major_version;
    END IF;
    RAISE NOTICE 'PostgreSQL major version 16 confirmed.';
END
$$;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- ASSERTION 2 — every extension `0_init` will require is AVAILABLE in this image.
--
-- Available, not installed. M-006's migration installs them. Checking availability here means
-- a missing extension is caught at `infra:up` — before anyone has written a migration against
-- it — rather than at the first `prisma migrate deploy`.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    required text[] := ARRAY[
        'postgis',             -- §C1.1 geospatial. "gyms near me" is a core discovery path.
        'pg_trgm',             -- §C1.1 fuzzy matching. No search cluster at launch (ADR-0007).
        'unaccent',            -- "Andheri" must match "Andhéri".
        'btree_gin',           -- Composite GIN indexes over the search document.
        'btree_gist',          -- Exclusion constraints — BR-PLN-07 overlapping promotions.
        'pgcrypto',            -- digest() without an application round trip.
        'pg_stat_statements'   -- Local parity with Monitoring.md. Makes an N+1 measurable.
    ];
    missing text[];
BEGIN
    SELECT array_agg(name ORDER BY name) INTO missing
    FROM unnest(required) AS name
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_available_extensions AS ae WHERE ae.name = unnest.name
    );

    IF missing IS NOT NULL THEN
        RAISE EXCEPTION
            E'\n\n'
            '  This Postgres image cannot provide: %\n\n'
            '  These are required by the 0_init migration (M-006). The image in\n'
            '  infra/compose/compose.yaml is wrong or incomplete.\n',
            array_to_string(missing, ', ');
    END IF;
    RAISE NOTICE 'All % required extensions are available.', array_length(required, 1);
END
$$;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Database-level settings. Not schema — these are properties of the container.
--
-- UTC storage is absolute. India is UTC+05:30 with no DST, so the local day boundary is 18:30
-- UTC the previous day, and the financial year rolls at 18:30 UTC on 31 March. Storing
-- anything but UTC makes every one of those calculations depend on a server setting.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
ALTER DATABASE gymmap SET timezone TO 'UTC';

-- Deterministic ordering, matching POSTGRES_INITDB_ARGS --locale=C. An index whose order
-- depends on the host locale is an index that sorts differently on a developer's machine than
-- in CI, which surfaces as a flaky pagination test nobody can reproduce.
ALTER DATABASE gymmap SET lc_collate TO 'C';
ALTER DATABASE gymmap SET lc_ctype TO 'C';
