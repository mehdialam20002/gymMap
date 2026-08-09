/**
 * `M-030` · Is another approved gym already at this address? — `BR-GYM-09`, `E2.9`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS FLAGS. IT DOES NOT REFUSE — AND THE ROADMAP SAYS OTHERWISE.
 *
 * The milestone's `AC-4` reads: *"A second application for the same normalised physical address is
 * **refused by the partial unique index, not merely warned about**."* Three higher-ranked documents
 * say the opposite, in terms, and they agree with each other:
 *
 *   `MASTER_PRD.md` `BR-GYM-09` (rank 2)
 *     *"A single physical address may host only one APPROVED gym at a time. **Collisions are
 *     surfaced to the reviewer as a possible duplicate.**"*
 *
 *   `Constraints.md` §19 (rank 3)
 *     *"Deliberately **not** a constraint: shared premises are legitimate and the rule says
 *     *surfaced*, not *rejected*. `BusinessRules.md` marks the normalised-address partial unique
 *     **advisory in Phase 1**; the detection is the reviewer's queue."*
 *
 *   `Schema.md` §5.2 (rank 3)
 *     *"This is *not* a unique index — addresses are free-text-adjacent and the rule is 'surfaced
 *     to the reviewer as a possible duplicate', not 'rejected'."*
 *
 * `CLAUDE.md` §2 puts `docs/roadmap/` below all three and calls it *"a plan of work, never a source
 * of requirements"*, so precedence settles this without an owner ruling: no refusing index is built.
 * Recorded as `KL-108` so the roadmap wording is corrected rather than quietly diverged from.
 *
 * The substance is on the specifications' side. Two studios in one building are both legitimate
 * businesses, a shared-premises refusal at a unique index is unappealable by the applicant, and the
 * address is free text that this repository normalises heuristically — refusing on a heuristic is
 * how a real gym is locked out by a rule that was 95% right.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { normaliseAddress } from '../../domain/address.normaliser.js';
import { errored, precheck, type PrecheckResult } from '../../domain/precheck-result.vo.js';
import type { Point } from '../ports/geocoding.port.js';
import type { DuplicateAddressProbe } from '../ports/duplicate-address.probe.js';

export interface DuplicateAddressInput {
  readonly address: string;
  readonly pin: Point;
  /**
   * Metres. Two gyms inside this radius are worth a look even when their addresses read
   * differently — a mall unit and a "shop no. 4" describing the same premises.
   */
  readonly radiusMetres: number;
}

export async function runDuplicateAddressCheck(
  probe: DuplicateAddressProbe,
  input: DuplicateAddressInput,
  ranAt: Date,
): Promise<PrecheckResult> {
  const normalised = normaliseAddress(input.address);

  if (normalised.length === 0) {
    /*
     * An empty normalisation is not a PASS.
     *
     * It means the address was punctuation, or the normaliser stripped everything — either way
     * nothing was compared, and reporting "no duplicate found" would be a claim about an address
     * that was never checked. `AC-8`'s distinction applies to every check, not only the geocoder.
     */
    return errored('DUPLICATE_ADDRESS', 'the address normalised to nothing', ranAt);
  }

  let found;
  try {
    found = await probe.findApprovedNear({
      normalisedAddress: normalised,
      point: input.pin,
      radiusMetres: input.radiusMetres,
    });
  } catch (error) {
    return errored(
      'DUPLICATE_ADDRESS',
      `the duplicate probe failed: ${error instanceof Error ? error.message : String(error)}`,
      ranAt,
    );
  }

  if (!found.ok) {
    return errored('DUPLICATE_ADDRESS', `${found.failure} — ${found.detail}`, ranAt);
  }

  /*
   * Two kinds of collision, reported separately because a reviewer treats them differently.
   *
   *   exact      the normalised strings match. Almost always the same premises
   *   proximate  different strings, inside the radius. Often a mall or a complex, and often fine
   *
   * Collapsing them into one "duplicate" flag would make the common, benign case look like the
   * rare, serious one — and a reviewer who dismisses ten proximate flags dismisses the eleventh
   * without reading it.
   */
  const exact = found.matches.filter((m) => m.normalisedAddress === normalised);
  const proximate = found.matches.filter((m) => m.normalisedAddress !== normalised);

  if (found.matches.length === 0) {
    return precheck('DUPLICATE_ADDRESS', 'PASS', { normalisedAddress: normalised }, ranAt);
  }

  return precheck(
    'DUPLICATE_ADDRESS',
    'FLAG',
    {
      normalisedAddress: normalised,
      exactMatches: exact.map((m) => ({ gymId: m.gymId, distanceMetres: m.distanceMetres })),
      proximateMatches: proximate.map((m) => ({
        gymId: m.gymId,
        distanceMetres: m.distanceMetres,
      })),
      radiusMetres: input.radiusMetres,
    },
    ranAt,
  );
}
