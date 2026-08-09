/**
 * `M-029` · `kyc_checklists` on Prisma — `FR-ONB-03`, `Schema.md` §12.3.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * TWO READS FROM TWO DIFFERENT WORLDS, IN ONE REPOSITORY
 *
 * `liveChecklist()` reads GLOBAL reference data. `KycChecklist` is in `GLOBAL_MODELS`, so the tenant
 * extension does not wrap it in a scoped transaction, and there is no tenant to scope it to — the
 * Indian checklist is the same for every gym.
 *
 * `applicantFacts()` reads the tenant's OWN row, which is tenant-owned with RLS enabled and forced.
 * It filters by nothing, and that is correct rather than an omission: the policy on `tenants` is the
 * filter, and a hand-written `where` would be a second, weaker copy of it. §11.5 `BR5` and the
 * `gymmap/no-tenant-id-parameter` rule are why neither method takes an id.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import { currentTenantContext } from '../../tenancy/context/tenant-context.als.js';
import { MissingTenantContextError } from '../../tenancy/domain/tenancy.errors.js';
import type { ApplicantFacts } from '../domain/checklist.js';
import type { ChecklistStore, LiveChecklist } from '../application/resolve-checklist.use-case.js';
import { parseChecklistItems } from '../domain/checklist-items.parser.js';

/**
 * Where the applicant's declared answers live.
 *
 * `applications.snapshot` is the frozen claim, and the declarations belong to it: the answer to
 * "does your municipality require a trade licence?" is part of what was claimed at submission and
 * must stay readable beside the rest of it. Reading them from anywhere else would let a declaration
 * change after submission without the snapshot changing, which `BR-GYM-05` forbids in substance.
 */
const DECLARATIONS_KEY = 'declarations';

@Injectable()
export class KycChecklistPrismaRepository implements ChecklistStore {
  constructor(private readonly db: PrismaService) {}

  async liveChecklist(countryCode: string, entityType: string): Promise<LiveChecklist | null> {
    /*
     * `findFirst` on a condition the database guarantees is unique.
     *
     * `uq_kyc_checklists__one_live_per_entity_type` is a PARTIAL unique index — over
     * `(country_code, entity_type) WHERE superseded_at IS NULL` — and Prisma cannot express a
     * partial unique in `findUnique`. So the singularity is enforced one layer down rather than
     * here, which is the stronger place for it: a second live row cannot be inserted at all.
     */
    const row = await this.db.client.kycChecklist.findFirst({
      where: {
        countryCode,
        entityType: entityType as never,
        supersededAt: null,
      },
      select: { id: true, version: true, items: true },
    });

    if (row === null) return null;

    return {
      id: row.id,
      version: row.version,
      // Parsed rather than cast. `items` is JSONB and Prisma types it as `JsonValue`; asserting the
      // shape would move a data error into a `TypeError` three frames away from the bad row.
      items: parseChecklistItems(row.items, `kyc_checklists.${row.id}`),
    };
  }

  async applicantFacts(): Promise<
    (ApplicantFacts & { readonly countryCode: string; readonly entityType: string }) | null
  > {
    const context = currentTenantContext();
    if (context.kind !== 'TENANT') {
      throw new MissingTenantContextError('Tenant', 'applicantFacts');
    }

    const tenant = await this.db.client.tenant.findFirst({
      select: { countryCode: true, entityType: true, taxRegistrationStatus: true },
    });
    if (tenant === null) return null;

    /*
     * The declarations come from the LATEST application version rather than from the tenant.
     *
     * A tenant re-submitting after a rejection may answer differently — they discovered their
     * municipality does require a trade licence. The checklist must resolve against what they
     * claimed THIS time, and the previous version keeps its own answers for the reviewer who reads
     * it later.
     */
    const latest = await this.db.client.application.findFirst({
      orderBy: { version: 'desc' },
      select: { snapshot: true },
    });

    return {
      countryCode: tenant.countryCode,
      entityType: tenant.entityType,
      taxRegistrationStatus: tenant.taxRegistrationStatus,
      declarations: readDeclarations(latest?.snapshot),
    };
  }
}

/**
 * Pull the declarations out of a snapshot, keeping only genuine booleans.
 *
 * ┌─ A NON-BOOLEAN IS DROPPED, NOT COERCED ───────────────────────────────────────────────────────┐
 * │ `"false"`, `0` and `null` are all falsy, and coercing any of them to `false` would answer a    │
 * │ question the applicant never answered — turning a required document into a silently omitted    │
 * │ one, which is the exact failure `AWAITING_DECLARATION` exists to prevent. Dropping the key      │
 * │ instead leaves it unanswered, and unanswered blocks.                                            │
 * └────────────────────────────────────────────────────────────────────────────────────────────────┘
 */
function readDeclarations(snapshot: unknown): Record<string, boolean> {
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) return {};

  const raw = (snapshot as Record<string, unknown>)[DECLARATIONS_KEY];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};

  const answers: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'boolean') answers[key] = value;
  }
  return answers;
}
