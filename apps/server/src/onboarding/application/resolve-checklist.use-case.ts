/**
 * `M-029` · The checklist this applicant actually has to satisfy — `FR-ONB-03`, `AC-ONB-04.1`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE ORCHESTRATION IS THIN BECAUSE THE HARD PART IS A PURE FUNCTION
 *
 * Fetch the live checklist, fetch the applicant's facts, hand both to `resolveChecklist`. Every
 * decision worth arguing about — that an unanswered declaration is its own state, that advisory
 * items are reported and never blocking, that an unknown condition operator throws — lives in
 * `domain/checklist.ts` where it is testable without a database.
 *
 * ┌─ WHY THE VERSION IS RETURNED AND NOT JUST THE ITEMS ──────────────────────────────────────────┐
 * │ `ERD.md` §9.6: an application records WHICH checklist version it was submitted against, so     │
 * │ that publishing a stricter version in March does not retroactively make every February         │
 * │ application incomplete. The caller cannot record what this use case does not return, so the    │
 * │ version travels with the result rather than being fetched again later — refetching would race  │
 * │ against a version published in between and snapshot a checklist the applicant never saw.       │
 * └────────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { Inject, Injectable } from '@nestjs/common';

import { BusinessRuleException } from '../../common/errors/domain-exception.js';
import { currentTenantContext } from '../../tenancy/context/tenant-context.als.js';
import { MissingTenantContextError } from '../../tenancy/domain/tenancy.errors.js';
import {
  checklistCompleteness,
  resolveChecklist,
  type ApplicantFacts,
  type ChecklistCompleteness,
  type ChecklistItem,
  type ResolvedItem,
} from '../domain/checklist.js';

export interface LiveChecklist {
  readonly id: string;
  readonly version: number;
  readonly items: readonly ChecklistItem[];
}

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
  applicantFacts(): Promise<
    (ApplicantFacts & { readonly countryCode: string; readonly entityType: string }) | null
  >;
}

export const CHECKLIST_STORE = Symbol('CHECKLIST_STORE');

export interface ResolveChecklistResult {
  readonly checklistId: string;
  readonly version: number;
  readonly items: readonly ResolvedItem[];
  readonly completeness: ChecklistCompleteness;
}

@Injectable()
export class ResolveChecklistUseCase {
  constructor(@Inject(CHECKLIST_STORE) private readonly store: ChecklistStore) {}

  /**
   * @param suppliedDocumentTypes the document types already uploaded against this application.
   *   Passed in rather than fetched here so that the caller decides whether a `REJECTED` upload
   *   counts as supplied — it does not, and that judgement belongs where the statuses are known.
   */
  async execute(suppliedDocumentTypes: readonly string[]): Promise<ResolveChecklistResult> {
    const context = currentTenantContext();
    if (context.kind !== 'TENANT') {
      throw new MissingTenantContextError('KycChecklist', 'resolve');
    }

    const facts = await this.store.applicantFacts();
    if (facts === null) {
      throw new MissingTenantContextError('KycChecklist', 'resolve');
    }

    const checklist = await this.store.liveChecklist(facts.countryCode, facts.entityType);
    if (checklist === null) {
      /*
       * No published checklist for this market and entity form.
       *
       * Refused rather than resolved as an empty list. An empty checklist reads as "you owe
       * nothing", the application would be document-complete on submission, and a gym in an
       * unlaunched country would reach a reviewer with no documents at all and nothing anywhere
       * saying why. `BR-GYM-01` — verification before visibility — cannot be satisfied by a
       * checklist that does not exist.
       */
      throw new BusinessRuleException(
        'KYC_CHECKLIST_NOT_PUBLISHED',
        `No live KYC checklist is published for country ${facts.countryCode} and entity type ` +
          `${facts.entityType}. An application cannot be assessed against a checklist that does ` +
          `not exist.`,
      );
    }

    const items = resolveChecklist(checklist.items, facts);

    return {
      checklistId: checklist.id,
      version: checklist.version,
      items,
      completeness: checklistCompleteness(items, suppliedDocumentTypes),
    };
  }
}
