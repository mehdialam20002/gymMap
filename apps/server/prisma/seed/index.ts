/**
 * M-006 · The seed. Deliberately EMPTY at 0.1 (R-M2).
 *
 * `0_init` creates no tables, so there is nothing to seed. The file exists now rather than
 * later because `pnpm infra:reset` must have a stable command to call from the day the reset
 * script is written — adding the hook later means every developer's muscle memory is wrong
 * for one release.
 *
 * The v0.1 payload — three tenants — arrives with M-009, which creates the first table.
 */
import { SEED_VERSION } from './version.js';

async function main(): Promise<void> {
  console.log(`seed ${SEED_VERSION}: no payload — 0_init creates no tables (R-M1, R-M2).`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
