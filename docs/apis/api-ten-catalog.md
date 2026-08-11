# `api-ten-catalog` — the tenant catalogue API, as shipped

**Task:** `T-04.01` (`Epic_04.md`), a `§23.1` Definition-of-Ready artefact
**Source of truth:** [`Gym.md`](Gym.md) §12 · [`API_Catalog.md`](../engineering/API_Catalog.md) §5.6
**Module:** `apps/server/src/catalog/` · **Milestone:** `M-031`

---

## 0. Scope, and the six endpoints this file does NOT specify

`T-04.01` asks for *"11 endpoints with permission, Zod request/response, error codes, idempotency and
rate class"*. **Five of them exist.** The other six belong to `M-032` (gym profile), `M-033` (media)
and `M-034` (operating hours), and writing their contracts here would mean designing six APIs against
no implementation — the shape `PG-7` was built to catch at the permission layer and which no gate
catches in prose.

| Endpoint                                | Permission                    | Milestone | Here?         |
| :-------------------------------------- | :---------------------------- | :-------- | :------------ |
| `GET /v1/tenant/branches`               | `catalog.branch.list`         | `M-031`   | **§1**        |
| `POST /v1/tenant/branches`              | `catalog.branch.create`       | `M-031`   | **§2**        |
| `GET /v1/tenant/branches/:id`           | `catalog.branch.read`         | `M-031`   | **§3**        |
| `PATCH /v1/tenant/branches/:id`         | `catalog.branch.update`       | `M-031`   | **§4**        |
| `DELETE /v1/tenant/branches/:id`        | `catalog.branch.deactivate`   | `M-031`   | **§5**        |
| `GET`/`PATCH /v1/tenant/gyms/:id`       | `catalog.gym.read` / `.update` | `M-032`   | `Gym.md` §6   |
| `GET`/`POST /v1/tenant/gyms`            | `catalog.gym.list` / `.create` | `M-032`   | `Gym.md` §5   |
| `POST`/`PATCH`/`DELETE …/gyms/:id/media` | `catalog.gym_media.*`         | `M-033`   | `Gym.md` §9   |
| `PUT …/branches/:id/hours`              | `catalog.branch_hours.update` | `M-034`   | `Gym.md` §12.5 |

Neither `catalog.gym.*` nor `catalog.gym_media.*` has a `§B3.2` row yet — both are `BLK-10`-family
questions nobody has asked. `permissions.ts` says so where a reader will look for them.

**This file records the five as built.** Where it and `Gym.md` §12 disagree, `Gym.md` wins: it is
rank 3 and this is a record of an implementation.

---

## 1. `GET /v1/tenant/branches`

| | |
| :--- | :--- |
| **Permission** | `catalog.branch.list` — `§B3.2` row 20, `OWNER ●` `MGR ○` `RCP ○` `TRN ○` `S.ADMIN ●` |
| **Rate class** | `RL-READ` · **Idempotency** none (safe) · **Cache** `NO-STORE` |
| **Success** | `200` · `Page<BranchResponse>` |

**Query.** `gym_id` (uuid, **repeatable**) · `status` (`ACTIVE`\|`INACTIVE`) · `city_id` (uuid) ·
`sort` (`name:asc` \| `name:desc` \| `created_at:desc`, default `name:asc`) · `limit`
(**default 50**, ceiling 100) · `cursor` (opaque).

The default of 50 is `Gym.md` §12.1's, and it outranks `DEFAULT_PAGE_LIMIT = 20` in
`packages/types` — `MASTER_PRD.md` §C3.1 states the pagination *mechanism* and no number, so a rank-3
API document naming its own default is not in conflict with anything.

An unrecognised `sort` or `status` **falls back rather than 400s**. A filter is a narrowing, and the
safe behaviour of a broken one is to show everything: a stale bookmark should render a useful list,
not an empty screen an owner reads as *"I have no branches"*.

**Response.** `{ data: BranchResponse[], next_cursor: string | null, has_more: boolean }`. The cursor
is base64url over `(sort key, id)` and is **opaque** — the moment a client parses one, the encoding is
frozen and the sort key can never change.

**INACTIVE branches are included.** An owner must still see the branch they closed last month, or it
has silently vanished from a screen that claims to list their estate. Soft-deleted rows are not.

**Two documented fields are absent rather than empty.** `active_membership_count` (`KL-113`,
`memberships` at `M-046`) and `hours_summary` (`KL-119`, `branch_hours` at `M-034`). Absent renders
nothing; `0` renders a dashboard confidently showing every branch as empty.

> **`KL-116` — a security gap, not a missing field.** §12.1 requires *"a branch-scoped caller receives
> only assigned branches, with `scope.branch_ids` echoed"*. No staff-to-branch table exists until
> `M-037`, so **every holder of `catalog.branch.list` sees the whole tenant.** Read only, same tenant,
> RLS untouched — but it is wider than specified and `ADR-0047` gave the key to `RECEPTIONIST` and
> `TRAINER`.

