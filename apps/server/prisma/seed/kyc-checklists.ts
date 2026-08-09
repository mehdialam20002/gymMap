/**
 * M-029 · Seed v0.3 — the India KYC checklist, four rows.
 *
 * ┌─ THE PAYLOAD IS A JSON FILE, NOT A LITERAL IN THIS MODULE ───────────────────────────────────┐
 * │ `prisma/reference/kyc_checklists.in.v1.json` holds the checklist; this module only turns it   │
 * │ into SQL. The separation is the point: `FR-ADMN-06` makes the checklist configuration, and    │
 * │ the second market's checklist should be reviewable as a diff of document requirements rather  │
 * │ than as a diff of TypeScript. Somebody who knows Indian document law can read that file; the  │
 * │ same person should not have to read a `.map()` to check it.                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ IDEMPOTENT BY DERIVED ID (P11) ─────────────────────────────────────────────────────────────┐
 * │ Each row's uuid is `seedUuid('kyc_checklist', 'IN:COMPANY:1')`, so re-running the seed is a   │
 * │ no-op via `ON CONFLICT (id) DO NOTHING` rather than a duplicate-key failure or a second set   │
 * │ of checklists. Publishing an EDIT is never a re-run: it is a new version file and a new       │
 * │ derived id, with the old row superseded — an application that snapshotted v1 must keep        │
 * │ reading the v1 it was judged against (`ERD.md` §9.6).                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { seedUuid } from './roles.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every reference payload the seed publishes. A second market appends one line. */
const REFERENCE_FILES = ['kyc_checklists.in.v1.json'] as const;

interface ChecklistFile {
  readonly countryCode: string;
  readonly version: number;
  readonly checklists: readonly {
    readonly entityType: string;
    readonly items: readonly Record<string, unknown>[];
  }[];
}

/** `'` doubled. The payload is repository-controlled, but building SQL by hand without this is a
 *  habit that survives into a place where the input is not. */
function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function loadChecklistFile(name: string): ChecklistFile {
  const path = resolve(HERE, '..', 'reference', name);
  return JSON.parse(readFileSync(path, 'utf8')) as ChecklistFile;
}

export interface SeedChecklistCounts {
  readonly checklists: number;
  readonly items: number;
}

export function seedKycChecklistsSql(): string {
  const lines: string[] = [
    '-- M-029 · kyc_checklists — GLOBAL reference (§C2.3), from prisma/reference/*.json',
    '-- Runs as the migration role. app_rw holds SELECT and nothing else.',
    '',
  ];

  for (const name of REFERENCE_FILES) {
    const file = loadChecklistFile(name);

    for (const checklist of file.checklists) {
      const key = `${file.countryCode}:${checklist.entityType}:${String(file.version)}`;
      const id = seedUuid('kyc_checklist', key);

      /*
       * `items` is stringified as one JSON literal rather than assembled with jsonb_build_array.
       *
       * The database re-parses and re-validates it — every ck_kyc_checklists__items_* constraint
       * runs on this INSERT — so a payload that drifted from the shape the resolver expects fails
       * here, at seed time, rather than on the first applicant who reaches the wizard.
       */
      lines.push(
        `INSERT INTO kyc_checklists (id, country_code, entity_type, version, items)`,
        `VALUES (${quote(id)}, ${quote(file.countryCode)}, ` +
          `${quote(checklist.entityType)}::entity_type_enum, ${String(file.version)}, ` +
          `${quote(JSON.stringify(checklist.items))}::jsonb)`,
        `ON CONFLICT (id) DO NOTHING;`,
        '',
      );
    }
  }

  return lines.join('\n');
}

export const SEED_CHECKLIST_COUNTS: SeedChecklistCounts = (() => {
  let checklists = 0;
  let items = 0;
  for (const name of REFERENCE_FILES) {
    for (const checklist of loadChecklistFile(name).checklists) {
      checklists += 1;
      items += checklist.items.length;
    }
  }
  return { checklists, items };
})();
