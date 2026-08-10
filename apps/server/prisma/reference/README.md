# `prisma/reference/` — the source of truth a human edits

`SeedStrategy.md` `RD4`: _"`prisma/reference/*.csv` and `*.json` are the source of truth a human
edits. `pnpm ref:generate` emits the migration SQL. A hand-edited migration whose content does not
match the data file fails `reference-data-drift`."_

`SEP1` is the rule above it: reference data (`K1`) is **only ever created by a versioned
migration**. There is no reference-data seed script. These files are the input to a migration, never
something applied at runtime.

## What is here, and what is not

| File                 | Rows specified | Rows present | Why                                                                                                                                                                                                                           |
| :------------------- | :------------: | :----------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `countries.csv`      |   20 (§1.4)    |    **1**     | Only the India row has every column fixed — `SeedStrategy.md` §3.1 gives it as an explicit `INSERT`. Of the nineteen inactive countries §3.1 asks for, five are named with values and fourteen are not named at all. `BLK-21` |
| `cities.csv`         |   120 (§1.4)   |      —       | §3.6 fixes twelve slugs with their GST state code, `status = PLANNED` and `Asia/Kolkata`. It fixes **no** display `name` and **no** `centroid`, and `Schema.md` §12.1 makes both `NOT NULL`. `BLK-21`                         |
| `amenities.csv`      |   59 (§1.4)    |      —       | §3.7 fixes all 59 **keys** in six display groups and not one `name`, `icon` or `sort_order`. `Epic_04.md` line 349 calls the taxonomy content an unmade client decision. `BLK-21`                                             |
| `gym-categories.csv` |   15 (§1.4)    |      —       | Same: 15 keys fixed, no `name`, no `slug`. `BLK-21`                                                                                                                                                                           |
| `localities.csv`     |      ~120      |      —       | §3.6 enumerates zero. `BLK-21`                                                                                                                                                                                                |
| `india-states.csv`   |       38       |      —       | §3.6 fixes all 38 GST codes with names — but `india_state_codes` is **not** one of the sixteen tables of §2.1, so `RD3` forbids a migration writing it. The table has no home.                                                |

**The empty rows are the honest state, not a to-do.** Inventing 74 display names, 59 icons, 15 slugs
and 12 coordinate pairs would produce a populated database and a wrong vocabulary, and a wrong
vocabulary is invisible — every filter would work, against terms nobody chose.

## The id is derived, never written

`RD2`: `uuid_v5(NS_REFERENCE, '<table>:<business-key>')`, with
`NS_REFERENCE = 3f8a2d10-0000-5000-b000-000000000000`. So a CSV never carries an `id` column — the
business key is in the file and the uuid falls out of it, which is what makes India the same row in
every environment and lets `SEP9`'s drift check be a set comparison rather than a semantic diff.

`referenceUuid()` in `prisma/seed/roles.ts` is the one implementation, and
`test/seed-namespaces.spec.ts` pins the namespace against both documents that fix it.

## `created_at` and `updated_at` are not in these files

They are `DEFAULT now()`, so they differ between environments by design — which is exactly why
§2.7's drift hash excludes them. A CSV column for either would make every environment drift from
every other on the first day.
