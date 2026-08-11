/**
 * `M-031` · The branch request and response contracts — `Gym.md` §12, `FR-GYM-07`, `FR-GYM-09`.
 *
 * ┌─ TRANSCRIBED FROM `Gym.md` §12.2, NOT DERIVED FROM THE TABLE ────────────────────────────────┐
 * │ The obvious way to write these is to read `branches` and mirror its columns. That produces a │
 * │ schema which accepts whatever the database accepts, which is not the contract — it is the    │
 * │ storage. `Gym.md` §12.2 carries the request shape with its own bounds (`name` 2–120,         │
 * │ `postal_code` `^[1-9]\d{5}$`, `capacity` ≤ 100000), and those bounds exist for reasons the   │
 * │ column types do not express.                                                                   │
 * │                                                                                              │
 * │ Every vocabulary defect found on 2026-08-10 came from writing code against the schema and    │
 * │ not the document, so this file quotes the document.                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ `landmark` AND `parking_notes` ARE IN THE CONTRACT AND IN NO COLUMN ────────────────────────┐
 * │ `Gym.md` §12.2 lists both as optional request fields. The shipped `branches` table has        │
 * │ neither, and `Schema.md` §4 is a **closed 79-table register** whose columns are enumerated —  │
 * │ adding two is a §24 amendment, not a DTO's prerogative.                                        │
 * │                                                                                              │
 * │ So they are accepted and **dropped**, deliberately and visibly, rather than either silently   │
 * │ ignored or quietly written to a column invented here. `KL-` recorded. Rejecting them instead  │
 * │ would break a documented client contract over a storage gap, which is the wrong way round.    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { z } from 'zod';

/**
 * `state_code` is `LAUNCH_MARKET_INDIA.md` §4's place-of-supply driver.
 *
 * Two DIGITS, never the ISO alpha — `ADR-0038` settled that after `BLK-20`, and the database
 * agrees: `ck_branches__state_code_shape` is `^[0-9]{2}$` and `tenants.state_code` is
 * `substring(gstin, 1, 2)`, which a GSTIN opens with. It decides CGST + SGST versus IGST on every
 * future invoice for a sale at this branch, which is why it is required at creation.
 */
const stateCode = z.string().regex(/^\d{2}$/, 'a GST state code is two digits');

/** An Indian PIN. Six digits, never leading zero — `Gym.md` §12.2. */
const postalCode = z.string().regex(/^[1-9]\d{5}$/, 'not an Indian PIN code');

/**
 * `{ lat, lng }` — the ORDER a human reads, and the opposite of `ST_MakePoint`.
 *
 * The mapper is where longitude goes first. Keeping the request in reading order and the
 * conversion in one place is deliberate: swapped, Mumbai's 19.076N 72.877E becomes a valid point
 * in the Norwegian Sea, which no type check and no visual review of a JSON body would catch.
 */
const point = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict();

/** Fields `BR-GYM-06` classes as MATERIAL — `Gym.md` §12.3. Changing one re-opens review. */
const materialFields = {
  address_line1: z.string().trim().min(3).max(200),
  address_line2: z.string().trim().max(200).optional(),
  city_id: z.string().uuid(),
  locality_id: z.string().uuid().optional(),
  state: z.string().trim().max(100),
  state_code: stateCode,
  postal_code: postalCode,
  location: point,
};

/** Fields that take effect immediately — same section. */
const immediateFields = {
  name: z.string().trim().min(2).max(120),
  capacity: z.number().int().positive().max(100000).optional(),
  /** Accepted, and dropped. See the header — there is no column and §4 is closed. */
  landmark: z.string().trim().max(200).optional(),
  /** Accepted, and dropped. */
  parking_notes: z.string().trim().max(500).optional(),
};

export const createBranchRequestSchema = z
  .object({
    gym_id: z.string().uuid(),
    ...immediateFields,
    ...materialFields,
    country_code: z.literal('IN'),
    /**
     * Requested, and overridden when this is the gym's first branch.
     *
     * `Gym.md` §12.2: *"The first branch of a gym is `is_primary` regardless of the request"* —
     * `gyms.city_id` is denormalised from it so `uq_gyms__city_slug` is enforceable. The use case
     * decides; the schema only says the field may appear.
     */
    is_primary: z.boolean().optional(),
  })
  .strict();

export type CreateBranchRequest = z.infer<typeof createBranchRequestSchema>;

/**
 * `FR-GYM-10`'s temporary closure. Business dates in `Asia/Kolkata`, never timestamps.
 *
 * `null` clears it. A closure past the configured consecutive-day threshold **demotes the gym in
 * search** (`AC-GYM-02.3`) — a ranking effect written from a branch edit, which is why the
 * response names it rather than leaving the owner to discover it.
 */
