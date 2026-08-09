/**
 * `M-029` · Resolving a checklist against one applicant — `FR-ONB-03`, `AC-ONB-04.1`, `AC-ONB-04.2`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * "WHICH DOCUMENTS DO I STILL OWE" HAS FOUR ANSWERS, NOT TWO
 *
 * The seed carries three obligations — `ALWAYS`, `CONDITIONAL`, `ADVISORY`. Resolving them against a
 * particular applicant produces a fourth state that neither the seed nor a boolean can express:
 *
 *   `REQUIRED`              upload it, and approval waits on it
 *   `NOT_REQUIRED`          the condition is false for you; it is not shown as outstanding
 *   `ADVISORY`              requested, flagged, and NEVER blocking — the music licence
 *   `AWAITING_DECLARATION`  we cannot tell yet, because you have not answered the question
 *
 * ┌─ THE FOURTH STATE IS THE WHOLE POINT OF THIS FILE ────────────────────────────────────────────┐
 * │ "Does your municipality require a trade licence?" is a fact the platform does not know and     │
 * │ cannot look up. Until the applicant answers, the condition has no truth value, and both        │
 * │ defaults are wrong in a way nobody would notice:                                                │
 * │                                                                                                │
 * │   · default false → the document silently disappears from the checklist. The gym is approved   │
 * │     without a licence it legally needed, and the platform listed it                             │
 * │   · default true  → every applicant is asked for a document most of them do not need, and the  │
 * │     ones who cannot produce it are stuck with no way forward                                    │
 * │                                                                                                │
 * │ So an unanswered question is its own state and it BLOCKS completeness — the same shape as       │
 * │ `material-field.policy.ts`, where "unclassified" is material rather than assumed harmless.      │
 * └────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `LAUNCH_MARKET_INDIA.md` §13 and `Gym.md` `O-TEN-4` are why the conditions are phrased as
 * declarations at all: the GSTIN registration threshold and the fire-safety floor area are legal
 * facts awaiting professional advice, and the specification *"states the structure and refuses to
 * state the threshold"*. This file refuses too.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** The obligation as the seed states it, before any applicant is considered. */
export type Obligation = 'ALWAYS' | 'CONDITIONAL' | 'ADVISORY';

/** The obligation as it applies to one applicant. */
export type ResolvedObligation = 'REQUIRED' | 'NOT_REQUIRED' | 'ADVISORY' | 'AWAITING_DECLARATION';

export interface ChecklistItem {
  readonly documentType: string;
  readonly obligation: Obligation;
  readonly displayOrder: number;
  readonly label: string;
  readonly helpText?: string;
  readonly acceptedDocuments?: readonly string[];
  readonly condition?: Readonly<Record<string, unknown>>;
}

/**
 * What the platform knows about this applicant.
 *
 * `declarations` is deliberately a sparse map rather than a record with a value for every key: an
 * ABSENT declaration and a declaration answered `false` are different states, and collapsing them
 * is exactly the bug the fourth resolved state exists to prevent.
 */
export interface ApplicantFacts {
  readonly taxRegistrationStatus: string;
  readonly declarations: Readonly<Record<string, boolean | undefined>>;
}

export interface ResolvedItem extends ChecklistItem {
  readonly resolved: ResolvedObligation;
  /** Set only when `resolved` is `AWAITING_DECLARATION` — the question that has to be answered. */
  readonly awaiting?: string;
}

/**
 * Thrown when a condition names an operator this resolver does not implement.
 *
 * ┌─ WHY THIS THROWS RATHER THAN EVALUATING FALSE ────────────────────────────────────────────────┐
 * │ An unknown operator means the seed and the code have diverged — somebody published a checklist │
 * │ version using a rule this deployment cannot evaluate. Returning `false` would drop a required  │
 * │ document from the checklist with no error anywhere, and the gym would be approved without it.  │
 * │ Failing the resolution is loud, immediate, and caught by the reference-seed test rather than   │
 * │ by an auditor a year later.                                                                     │
 * └────────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export class UnknownChecklistConditionError extends Error {
  constructor(
    readonly operator: string,
    readonly documentType: string,
  ) {
    super(
      `The checklist item ${documentType} uses the condition operator "${operator}", which this ` +
        `deployment cannot evaluate. A checklist version was published against a newer resolver. ` +
        `Refusing rather than treating the document as not required.`,
    );
    this.name = 'UnknownChecklistConditionError';
  }
}

/** The complete operator vocabulary. Two, and adding a third is a deliberate edit here. */
const OPERATORS = ['taxRegistrationStatusIn', 'declaredByApplicant'] as const;

