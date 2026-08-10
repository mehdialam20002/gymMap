/**
 * `M-031` · The stand-in for `AFFECTED_MEMBERSHIPS_PORT`, until `memberships` ships in Sprint 7.
 *
 * ┌─ THIS FILE'S ENTIRE JOB IS TO REFUSE, AND THE ONE-WORD CHANGE IS THE POINT ──────────────────┐
 * │ `return { ok: true, count: 0 }` compiles, satisfies the port, makes every deactivation        │
 * │ succeed, and is a breach of `NFR-USE-06`. It is one word away and it looks like progress.     │
 * │                                                                                              │
 * │ The same shape as `MalwareScanPort`'s `UNSCANNED` and `ObjectStoragePort`'s `UNAVAILABLE`     │
 * │ (`M-029`): for each there is a trivial edit that makes the pipeline work today and be wrong,  │
 * │ and for each there is a test whose only purpose is to make that edit fail. Here it is         │
 * │ `deactivate-branch.use-case.spec.ts`'s *"an unavailable count is a refusal, never a pass"*    │
 * │ together with the assertions below.                                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY A REFUSING ADAPTER RATHER THAN NO BINDING AT ALL ───────────────────────────────────────┐
 * │ Leaving `AFFECTED_MEMBERSHIPS_PORT` unbound would make Nest fail to resolve                   │
 * │ `DeactivateBranchUseCase` at boot, which is loud — and it would take the whole branch         │
 * │ controller down with it, including the four routes that have nothing to do with memberships.  │
 * │                                                                                              │
 * │ Bound and refusing, `DELETE /v1/tenant/branches/:id` returns a refusal that names the real    │
 * │ reason and the other four routes work. That is the honest state of the system: the estate can │
 * │ be managed, and a branch cannot be closed until something can count who is still using it.    │
 * │ `KNOWN_LIMITATIONS.md` carries the consequence as `KL-113` — because the consequence is real:  │
 * │ `DELETE /v1/tenant/branches/:id` refuses EVERY active branch until Sprint 7, and that is a     │
 * │ shipped route that cannot do its job. It is recorded rather than softened.                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Injectable } from '@nestjs/common';

import type {
  AffectedMembershipCount,
  AffectedMembershipsPort,
} from '../application/ports/affected-memberships.port.js';

@Injectable()
export class AffectedMembershipsUnavailableAdapter implements AffectedMembershipsPort {
  /**
   * Always `ok: false`. There is no branch id for which this adapter can answer.
   *
   * `branchId` is accepted and unused on purpose: the signature is the port's, and narrowing it
   * here would make the Sprint 7 adapter a different shape rather than a drop-in replacement.
   */
  countForBranch(_branchId: string): Promise<AffectedMembershipCount> {
    return Promise.resolve({
      ok: false,
      /*
       * Operator-facing, and it never reaches a client — `BR-DAT-06`. The controller renders the
       * refusal from the policy's verdict, not from this string; this is what an engineer reading
       * a log needs, which is "the table does not exist yet", not "the service is down".
       */
      reason:
        'no membership entitlements exist to count — the `memberships` table ships in Sprint 7 ' +
        '(M-046). NFR-USE-06 requires the real figure inside the deactivation transaction, and ' +
        'nothing can supply it yet, so the deactivation is refused rather than allowed on an ' +
        'assumed zero.',
    });
  }
}