**Errors.** `401 UNAUTHENTICATED` · `403 PERMISSION_DENIED`

---

## 2. `POST /v1/tenant/branches`

| | |
| :--- | :--- |
| **Permission** | `catalog.branch.create` — row 20, `OWNER ●` `S.ADMIN ●` only |
| **Rate class** | `RL-WRITE` · **Idempotency** `Idempotency-Key` **required** · **Success** `201` |

**Request** — `createBranchRequestSchema`, `.strict()`, transcribed from `Gym.md` §12.2:

```ts
{
  gym_id: uuid,
  name: string(2..120),
  address_line1: string(3..200),   address_line2?: string(..200),
  city_id: uuid,                   locality_id?: uuid,
  state: string(..100),            state_code: /^\d{2}$/,      // GST place of supply
  postal_code: /^[1-9]\d{5}$/,     country_code: 'IN',
  location: { lat: -90..90, lng: -180..180 },
  capacity?: int(1..100000),
  landmark?: string(..200),        parking_notes?: string(..500),
  is_primary?: boolean,
}
```

**`{ lat, lng }` is reading order and the OPPOSITE of `ST_MakePoint`.** The translation happens once,
in `branch.mapper.ts`, which returns `[lng, lat]` as a tuple rather than a SQL fragment. Swapped,
Mumbai's 19.076 N 72.877 E becomes a valid point in the Norwegian Sea that no type check catches.

**`is_primary` is overridden on the first branch**, per §12.2 *"regardless of the request"* — the
response carries the fact rather than changing it silently. A **second** branch asking to be primary
is passed through and refused by `uq_branches__one_primary_per_gym`: §12.2 describes promotion on
DEACTIVATION and says nothing about a create taking the flag from another branch.

**`landmark` and `parking_notes` are accepted and dropped.** Both are in the contract; `branches` has
neither column and `Schema.md` §4 is a closed 79-table register. Rejecting them would break a
documented contract over a storage gap, which is the wrong way round.

**`geo_tolerance_metres` is `null`.** `BR-GYM-08`'s distance check needs a geocoder and none is bound
— `KL-114`. Null is the column's own meaning, *not measured*; a `0` would claim the pin sits exactly
on the address.

**Errors.** `401` · `403` · `400 VALIDATION_FAILED` · `404 RESOURCE_NOT_FOUND` (unknown gym, and a
gym in another tenant returns the **same** 404 — `A1`) · `400 IDEMPOTENCY_KEY_REQUIRED`

---

## 3. `GET /v1/tenant/branches/:id`

| | |
| :--- | :--- |
| **Permission** | `catalog.branch.read` — row 20, same holders as the list |
| **Rate class** | `RL-READ` · **Cache** `NO-STORE` · **Success** `200` |

`BranchResponse` plus **`field_change_classes`** — a map of every PATCH field to `MATERIAL` or
`IMMEDIATE`. `FR-GYM-11` requires the UI to state before a save that a change goes to review, and
`Gym.md` 816 gives the reason it is served rather than hard-coded: *"a client that hard-coded the
material list would break, which is why the map exists."*

`hours[]`, `hour_exceptions[]` and the active closure are absent — `KL-119`.

**Errors.** `401` · `403` · `404`

---

## 4. `PATCH /v1/tenant/branches/:id`

| | |
| :--- | :--- |
| **Permission** | `catalog.branch.update` — **`§B3.2` row 19** *Edit gym profile*, `OWNER ●` `MGR ▪` |
| **Rate class** | `RL-WRITE` · **Idempotency** required · **Cache** `NO-STORE` · **Success** `200` |

**The one route on row 19**, and it reproduces `Gym.md` line 171 exactly: a `GYM_MANAGER` may **edit**
a branch and may not **open or close** one. Editing an address is profile maintenance; opening and
closing a location is a different act with a different holder set.

Putting it on row 20 with the others was the first attempt. It was rejected because row 19 is where
rank 2 already gives `GYM_MANAGER ▪`, so no `§C10` amendment was needed — and `permissionsFor()` emits
write keys only for a grant that is not `READ`, so row 19's `SUPPORT ○` and `VERIFICATION_OFFICER ○`
cells cannot reach it.

**Request.** Every field of §2 as optional, plus `temporary_closure` and **`acknowledge_review`**. At
least one field other than `acknowledge_review` is required — a body carrying only the flag
acknowledges a change it is not making.

**`BR-GYM-06` fires here.** Seven fields are MATERIAL — `address_line1`, `address_line2`, `city_id`,
`state`, `state_code`, `postal_code`, `location` — and five are immediate. **An unclassified field is
MATERIAL**, which is the safe side and the side the equivalent registry in `onboarding/` originally
got wrong.

Touching a material field without `acknowledge_review: true` is refused
**`422 APPLICATION_PRECHECK_OVERRIDE_REQUIRED`**, whose `details.material_fields` names each one. §6.3:
a warning in the UI *"is true only for a client that chose to read it; the acknowledgement makes it
true for every client, including a script."*

