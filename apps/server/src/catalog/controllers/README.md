# `catalog/controllers/` — empty at `M-031`, and blocked rather than unfinished

`FolderStructure.md` §8.1 row 4 requires this directory once the module has any source, and §8.2
lists the only four provider-only modules — `catalog` is not one of them. `README.md` §4 says so in
the module's own words: _"`catalog/` is not one of the four provider-only modules of
`FolderStructure.md` §8.2, so `controllers/`, `dto/` and `permissions.ts` are mandatory."_

So the emptiness needs a reason rather than a shrug.

## The reason is `BLK-19` — but not the reason this file used to give

> **Corrected 2026-08-10.** This section previously said the five routes cannot declare a permission
> because _"two rank-3 documents give two different vocabularies for the same `§B3.2` row"_.
> `PHASES.md`'s own `BLK-19` row now labels that framing **"What I got wrong"**, and this file was
> still repeating it to anyone who came looking for the missing controller.

`M-031` delivers the three catalogue **tables** and two of the module's six ports. The five
tenant-facing branch routes are specified down to their request bodies in `apis/Gym.md` §12.

| Route                            | `API_Catalog.md` 940–944 · `Gym.md` §12 | In `PERMISSION_KEYS`? |
| :------------------------------- | :-------------------------------------- | :-------------------- |
| `GET /v1/tenant/branches`        | `catalog.branch.list`                   | **no**                |
| `POST /v1/tenant/branches`       | `catalog.branch.create`                 | **no**                |
| `GET /v1/tenant/branches/:id`    | `catalog.branch.read`                   | yes                   |
| `PATCH /v1/tenant/branches/:id`  | `catalog.branch.update`                 | **no**                |
| `DELETE /v1/tenant/branches/:id` | `catalog.branch.deactivate`             | **no**                |

The **right-hand column is still accurate as a fact.** What changed is what it means.

### The vocabulary question is answered, and it was answered in writing all along

`API_Catalog.md` §5.6: _"The `B3.2` matrix is expressed as **capabilities by role**; the API is
expressed as **permissions by endpoint**. The join is `permissions.ts`, and it must be exact."_ Its
column header is **"Permission string(s)"** — plural — and its own rows carry **three** keys for one
capability (_Scan / record check-in_) and two for another (_View audit log_).

So five keys deriving from one `§B3.2` row is not a conflict. **It is the documented shape.** The
old framing also treated `Security.md` §3.3.1 as a registry of all forty-two rows; spot-checking it
against the shipped matrix found the agreement is coincidental and confined to row 20 — _Browse
marketplace_, _Manage platform users_ and _Manage taxonomy_ each name a different **module** in the
two places. It is not the registry it presents itself as.

`ADR-0043` has since used this same §5.6 rule to add a third key to an existing capability, with a
gate — `an extra read key may only hang off a capability ONE role holds` — that keeps it from
becoming a way to shop for a convenient holder set.

### What is actually open: the GRANT WIDTH

- **Who may list branches.** `Gym.md` line 167 and `GymDashboard.md` line 988 grant the list to
  `GYM_MANAGER`, `RECEPTIONIST` and `TRAINER`. `§B3.2` row 19 (_Edit gym profile_) gives
  `RECEPTIONIST` and `TRAINER` both `—`, and row 20 (_Add / remove branch_) gives only `GYM_OWNER`
  and `SUPER_ADMIN`. A **rank-3** API document is granting two roles a capability the **rank-2** PRD
  gives neither.
- **Which capability `PATCH` belongs to.** `Gym.md` line 170 maps it to a _different_ `§B3.2` row
  (_Edit gym profile_) in order to give `GYM_MANAGER` a `▪`. That is the same manoeuvre `ADR-0043`
  names **capability shopping** — letting the wanted role set pick the capability rather than the
  reverse — and here a rank-3 document is doing it.

**Precedence settles both in `§B3.2`'s favour.** That is exactly why this is still blocked: it means
`SCR-DASH-004` as designed cannot be built, and dropping a screen's three branch-scoped roles is a
**product** decision under `MASTER_PRD` Part C §C10, not an engineering one.

### What this does NOT block, and previously appeared to

Two deliverables were marked blocked here by association and are not:

- **The DTOs** (`dto/{create-branch,update-branch,branch}.{request,response}.dto.ts`). A Zod schema
  declares no permission. Nothing in `BLK-19` reaches them.
- **`AC-9`'s audit write** — the append-only `audit_log` row with before/after and actor inside each
  branch-mutation use case. A use case declares no permission either; only a route does.

## What was fixable without an owner decision

`PG-7`. `Security.md` `RB3` — _"every permission string referenced by a `@RequiredPermission()`
must exist in some module's `permissions.ts`; an unknown string fails CI"_ — was specified and
absent, so a well-formed invented key passed `api-gates` and failed only at request time as
`UNKNOWN_PERMISSION`, where it reads as a permissions bug. It now fails the build. That is the
fourth occurrence of this shape (`BLK-10`, `BLK-11`, `BLK-14`, `BLK-19`) and the first one a gate
can catch — and `PG-7` cannot catch a key that is present but **over-granted**, which is what the
grant-width question above is. That is `RB2`'s job, and `RB2` remains unbuilt.

`BLK-11` has since closed (`ADR-0043`), leaving three: `BLK-10`, `BLK-14` and this one.

`permissions.ts` is likewise absent from this module rather than written with a guessed vocabulary:
`onboarding/permissions.ts` reads its keys **out of** `CAPABILITY_MATRIX` by label and throws at
import if one is missing, which is the pattern to copy — and copying it today would throw, because
four of the five keys are not there to read.
