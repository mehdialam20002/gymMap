# `catalog/controllers/` — the five branch routes, and what they cannot do yet

`FolderStructure.md` §8.1 row 4 requires this directory once the module has any source, and §8.2
lists the only four provider-only modules — `catalog` is not one of them. `README.md` §4 says so in
the module's own words: _"`catalog/` is not one of the four provider-only modules of
`FolderStructure.md` §8.2, so `controllers/`, `dto/` and `permissions.ts` are mandatory."_

This file existed for weeks to explain why the directory was **empty**. It is not empty any more.
The history is kept below the routes rather than deleted, because the block was mis-diagnosed twice
before it was named correctly, and both wrong answers were plausible.

## The five routes — `branch.controller.ts`

| Route                            | Permission                  | `§B3.2` row               | Notes                                     |
| :------------------------------- | :-------------------------- | :------------------------ | :---------------------------------------- |
| `GET /v1/tenant/branches`        | `catalog.branch.list`       | 20 _Add / remove branch_  | Cursor-paginated, default 50              |
| `POST /v1/tenant/branches`       | `catalog.branch.create`     | 20                        | `201`, `Idempotency-Key` required         |
| `GET /v1/tenant/branches/:id`    | `catalog.branch.read`       | 20                        | Carries `field_change_classes`            |
| `PATCH /v1/tenant/branches/:id`  | `catalog.branch.update`     | **19** _Edit gym profile_ | Material fields need `acknowledge_review` |
| `DELETE /v1/tenant/branches/:id` | `catalog.branch.deactivate` | 20                        | `204`, soft deactivation, refuses today   |

`PATCH` sits on row 19 and the other four on row 20, which reproduces `Gym.md` line 171 exactly: a
`GYM_MANAGER` may **edit** a branch and may not **open or close** one. Editing an address is profile
maintenance; opening and closing a location is a different act with a different holder set, and the
two row labels say so. See `permissions.ts` for why putting all five on row 20 was the first attempt
and why it was wrong.

## What these routes cannot do, named rather than left to be discovered

Every one is a missing table or a missing adapter, not a missing decision.

| Gap                                                                 | Why                                                                                                  |          |
| :------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------- | :------- |
| `DELETE` refuses **every** active branch                            | `NFR-USE-06` needs the real member count; `memberships` is `M-046`                                   | `KL-113` |
| `active_membership_count` absent from list rows                     | same                                                                                                 | `KL-113` |
| `geo_tolerance_metres` written as `null`; no `GEO_ADDRESS_MISMATCH` | `BR-GYM-08` needs a geocoder; `GEOCODING_PORT` is unbound                                            | `KL-114` |
| `APPLICATION_ALREADY_SUBMITTED` never raised                        | reads `applications`; `catalog`(0) → `onboarding`(4) is an upward L3 edge dependency-cruiser refuses | `KL-115` |
| **A branch-scoped caller sees the whole tenant**                    | no staff-to-branch assignment table until `M-037`                                                    | `KL-116` |
| `temporary_closure` validated and not persisted                     | no column; `Schema.md` §4 is a closed register                                                       | `KL-117` |
| `returns_to_review` reported, nothing queues the review             | partial re-review has no representation in `gyms.status`; `M-032`                                    | `KL-118` |
| `hours_summary`, `hours[]`, `hour_exceptions[]`                     | `branch_hours` is `M-034`, a different route and permission                                          | `KL-119` |
| `RESOURCE_VERSION_CONFLICT`                                         | registered, and no `If-Match` is read on `PATCH` yet                                                 | —        |

`KL-116` is the one to read twice. It is a **security** gap rather than a missing field: `ADR-0047`
gave `RECEPTIONIST` and `TRAINER` `catalog.branch.list`, and §12.1's _"a branch-scoped caller
receives only assigned branches"_ is unenforceable until the assignment table exists.

## How `BLK-19` was diagnosed, twice wrongly

> **First framing, wrong.** The five routes cannot declare a permission because _"two rank-3
> documents give two different vocabularies for the same `§B3.2` row"_, and only
> `catalog.branch.read` appeared in both. `PHASES.md`'s own `BLK-19` row labels this **"What I got
> wrong"**. `API_Catalog.md` §5.6's column header is **"Permission string(s)"**, plural, and its
> rows already carry three keys for one capability — so five keys deriving from one row is the
> documented shape, not a conflict. The agreement between `Security.md` §3.3.1 and the shipped
> matrix turned out to be **coincidental and confined to row 20**; spot-checks found different
> _modules_, not different actions, on three other rows.

> **Second framing, right, and not an engineering question.** The **grant width**. `Gym.md` line 167
> attributes `GET /tenant/branches` to `RECEPTIONIST` and `TRAINER`; `§B3.2` rows 19 and 20 gave both
> `—`. A rank-3 API document cannot widen a rank-2 grant, so `SCR-DASH-004` as designed was
> unbuildable, and the remedy was a `§C10` product decision rather than anything a module file could
> settle.

**`ADR-0047` closed it.** The owner ruled that both roles do see the branch list, **read only** —
rows 19 and 20 gained `○` cells, and creating, editing and closing a branch stayed with the owner.
The narrower option (_only the branch I am assigned to_) was offered first with its reasoning and was
not taken; that is recorded so the choice is visible rather than looking like drift.

The lasting mitigation from the same period is `PG-7` (`50c29ed`): a well-formed permission key that
exists in no `permissions.ts` now fails the build instead of failing at request time. It cannot catch
a key that is present but over-granted — that is `RB2`'s job, and `RB2` is still unbuilt.
