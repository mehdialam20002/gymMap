# `@gymmap/types`

The vocabulary shared by `apps/server` and all three browser surfaces. One runtime-free package
so that a `GymId` can never be passed where a `TenantId` belongs, and an error `code` can never
be invented at a call site.

Delivered by **M-003** (EP-01 · F-01.2 · T-01.04).

## What is in here

| Module                   | Contents                                                                | Governing clause                  |
| :----------------------- | :---------------------------------------------------------------------- | :-------------------------------- |
| `ids/branded.ts`         | The twenty branded entity identifiers and their validating constructors | §9.5 B1–B3                        |
| `money.ts`               | `Money`, `MinorUnits`, `BasisPoints` — **types only**                   | BR-PAY-01, §9.5 B4/B5             |
| `currency.ts`            | `CurrencyCode` and the minor-unit exponent table                        | §10                               |
| `time.ts`                | `IanaTimeZone`, `IsoDate`, `IsoInstant`                                 | §9.5, `LAUNCH_MARKET_INDIA.md` §3 |
| `errors/registry.ts`     | The error-code registry — one `as const` object                         | §13.2.1                           |
| `errors/error-code.ts`   | `ErrorCode`, **derived** from the registry                              | §13.2, AC-4                       |
| `pagination.ts`          | `Page<T>`, `Cursor`, the §C3.1 envelope                                 | §C3.1                             |
| `enums/tenant-status.ts` | The §C4.4 states and their legal transitions                            | §C2.2, §C4.4                      |
| `schemas/common/`        | The three shapes client and server both validate                        | A-02                              |
| `api/generated/`         | **CI-written.** Never hand-edited.                                      | AC-7                              |

## The four rules this package lives by

**1 — No runtime dependency except `zod`.** Every deployable imports this package, so anything
added here ships to the browser as well as the server. `dependency-cruiser` fails a second one.

**2 — `Money` is a type, not a class.** Arithmetic lives in `packages/utils/money` and
`apps/server/src/common/money` (M-016). A method on `Money` is a review rejection: it would make
this package runtime code and pull an implementation into all four bundles.

**3 — A branded value is produced only by its validating constructor.** A bare `as TenantId`
outside this package is a review rejection (§9.5 B2). The brand key is a non-exported
`unique symbol`, so nothing else can even name it.

**4 — Money crosses JSON as a string.** Never a number.

```ts
JSON.parse('{"amountMinor":9007199254740993}').amountMinor; // → 9007199254740992
```

No error, no warning, one paise gone above 2^53 — ₹90,071,992,547.40, which a large chain's
cumulative GMV reaches. `moneySchema` therefore **rejects** a JSON number rather than coercing
it: by the time the validator sees it the precision is already lost, and accepting it would
launder the loss into a valid-looking value (TR-38, AC-FND-06.6).

## Usage

```ts
import { tenantId, moneySchema, TENANT_STATUS, canTransition } from '@gymmap/types';

const t = tenantId(row.tenant_id); // throws on a malformed id
const price = moneySchema.parse(body.price); // { amountMinor: bigint, currency }
if (!canTransition(TENANT_STATUS.DRAFT, next)) {
  /* … */
}
```

Import from the package root only. The exports map deliberately exposes `.` alone — deep imports
are what turn a leaf package into a coupling surface (§3.2).

## Testing

```bash
pnpm --filter @gymmap/types build      # specs import the built artifact
pnpm --filter @gymmap/types test:unit
```

Specs import `../dist/index.js` rather than `../src`, for two reasons. Node's native type
stripping does not resolve a `.js` specifier to a `.ts` file, and — more usefully — testing the
built output also exercises the exports map and the emit, so a broken barrel fails here rather
than in the first consumer.

`branded.type-spec.ts` is a **compile-time** test. Its assertions are `@ts-expect-error`
directives, which make `tsc` fail if the line below them does _not_ error. The file passing
`typecheck` is the proof that cross-brand assignment is genuinely rejected — no `tsd` needed.

## Adding an error code

1. Add a row to `ERROR_REGISTRY` with all seven columns. `enforces` may not be empty.
2. That is all. `ErrorCode` is derived, so the union updates itself.
3. A code is **never** renamed and **never** reused for a different meaning (§13.2.1). To retire
   one, keep the row and set `retiredInVersion`.

## Known gaps

- `api/generated/` is empty until M-008 wires the OpenAPI generation job.
- The registry holds the `common`, `tenancy` and `iam` slices only. Module milestones append theirs.
- `Milestones_000-029.md` M-003 names `IDEMPOTENCY_KEY_REUSED`; constitution §13.2.2 names
  `IDEMPOTENCY_KEY_MISMATCH` for the same condition. The constitution wins (it governs the
  registry) and the roadmap wording needs correcting — see the note in `registry.ts`.
