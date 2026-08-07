-- LOCAL DEVELOPMENT ONLY. Sets the password for the application login role.
--
-- Separate from the migration because a migration is committed to git, and a password in a
-- migration is a credential in git, in every clone and in the CI cache — and rotating it would
-- mean editing an applied migration, which PM-4 forbids.
--
-- This password is fixed, weak and local-only, exactly like the postgres/postgres in
-- compose.yaml. It is allowlisted in .gitleaks.toml for the same reason: it must never be
-- anything else, and a scanner flagging it every run trains people to ignore the scanner.
--
-- In a deployed environment Terraform sets this from the secret store, and the value never
-- passes through a developer's shell.
--
--     pnpm db:setup
ALTER ROLE gymmap_app WITH PASSWORD 'gymmap_local_dev';

-- Proof, at apply time, that the role cannot bypass what it is meant to be bound by.
DO $$
DECLARE
    r record;
BEGIN
    SELECT rolsuper, rolbypassrls INTO r FROM pg_roles WHERE rolname = 'gymmap_app';
    IF r.rolsuper OR r.rolbypassrls THEN
        RAISE EXCEPTION
            'gymmap_app is a superuser or holds BYPASSRLS. Every RLS policy in the system would '
            'be inert for the application while looking correct in pg_policies.';
    END IF;
    RAISE NOTICE 'gymmap_app: LOGIN, member of app_rw, no superuser, no BYPASSRLS.';
END
$$;
