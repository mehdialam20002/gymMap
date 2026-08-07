/**
 * M-019 · "no database" and "cannot authenticate" are DIFFERENT ANSWERS.
 *
 * ┌─ TWENTY CONTROL TESTS STOPPED RUNNING AND THE SUITE PRINTED `fail 0` ───────────────────────┐
 * │ `pnpm infra:reset` destroys the volume. The migrations recreate `gymmap_platform` and       │
 * │ `gymmap_audit` with LOGIN and no password, and `set-local-role-password.sql` set only       │
 * │ `gymmap_app`'s. So neither role could connect.                                              │
 * │                                                                                              │
 * │ Every spec had the same `try { connect } catch { available = false }` shape, and every one  │
 * │ of them called that outcome "no database". The whole of `platform-elevation.int-spec.ts`    │
 * │ and most of `audit-grants.int-spec.ts` reported **SKIP**. `runElevated()`'s audit-before-   │
 * │ work ordering, the PE-T5 refusals, the append-only grant on `audit_log` — none of it ran,   │
 * │ and the run still said `fail 0`.                                                             │
 * │                                                                                              │
 * │ A control that silently stops running is worse than one that was never written: the green   │
 * │ tick becomes evidence for a claim nobody is checking any more.                               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The distinction this module draws:
 *
 *   NO DATABASE AT ALL      A legitimate skip. A developer without Docker running should be able
 *                           to run `pnpm test:unit` and the isolation suites without 200 red
 *                           tests telling them nothing they did not already know.
 *
 *   DATABASE UP, ROLE OUT   A hard FAILURE. The environment is half-provisioned, which is a
 *                           misconfiguration — and it is precisely the state in which a skip is
 *                           indistinguishable from a pass.
 */

import { execFileSync } from 'node:child_process';

const CONTAINER = 'gymmap-postgres';
const DB = 'gymmap';

/** Is PostgreSQL reachable at all, as the superuser the container ships with? */
export function databaseIsUp(): boolean {
  try {
    execFileSync(
      'docker',
      ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', DB, '-tAc', 'SELECT 1'],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a spec's availability, and THROWS when the database is up and the connection is not.
 *
 * @param connect  Attempts the role-specific connection. Throws on failure.
 * @param role     The login role being reached, for the message.
 */
export async function requireRole(
  role: string,
  connect: () => Promise<void>,
): Promise<{ available: boolean }> {
  let connectionError: unknown;
  try {
    await connect();
    return { available: true };
  } catch (error) {
    connectionError = error;
  }

  if (!databaseIsUp()) {
    console.error(
      `\n  SKIPPING — PostgreSQL is not running.\n` +
        `    pnpm infra:up && pnpm --filter @gymmap/server db:setup\n`,
    );
    return { available: false };
  }

  // The database IS up. A skip here would hide a misconfiguration behind a green run.
  const detail =
    connectionError instanceof Error
      ? (connectionError.message.split('\n')[0] ?? String(connectionError))
      : String(connectionError);

  throw new Error(
    `PostgreSQL is running but this suite cannot connect as "${role}".\n\n` +
      `  ${detail}\n\n` +
      `This is a FAILURE and not a skip, deliberately. Every assertion below would otherwise ` +
      `report SKIP while the run printed "fail 0" — which is what happened after ` +
      `pnpm infra:reset destroyed the volume and only gymmap_app's password was restored.\n\n` +
      `  pnpm --filter @gymmap/server db:setup\n\n` +
      `provisions all three login roles. If "${role}" is genuinely meant not to exist, the ` +
      `suite that depends on it needs deleting, not skipping.`,
  );
}

/**
 * The synchronous form, for suites that reach the database through `psql` rather than a client.
 *
 * @param probe  Runs the role-specific probe. Returns false on failure.
 */
export function requireRoleSync(role: string, probe: () => boolean): { available: boolean } {
  if (probe()) return { available: true };

  if (!databaseIsUp()) {
    console.error(
      `\n  SKIPPING — PostgreSQL is not running.\n` +
        `    pnpm infra:up && pnpm --filter @gymmap/server db:setup\n`,
    );
    return { available: false };
  }

  throw new Error(
    `PostgreSQL is running but this suite cannot connect as "${role}". This is a FAILURE and ` +
      `not a skip — see test/isolation/_availability.ts. Run: ` +
      `pnpm --filter @gymmap/server db:setup`,
  );
}
