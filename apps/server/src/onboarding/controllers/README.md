# `onboarding/controllers/` — empty at `M-026`, and blocked rather than unfinished

`FolderStructure.md` §8.1 row 4 requires this directory once the module has any source, and §8.2
lists the only four provider-only modules — `onboarding` is not one of them. So the directory is not
optional, and its emptiness needs a reason rather than a shrug.

## The reason is `BLK-14`

`M-026` delivers the two dossier **tables**. The tenant-facing wizard routes belong to `M-027`, and
they cannot be written yet:

- `§B3.2` defines **no capability** for a tenant submitting its own onboarding application.
- Both `onboarding.*` capabilities in the matrix are the **reviewer's** — row 31 *Review KYC
  documents* and row 32 *Approve / reject gym*, held by `VERIFICATION_OFFICER` and `SUPER_ADMIN`.
- `PG-1` fails the build on a route that declares no permission, and `PermissionsGuard` refuses any
  key absent from the matrix as `UNKNOWN_PERMISSION` — correctly.

Inventing `onboarding.application.create` here is exactly what produced `BLK-10`. The near
neighbours are wrong in a dangerous direction too: `catalog.gym_profile.update` is editing a **live**
listing, which an unapproved applicant must not hold.

## What is already here

`permissions.ts` reads its keys **out of** `CAPABILITY_MATRIX` by capability label, so a renamed row
throws at import rather than shipping a key that resolves to nothing.

The reviewer-side routes do have their keys and arrive with `M-036`'s decision surface.

When `BLK-14` is answered, this file is replaced by the wizard controller.
