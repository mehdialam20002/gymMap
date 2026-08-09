/**
 * `M-029` · The port the checklist resolver depends on — `FR-ONB-03`, `§8.1` row 7.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS FILE EXISTS BECAUSE §8.1 SAYS "DEPENDENCIES ARE PORTS, NOT CLASSES"
 *
 * The interface below was originally declared inside `resolve-checklist.use-case.ts`. That
 * compiled, bound correctly, and was wrong for a reason a compiler cannot see: a use case that
 * declares its own dependency's shape invites the next one to depend on the Prisma class instead,
 * because there is no obvious place a port is supposed to live.
 *
 * `module-structure` enforces the directory. It caught this only when the meta-gate
 * `deliberate-violations` ran the check inside a fresh COPY of the repository — `application/ports`
 * existed on disk as an empty directory, git does not track empty directories, and the gate
 * therefore passed on the author's machine and would have failed on a fresh clone.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { ApplicantFacts, ChecklistItem } from '../../domain/checklist.js';

export interface LiveChecklist {
  readonly id: string;
  readonly version: number;
  readonly items: readonly ChecklistItem[];
}

/** The applicant's own facts, plus what decides WHICH checklist applies to them. */
export type ApplicantProfile = ApplicantFacts & {
  readonly countryCode: string;
  readonly entityType: string;
};

/**
 * ┌─ NO `tenantId` PARAMETER ANYWHERE ON THIS PORT ────────────────────────────────────────────────┐
 * │ §11.5 `BR5`, enforced by `gymmap/no-tenant-id-parameter`. `applicantFacts()` takes nothing and  │
 * │ reads the tenant from the request context; `liveChecklist()` takes a country and an entity      │
 * │ type, which are properties of the market and the business form, not identifiers of a tenant.    │
 * └─────────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export interface ChecklistStore {
  /**
   * The one live version, or `null` if this country and entity type have no published checklist.
   *
   * "The one" is a database guarantee, not a convention:
   * `uq_kyc_checklists__one_live_per_entity_type` is a partial unique index on
   * `(country_code, entity_type) WHERE superseded_at IS NULL`, so two live rows cannot exist and
   * this cannot silently return whichever the planner reached first.
   */
  liveChecklist(countryCode: string, entityType: string): Promise<LiveChecklist | null>;

  /** The applicant's own facts, read from the tenant in the ambient request context. */
  applicantFacts(): Promise<ApplicantProfile | null>;
}

export const CHECKLIST_STORE = Symbol('CHECKLIST_STORE');
