-- LOCAL DEVELOPMENT ONLY. Sets the password for all THREE application login roles.
--
-- Separate from the migrations because a migration is committed to git, and a password in a
-- migration is a credential in git, in every clone and in the CI cache — and rotating it would
-- mean editing an applied migration, which PM-4 forbids.
--
-- This password is fixed, weak and local-only, exactly like the postgres/postgres in
-- compose.yaml. It is allowlisted in .gitleaks.toml for the same reason: it must never be
-- anything else, and a scanner flagging it every run trains people to ignore the scanner.
--
-- In a deployed environment Terraform sets each of these from the secret store, and the value
-- never passes through a developer's shell.
--
--     pnpm --filter @gymmap/server db:setup
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- ALL THREE, NOT JUST `gymmap_app` — M-019 FOUND THIS THE BAD WAY
--
-- This file set one password. `gymmap_platform` and `gymmap_audit` are created by migrations
-- 20260807010000 and 20260807050000 with LOGIN and no password, so after `pnpm infra:reset`
-- destroyed the volume, neither could authenticate.
--
-- The consequence was not a failing suite. It was **20 isolation tests reporting SKIP** — the
-- whole of `platform-elevation.int-spec.ts` and most of `audit-grants.int-spec.ts` — while the
-- run still printed `fail 0`. Every control over `runElevated()`, over the audit writer's
-- append-only grant and over the PE-T5 refusals stopped executing, and nothing said so.
--
-- A control that silently stops running is worse than one that was never written, because the
-- green tick is now evidence for a claim nobody is checking. The specs were changed at the same
-- time to FAIL rather than skip when the database is up and only the role cannot connect.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER ROLE gymmap_app      WITH PASSWORD 'gymmap_local_dev';
ALTER ROLE gymmap_audit    WITH PASSWORD 'gymmap_local_dev';
ALTER ROLE gymmap_platform WITH PASSWORD 'gymmap_local_dev';

-- Proof, at apply time, that none of the three can bypass what it is meant to be bound by, and
-- that each reaches EXACTLY the group role it is supposed to.
--
-- The membership check is not decoration. RLS policies are PERMISSIVE and OR together, so a
-- login role in two groups gets the union of both — `gymmap_platform` added to `app_rw` would
-- silently acquire write access across every tenant, and `pg_policies` would look unchanged.
DO $$
DECLARE
    expected constant text[][] := ARRAY[
        ARRAY['gymmap_app',      'app_rw'],
        ARRAY['gymmap_audit',    'app_append'],
        ARRAY['gymmap_platform', 'app_platform_ro']
    ];
    login_role  text;
    group_role  text;
    r           record;
    memberships text;
BEGIN
    FOR i IN 1 .. array_length(expected, 1) LOOP
        login_role := expected[i][1];
        group_role := expected[i][2];

        SELECT rolsuper, rolbypassrls, rolcanlogin INTO r
          FROM pg_roles WHERE rolname = login_role;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                '% does not exist. Run `prisma migrate deploy` before this script.', login_role;
        END IF;

        IF r.rolsuper OR r.rolbypassrls THEN
            RAISE EXCEPTION
                '% is a superuser or holds BYPASSRLS. Every RLS policy in the system would be '
                'inert for it while looking correct in pg_policies.', login_role;
        END IF;

        IF NOT r.rolcanlogin THEN
            RAISE EXCEPTION '% cannot LOGIN, so nothing can connect as it.', login_role;
        END IF;

        SELECT string_agg(b.rolname, ',' ORDER BY b.rolname) INTO memberships
          FROM pg_auth_members m
          JOIN pg_roles b ON b.oid = m.roleid
          JOIN pg_roles l ON l.oid = m.member
         WHERE l.rolname = login_role;

        IF memberships IS DISTINCT FROM group_role THEN
            RAISE EXCEPTION
                '% reaches [%], expected exactly [%]. Membership is EXCLUSIVE: RLS policies are '
                'permissive and OR together, so a role in two groups gets the union of both.',
                login_role, coalesce(memberships, 'nothing'), group_role;
        END IF;

        RAISE NOTICE '%: LOGIN, member of % only, no superuser, no BYPASSRLS.',
            login_role, group_role;
    END LOOP;
END
$$;
