/**
 * `M-030` `KL-109` · The address probe, refusing rather than pretending.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A BOUND ADAPTER THAT SAYS "UNAVAILABLE" IS NOT THE SAME AS AN UNBOUND TOKEN
 *
 * The real probe reads `gyms` and `branches` — `branches.location` is the `geography(Point,4326)`
 * the `ST_DWithin` search runs against — and both tables arrive with **M-031**. M-030's dependency
 * list does not name M-031, which is an ordering defect in the roadmap rather than something to
 * engineer around: the check cannot search a catalogue that has not been built.
 *
 * Three ways to handle that, and only one is honest:
 *
 *   Leave the token unbound  → Nest fails with "can't resolve dependencies", which reads as a
 *                              wiring mistake and will be "fixed" by whoever meets it next.
 *   Return `{ matches: [] }` → the reviewer is told the address is clear. Nothing looked. This is
 *                              the `AC-8` coercion wearing a different costume, and it is the one
 *                              failure the whole pre-check design is built to prevent.
 *   Return `UNAVAILABLE`     → the check reports `ERROR`, the reviewer reads "could not be
 *                              checked", and `mayApprove` demands a reason to approve over it.
 *
 * Same pattern, same reasoning as `UnavailableObjectStorageAdapter` (`BLK-16`) and
 * `UnavailableMalwareScanAdapter` (`KL-104`). When M-031 lands, this class is deleted and the real
 * probe takes its token — the isolation spec that boots the module will keep passing either way,
 * which is the point of binding a port rather than a class.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { Injectable } from '@nestjs/common';

import type {
  DuplicateAddressOutcome,
  DuplicateAddressProbe,
  DuplicateAddressQuery,
} from '../application/ports/duplicate-address.probe.js';

@Injectable()
export class UnavailableDuplicateAddressProbe implements DuplicateAddressProbe {
  findApprovedNear(_query: DuplicateAddressQuery): Promise<DuplicateAddressOutcome> {
    return Promise.resolve({
      ok: false,
      failure: 'UNAVAILABLE',
      detail:
        'the gyms and branches tables arrive with M-031, so no approved listing exists to ' +
        'compare against (KL-109)',
    });
  }
}
