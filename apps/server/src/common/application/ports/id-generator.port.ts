/**
 * `IdGenerator` — constitution §9.5 D4, ERD.md §11.5.
 *
 * UUIDv7, application-generated. Two reasons it is a port rather than a function:
 *
 *  1. The id must exist BEFORE the INSERT — an outbox row and the aggregate that emitted it are
 *     written in one transaction and must reference each other, which `gen_random_uuid()` in a
 *     DEFAULT cannot do.
 *  2. v7 is time-ordered, so index locality depends on the clock — which makes a deterministic
 *     generator necessary to test ordering at all.
 *
 * Sequential integer keys are forbidden (constitution §15.8 rule 2): they leak volume across
 * tenants, so a competitor reading their own order id learns roughly how many orders exist.
 */
export interface IdGenerator {
  /** A fresh UUIDv7, lowercase, canonically hyphenated. */
  uuidv7(): string;
}

export const ID_GENERATOR = Symbol('IdGenerator');
