# `common/application/ports` — intentionally empty, and it used to be worse than empty

`FolderStructure.md` §8.1 row 7 makes `application/ports/` mandatory on every module: a module's
outbound dependencies are ports, never concrete classes.

**`common/` has none.** It is the shared kernel — every other module depends on it and it depends
on nothing. That is what makes it safe to import from twenty-two places without a cycle.

The directory exists rather than being omitted so that the absence is a stated fact rather than an
oversight, exactly as [`audit/application/ports/README.md`](../../../audit/application/ports/README.md)
does for the same reason.

## What was here, and why it was removed (M-020)

Until M-020 this directory held `clock.port.ts` and `id-generator.port.ts` — a **second** pair of
`CLOCK` and `ID_GENERATOR` tokens, alongside the real ones in
[`../../clock/clock.port.ts`](../../clock/clock.port.ts).

|                                  | `common/application/ports/` (deleted) | `common/clock/` (real)            |
| :------------------------------- | :------------------------------------ | :-------------------------------- |
| `CLOCK`                          | `Symbol('Clock')`                     | a **different** `Symbol('Clock')` |
| `Clock`                          | `{ now(): Date; nowMs(): number }`    | `{ now(): Date }`                 |
| Registered by `CommonModule`?    | **no**                                | yes                               |
| Exported from `common/index.ts`? | **yes**                               | no                                |

So the module's _public surface_ advertised a token that no provider answered. A consumer doing
the obvious thing — `import { CLOCK } from '../common/index.js'` — would have compiled cleanly,
passed typecheck, passed lint, and failed at **runtime** with `Nest can't resolve dependencies`.
Two `Symbol()` calls with the same description are distinct values, and nothing about the two
files looks wrong side by side.

It never fired because every consumer built so far reaches into `common/clock/clock.port.js`
directly. M-020 would have been the first to use the barrel.

The duplicates are deleted and `common/index.ts` re-exports the registered pair.
`common-barrel.spec.ts` asserts the exported symbols are **identical by reference** to the ones
`CommonModule` registers — the only check that catches this, because every structural comparison
between the two versions passed.

## If a port ever does belong here

It would be something `common/` itself calls outward — and there is nothing above `common/` to
call. A genuine case would more likely mean the code belongs in the module that owns the
dependency, not in the shared kernel.
