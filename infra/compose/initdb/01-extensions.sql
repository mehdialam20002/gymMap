-- A-28 · Extensions required by the design, created once at first container start.
--
-- This is environment provisioning, not schema. No table, column, index or RLS
-- policy is created here — those are Prisma migrations (A-07) and belong to
-- Phase 8. Prisma cannot create extensions it does not own, so they must exist
-- before the first migration runs.
--
-- Runs only on an empty data volume. After `pnpm infra:reset`, it runs again.

-- Geospatial. §C1.1 names PostGIS; "gyms near me" is a core discovery path.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Search. §C1.1: "Postgres full-text + trigram; OpenSearch only past ~50k
-- listings." pg_trgm powers fuzzy gym/city matching; unaccent normalises
-- diacritics so a search for "Andheri" matches "Andhéri".
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Identifiers and hashing. gen_random_uuid() and digest() without a
-- application round-trip.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Query performance visibility. Local parity with the production monitoring
-- story (Monitoring.md); makes an accidental N+1 measurable rather than felt.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Deterministic ordering, matching POSTGRES_INITDB_ARGS --locale=C.
ALTER DATABASE gymmap SET timezone TO 'UTC';