On success the response carries **`returns_to_review`**. It reports the rule and does not move
`gyms.status`: the partial re-review `BR-GYM-06` describes — some fields queued, the listing still
serving — has no representation in a single-valued enum, so writing it would either pull a live
listing down or record a review nobody is doing. `KL-118`.

**Three of §12.3's six errors cannot be raised**, and only one is a shortcut:

| Error | Status | Why not |
| :--- | :--- | :--- |
| `GEO_ADDRESS_MISMATCH` | 422 | Needs the geocoder — `KL-114` |
| `APPLICATION_ALREADY_SUBMITTED` | 409 | Reads `applications`; `catalog`(0) → `onboarding`(4) is an upward L3 edge dependency-cruiser refuses — `KL-115` |
| `BRANCH_NOT_ASSIGNED_TO_STAFF` | 403 | No staff-to-branch table until `M-037` — `KL-116` |
| `RESOURCE_VERSION_CONFLICT` | 409 | Registered; no `If-Match` is read on this route yet |
| `CONFIG_VALIDATION_FAILED` | 422 | **Raised** — by the DTO, on a closure with `to` before `from`. The closure itself is not persisted: no column, `KL-117` |

**Errors raised.** `401` · `403` · `400 VALIDATION_FAILED` · `404` · `422 APPLICATION_PRECHECK_OVERRIDE_REQUIRED`

---

## 5. `DELETE /v1/tenant/branches/:id`

| | |
| :--- | :--- |
| **Permission** | `catalog.branch.deactivate` — row 20, `OWNER ●` `S.ADMIN ●` only |
| **Rate class** | `RL-WRITE` · **Idempotency** required · **Success** `204` |

**A soft deactivation, never a delete.** `status → 'INACTIVE'` with `deleted_at` set — *"a branch is
named by every historical attendance row and every invoice"*. The permission is named `.deactivate`
rather than `.delete` for the same reason: a key called `.delete` would describe a capability this
module does not have and should never acquire.

Three rules, checked in this order:

1. **The last active branch of a listed gym is refused** `422 CONFIG_VALIDATION_FAILED` — *"a listed
   gym with no location is not a listing."* `PENDING_REVIEW` counts as listed alongside `APPROVED`: a
   submission with no location is one a reviewer cannot assess.
2. **Members who can still check in** → `422 BRANCH_HAS_ACTIVE_MEMBERSHIPS` carrying
   `details.member_count`. `NFR-USE-06` requires the real figure — a vague *"cannot delete"* fails
   review.
3. Otherwise permitted — and if the branch was primary, **the successor is promoted in the SAME
   transaction**. Permission is not a boolean: `uq_branches__one_primary_per_gym` forbids two
   primaries and not zero, so a caller treating it as one leaves a gym with no primary and no error.

Last-branch is checked **first** even though the membership count is the rule `Gym.md` calls *"the rule
that matters"*. If both are true, an owner told to move 1,247 members would do a week of work and then
meet a refusal no amount of moving clears.

> **`KL-113` — this route refuses EVERY active branch until `M-046`.** `memberships` does not exist,
> `AffectedMembershipsUnavailableAdapter` answers `UNAVAILABLE`, and the policy converts that to
> `BRANCH_HAS_ACTIVE_MEMBERSHIPS` with `member_count` **omitted**. Deactivating an already-inactive
> branch still succeeds as a no-op, which is the retry path an `Idempotency-Key` endpoint needs.
>
> The one-word alternative — `{ ok: true, count: 0 }` — is a *claim*, made by something that cannot
> count, and it would begin silently on the day `M-046` lands. `deactivate-branch.use-case.spec.ts`
> asserts *"an unavailable count is a refusal, never a pass"* so the edit fails a test, not a review.

**Errors.** `401` · `403` · `404` · `422 BRANCH_HAS_ACTIVE_MEMBERSHIPS` · `422 CONFIG_VALIDATION_FAILED`

---

## 6. Cross-cutting

**Every route is `@TenantScoped()`.** The tenant is never a path parameter and never a client header:
it comes from the authenticated principal and is applied by the `A-01` Prisma extension, which opens
an interactive transaction and sets `app.tenant_id` before any statement runs. RLS filters.

**Every mutation is `@Audited({ entityType: 'BRANCH' })`** with `CREATE`, `UPDATE` or `DELETE`, written
by the interceptor **before** the work it describes.

**Every not-found is the same 404.** `UNKNOWN_GYM` and `UNKNOWN_BRANCH` are distinct in the use case's
outcome type so an operator reading a log knows which lookup missed, and they collapse at the edge
because a caller who could tell them apart could enumerate ids across tenants.

**`PG-7` guards the permission strings.** A well-formed key present in no `permissions.ts` fails the
build rather than failing at request time. It cannot catch a key that is present but over-granted —
that is `RB2`'s job, and `RB2` is unbuilt.