const temporaryClosure = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().trim().min(1).max(200),
  })
  .strict()
  .nullable();

/**
 * ┌─ `.partial()`, AND THE `Object.fromEntries` VERSION THIS REPLACED WAS TYPE-BLIND ────────────┐
 * │ The first version built the optional fields with                                              │
 * │                                                                                              │
 * │     ...Object.fromEntries(Object.entries({ ...immediateFields, ...materialFields })           │
 * │          .map(([key, schema]) => [key, (schema as z.ZodTypeAny).optional()]))                 │
 * │                                                                                              │
 * │ — which TypeScript types as `{ [k: string]: ZodTypeAny }`, because `Object.fromEntries` over  │
 * │ a mapped array cannot preserve keys. So `z.infer` produced a `UpdateBranchRequest` containing │
 * │ **`temporary_closure` and `acknowledge_review` and nothing else**, and every one of the       │
 * │ twelve real fields was invisible to the compiler.                                             │
 * │                                                                                              │
 * │ Runtime validation was correct throughout — Zod had the schemas, only the TYPE was empty —    │
 * │ which is why nothing failed. It surfaced when a spec passed `{ postal_code: '400076' }` and   │
 * │ `tsc` said the property *"does not exist"*: the handler had been accepting a body it could    │
 * │ not describe, and a typo in `COLUMN_OF` would have been caught by no one.                     │
 * │                                                                                              │
 * │ `.partial()` does the same thing with the keys intact.                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const editableBranchFields = z.object({ ...immediateFields, ...materialFields });

export const updateBranchRequestSchema = editableBranchFields
  .partial()
  .extend({
    temporary_closure: temporaryClosure.optional(),
    /**
     * `Gym.md` §6.3 mechanism 2 — and it was MISSING from this schema until 2026-08-11.
     *
     * *"A `PATCH` that touches a `REQUIRES_REVIEW` field **without** `"acknowledge_review": true`
     * is refused with `422 APPLICATION_PRECHECK_OVERRIDE_REQUIRED`"*, and §6.3's own illustrative
     * schema carries the field. §12.3 does not repeat it — it only lists the resulting error —
     * and this file was transcribed from §12.3, so the field was left out and the error it gates
     * was unsatisfiable by any well-formed request: every material PATCH would have 422'd forever.
     *
     * The point of the flag is in §6.3's next sentence: a warning in the UI *"is true only for a
     * client that chose to read it; the acknowledgement makes it true for every client, including
     * a script."*
     */
    acknowledge_review: z.boolean().optional(),
  })
  .strict()
  /*
   * An empty PATCH is a client bug, not a no-op. Accepting it writes an audit row and an
   * `updated_at` for a change nobody made, and `AC-9`'s "who changed what" then has a row with no
   * what in it.
   *
   * `acknowledge_review` does not count as a field — `Gym.md` 767 spells the rule
   * `Object.keys(o).some(k => k !== 'acknowledge_review')`. A body carrying only the flag
   * acknowledges a change it is not making.
   */
  .refine((body) => Object.keys(body).some((key) => key !== 'acknowledge_review'), {
    message: 'no fields to update',
  });

export type UpdateBranchRequest = z.infer<typeof updateBranchRequestSchema>;

/**
 * What a branch looks like on the way out.
 *
 * `tenant_id` is absent on purpose. The caller is inside the tenant — RLS put them there — so
 * returning it tells them nothing they did not send and puts a tenant identifier into every
 * response body, log and browser cache for no reason (`BR-DAT-06`).
 */
export const branchResponseSchema = z
  .object({
    id: z.string().uuid(),
    gym_id: z.string().uuid(),
    name: z.string(),
    address_line1: z.string(),
    address_line2: z.string().nullable(),
    city_id: z.string().uuid(),
    locality_id: z.string().uuid().nullable(),
    state: z.string(),
    state_code: z.string(),
    postal_code: z.string(),
    country_code: z.string(),
    location: point,
    /**
     * The measured distance between `location` and the geocoded address AT CREATION — `BR-GYM-08`.
     *
     * Returned because the owner has to be able to act on it. A mismatch at creation is a WARNING
     * (`Gym.md` §12.2) and not a refusal: `BR-GYM-08` blocks approval, and refusing at creation
     * would stop an owner saving a draft while they find the right pin.
     */
    geo_tolerance_metres: z.number().int().nullable(),
    capacity: z.number().int().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE']),
    is_primary: z.boolean(),
  })
  .strict();

export type BranchResponse = z.infer<typeof branchResponseSchema>;
