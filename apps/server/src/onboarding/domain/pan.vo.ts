/**
 * `M-029` `AC-4` · PAN, and the fourth character that has to agree — `AC-ONB-04.3`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE FORMAT CHECK IS THE EASY HALF AND CATCHES ALMOST NOTHING
 *
 * `^[A-Z]{5}\d{4}[A-Z]$` refuses a typo. It accepts a company submitting an individual's PAN, which
 * is the thing that actually matters: the reviewer sees a valid-looking tax identity that belongs to
 * a person rather than to the business claiming it, and no format rule anywhere would object.
 *
 * The **fourth character encodes the entity type** — `C` company, `P` individual, `F` firm, `H` HUF,
 * `T` trust — so the check is a CROSS-check against `tenants.entity_type`, and it is the only part
 * of PAN validation that can catch a wrong document rather than a wrong keystroke.
 *
 * `Gym.md` §1089 places it at `L6-UC`, not `L8-PIPE`, and that is not a detail. A validation pipe
 * sees one field; this needs two, and putting it in the pipe would mean either passing the entity
 * type into a field validator or checking it nowhere. The format lives in the pipe, the agreement
 * lives here.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** `AAAAA9999A`. Anchored, so a longer string containing a valid PAN is not one. */
const PAN_FORMAT = /^[A-Z]{5}\d{4}[A-Z]$/;

/**
 * The fourth character each `entity_type_enum` value may present.
 *
 * ┌─ `SOLE_PROPRIETOR` MAPS TO `P`, AND THAT SURPRISES PEOPLE ──────────────────────────────────┐
 * │ A sole proprietorship has no PAN of its own — it trades on the proprietor's PERSONAL PAN,     │
 * │ which is an individual's and carries `P`. Expecting a business code here would reject every   │
 * │ legitimate sole proprietor in India, which is most small gyms.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ `OTHER` ACCEPTS SEVERAL, AND IS NOT A BYPASS ──────────────────────────────────────────────┐
 * │ `entity_type_enum` has four values; the PAN alphabet has more. A trust presents `T`, a HUF    │
 * │ `H`, a society or local authority others again — and all of them arrive as `OTHER` because    │
 * │ the enum does not distinguish them.                                                            │
 * │                                                                                              │
 * │ So `OTHER` accepts that set rather than skipping the check. Skipping it would make `OTHER` the │
 * │ value anybody picks to get an unmatched PAN through, and the enum has an `OTHER` on every      │
 * │ dropdown.                                                                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const PAN_ENTITY_CODES: Readonly<Record<string, readonly string[]>> = {
  COMPANY: ['C'],
  PARTNERSHIP: ['F'],
  SOLE_PROPRIETOR: ['P'],
  // Trust, HUF, association of persons, body of individuals, local authority, government, artificial
  // juridical person. Everything the enum folds into one value.
  OTHER: ['T', 'H', 'A', 'B', 'L', 'G', 'J'],
};

export type PanVerdict =
  | { readonly valid: true; readonly entityCode: string }
  | { readonly valid: false; readonly reason: 'MALFORMED' | 'ENTITY_TYPE_MISMATCH' | 'UNKNOWN_ENTITY_TYPE' };

/** Format only — the half a validation pipe can do with one field. */
export function isWellFormedPan(pan: string): boolean {
  return PAN_FORMAT.test(pan);
}

/** The entity character, or `null` when the PAN is malformed. */
export function panEntityCode(pan: string): string | null {
  return isWellFormedPan(pan) ? (pan[3] as string) : null;
}

/**
 * `AC-4` — the format AND the agreement.
 *
 * The two failures are reported separately because they mean different things to the person who has
 * to fix them: `MALFORMED` is a typo, and `ENTITY_TYPE_MISMATCH` means they have supplied the wrong
 * DOCUMENT — often their own PAN for a company. Collapsing them into "invalid PAN" sends somebody
 * to re-read a number that was correct.
 *
 * No value is echoed in any of this. `Gym.md` §793: name the field and the expected shape, never the
 * value — a PAN is a personal financial identifier and `BR-DAT-06` keeps it out of logs and errors.
 */
export function validatePan(pan: string, entityType: string): PanVerdict {
  if (!isWellFormedPan(pan)) return { valid: false, reason: 'MALFORMED' };

  const permitted = PAN_ENTITY_CODES[entityType];
  if (permitted === undefined) {
    /*
     * An entity type this map has never heard of. Refused rather than waved through: a new value
     * added to `entity_type_enum` and forgotten here would otherwise accept ANY fourth character,
     * silently turning the check off for exactly the tenants nobody has thought about yet.
     */
    return { valid: false, reason: 'UNKNOWN_ENTITY_TYPE' };
  }

  const code = pan[3] as string;
  if (!permitted.includes(code)) return { valid: false, reason: 'ENTITY_TYPE_MISMATCH' };

  return { valid: true, entityCode: code };
}