type ConditionVerdict = { readonly met: boolean } | { readonly awaiting: string };

/**
 * Evaluate one condition. Multiple operators in one condition are ANDed.
 *
 * An empty condition object cannot be evaluated and is refused rather than defaulted — the database
 * already refuses to store one (`ck_kyc_checklists__conditional_has_condition`), so reaching this is
 * a bug rather than a data case, and it should say so.
 */
function evaluate(item: ChecklistItem, facts: ApplicantFacts): ConditionVerdict {
  const condition = item.condition ?? {};
  const keys = Object.keys(condition);

  if (keys.length === 0) {
    throw new UnknownChecklistConditionError('<empty>', item.documentType);
  }

  for (const key of keys) {
    if (!(OPERATORS as readonly string[]).includes(key)) {
      throw new UnknownChecklistConditionError(key, item.documentType);
    }
  }

  if ('taxRegistrationStatusIn' in condition) {
    const permitted = condition['taxRegistrationStatusIn'];
    if (!Array.isArray(permitted)) {
      throw new UnknownChecklistConditionError('taxRegistrationStatusIn', item.documentType);
    }
    if (!permitted.includes(facts.taxRegistrationStatus)) return { met: false };
  }

  if ('declaredByApplicant' in condition) {
    const question = condition['declaredByApplicant'];
    if (typeof question !== 'string') {
      throw new UnknownChecklistConditionError('declaredByApplicant', item.documentType);
    }

    const answer = facts.declarations[question];
    // Unanswered is not `false`. See the header — this is the state the file exists for.
    if (answer === undefined) return { awaiting: question };
    if (!answer) return { met: false };
  }

  return { met: true };
}

/**
 * Resolve a whole checklist for one applicant, in display order.
 *
 * The sort is applied here rather than trusted from the seed. The seed IS ordered, and a JSONB array
 * preserves that order — but the wizard's rendering order is a `SCR-DASH-002` contract, and a
 * hand-edited successor version with two items transposed would silently reorder the wizard.
 */
export function resolveChecklist(
  items: readonly ChecklistItem[],
  facts: ApplicantFacts,
): readonly ResolvedItem[] {
  return [...items]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((item): ResolvedItem => {
      if (item.obligation === 'ALWAYS') return { ...item, resolved: 'REQUIRED' };

      // ADVISORY is never conditional and never blocking. `SeedStrategy.md` §3.5: the music licence
      // is *"advisory, never blocking"* — it is flagged to the owner and approval does not wait.
      if (item.obligation === 'ADVISORY') return { ...item, resolved: 'ADVISORY' };

      const verdict = evaluate(item, facts);
      if ('awaiting' in verdict) {
        return { ...item, resolved: 'AWAITING_DECLARATION', awaiting: verdict.awaiting };
      }
      return { ...item, resolved: verdict.met ? 'REQUIRED' : 'NOT_REQUIRED' };
    });
}

export interface ChecklistCompleteness {
  readonly complete: boolean;
  /** Required, and no document supplied. */
  readonly missing: readonly string[];
  /** Cannot be decided until the applicant answers. Blocks completeness. */
  readonly awaiting: readonly string[];
  /** Requested, absent, and NOT blocking. Shown to the reviewer as a flag. */
  readonly advisoryOutstanding: readonly string[];
}

/**
 * `AC-ONB-04.2` — what is still owed.
 *
 * ┌─ ADVISORY ITEMS ARE REPORTED AND DO NOT COUNT ────────────────────────────────────────────────┐
 * │ `advisoryOutstanding` is populated and `complete` ignores it. Both halves matter: dropping the │
 * │ list would mean the platform never flags the music licence to anybody, and counting it would   │
 * │ block an approval over a document the specification explicitly calls non-blocking.              │
 * └────────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function checklistCompleteness(
  resolved: readonly ResolvedItem[],
  suppliedDocumentTypes: readonly string[],
): ChecklistCompleteness {
  const supplied = new Set(suppliedDocumentTypes);

  const missing = resolved
    .filter((i) => i.resolved === 'REQUIRED' && !supplied.has(i.documentType))
    .map((i) => i.documentType);

  const awaiting = resolved
    .filter((i) => i.resolved === 'AWAITING_DECLARATION')
    .map((i) => i.awaiting as string);

  const advisoryOutstanding = resolved
    .filter((i) => i.resolved === 'ADVISORY' && !supplied.has(i.documentType))
    .map((i) => i.documentType);

  return {
    complete: missing.length === 0 && awaiting.length === 0,
    missing,
    awaiting,
    advisoryOutstanding,
  };
}
