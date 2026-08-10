# `catalog/controllers/` — empty at `M-031`, and blocked rather than unfinished

`FolderStructure.md` §8.1 row 4 requires this directory once the module has any source, and §8.2
lists the only four provider-only modules — `catalog` is not one of them. `README.md` §4 says so in
the module's own words: _"`catalog/` is not one of the four provider-only modules of
`FolderStructure.md` §8.2, so `controllers/`, `dto/` and `permissions.ts` are mandatory."_

So the emptiness needs a reason rather than a shrug.

## The reason is `BLK-19`

`M-031` delivers the three catalogue **tables** and two of the module's six ports. The five
tenant-facing branch routes are specified down to their request bodies in `apis/Gym.md` §12 — and
four of the five cannot declare a permission, because two rank-3 documents give two different
vocabularies for the same `§B3.2` row.

| Route                            | `API_Catalog.md` 940–944 · `Gym.md` §12 | In `PERMISSION_KEYS`? |
| :------------------------------- | :-------------------------------------- | :-------------------- |
| `GET /v1/tenant/branches`        | `catalog.branch.list`                   | **no**                |
| `POST /v1/tenant/branches`       | `catalog.branch.create`                 | **no**                |
| `GET /v1/tenant/branches/:id`    | `catalog.branch.read`                   | yes                   |
| `PATCH /v1/tenant/branches/:id`  | `catalog.branch.update`                 | **no**                |
| `DELETE /v1/tenant/branches/:id` | `catalog.branch.deactivate`             | **no**                |

`Security.md` line 832 is the only document that maps all forty-two `§B3.2` rows to permission
strings, and for row 20 (_"Add / remove branch"_) it gives exactly one: `catalog.branch.write`. The
shipped `CAPABILITY_MATRIX` agrees with it — `iam/permissions.ts` lines 461–477 decompose the row
into `catalog.branch.read` and `catalog.branch.write` and nothing else.

`MASTER_PRD.md` §B3.2 cannot break the tie. It is a grid of human-readable **labels** against twelve
role columns; the string `catalog.branch` appears nowhere in it. Both documents are rank 3, and
`CLAUDE.md` §9.3 forbids reconciling them in code.

## Two further disagreements ride on the same row

- **Who may list branches.** `Gym.md` line 167 and `GymDashboard.md` line 988 grant the list to
  `GYM_MANAGER`, `RECEPTIONIST` and `TRAINER`. `§B3.2` row 20 grants the capability to `GYM_OWNER`
  and `SUPER_ADMIN` only. Picking `catalog.branch.read` — the one key both vocabularies contain —
  therefore _works_ and silently drops the three branch-scoped roles `SCR-DASH-004` is built around.
- **Which capability `PATCH` belongs to.** `Gym.md` line 170 maps it to a **different** `§B3.2` row
  (_"Edit gym profile"_) in order to give `GYM_MANAGER` a `▪`. So `catalog.branch.write` denies the
  manager, while `catalog.gym_profile.update` lets an editor of a live listing edit branches.

## What was fixable without an owner decision

`PG-7`. `Security.md` `RB3` — _"every permission string referenced by a `@RequiredPermission()`
must exist in some module's `permissions.ts`; an unknown string fails CI"_ — was specified and
absent, so a well-formed invented key passed `api-gates` and failed only at request time as
`UNKNOWN_PERMISSION`, where it reads as a permissions bug. It now fails the build. That is the
fourth occurrence of this shape (`BLK-10`, `BLK-11`, `BLK-14`, `BLK-19`) and the first one a gate
can catch.

`permissions.ts` is likewise absent from this module rather than written with a guessed vocabulary:
`onboarding/permissions.ts` reads its keys **out of** `CAPABILITY_MATRIX` by label and throws at
import if one is missing, which is the pattern to copy — and copying it today would throw, because
four of the five keys are not there to read.
