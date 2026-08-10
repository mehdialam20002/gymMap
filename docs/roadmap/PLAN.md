# EXECUTION_PLAN — how the remaining 89 milestones get built, and in what order

> **Rank 4. This is a plan of work, never a source of requirements.**
>
> It lives in `docs/roadmap/` deliberately. `CLAUDE.md` §2 places this folder below
> `docs/engineering|database|apis|ui/`, and putting an execution plan at the root of `docs/` would
> invite the next reader to treat its sequencing as binding. It is not. Where this document and any
> higher one disagree, the higher one wins and this file is wrong.
>
> **What it is:** the order I will work in, derived from the roadmap's own sprint bands and from
> what is actually buildable today.
> **What it is not:** a change to scope, to milestone content, or to the sprint assignments in
> `Milestones_000-029.md` … `Milestones_090-119.md`. Those remain the authority.

---

## 1. Where the project actually is

Counted from `docs/PHASES.md` and the roadmap on 2026-08-10, not estimated.

| | Count |
| :--- | ---: |
| Milestones defined | **120** — `M-001` … `M-120`, contiguous, no duplicates |
| Complete ✅ | **24** |
| Partial 🟨 | **7** |
| Not started | **89** |
| Blockers raised | 21 |
| Blockers resolved | **11** |
| Blockers open | **10** |
| Known limitations · tech debt · ADRs | 111 · 71 · 11 sections |

Documentation phases 0–7 and G are `DONE`. Phase 8 is the only one running.

**The seven partial ones are partial for one reason each, and none of them is unfinished code.**
Every one has its backend built and proved against real PostgreSQL; what each still owes is a
route, a document, or an answer.

---

## 2. The thirteen open blockers, triaged

This is the part that decides the order of everything else. A blocker is not a to-do — it is a
question, and the two kinds have very different costs.

### 2a. Four need somebody who is not me (and not the codebase)

| Blocker | The question | Who |
| :--- | :--- | :--- |
| **BLK-04** | TCS/TDS applicability and rates, the SAC code, multi-state GST registration, RBI e-mandate thresholds, Aadhaar handling, DPDP significant-data-fiduciary status | Indian tax advisor + legal counsel |
| **BLK-09** | `A-31` malware scanner and `A-32` breached-password corpus — both inside the contested `A-31…A-39` block | Project owner, as a stack addition |
| **BLK-19** | **Do `RECEPTIONIST` and `TRAINER` see the branch list?** `Gym.md` says yes; `§B3.2` gives both `—` | Owner + Product, under `§C10` |
| **BLK-16** | Does the KYC enclave get a platform redirect endpoint, or does one of `KY2` / `Admin.md` 753 give way? | Owner + Security |

**These four are the real ceiling.** `BLK-04` alone gates every invoice, every settlement and every
payout — Sprints 5, 6, 11 and 12. No amount of engineering removes it.

### 2b. Six are document questions I can research and decide

`BLK-03` · `BLK-05` · `BLK-08` · `BLK-10` · `BLK-14` · `BLK-17`

Eight of this kind have now been closed — `BLK-12`, `BLK-15`, `BLK-18`, `BLK-20`, `BLK-21`, and on
2026-08-10 also **`BLK-11`** (`ADR-0043`), **`BLK-13`** (`ADR-0044`) and **`BLK-07`** (`ADR-0045`).
**Six of the eight were mis-framed rather than genuinely contested.** Each had been recorded as
"two documents disagree" when the two were not the same rank, when one side was an example rather
than a rule, or — twice now — when a search ran against the wrong file:

| Blocker | What it was recorded as | What it actually was |
| :--- | :--- | :--- |
| `BLK-12` | Constitution vs two feature documents | Rank 1 vs two files not conforming to it |
| `BLK-18` | A schema decision needing the owner | The grants already said what the policy should be |
| `BLK-20` | Two rank-3 documents, two alphabets | Every alpha occurrence was inside `illustrative — not committed code`; and a constraint recorded as absent existed under a reversed name |
| `BLK-21` | A client decision withholding the taxonomy | A rank-4 backlog file **asking** for the placeholder |
| `BLK-13` | Rank-3 spec vs a conflicting requirement | Rank-3 spec vs a **rank-5 test file** — precedence, not conflict |
| `BLK-07` | Two documents citing a register that does not exist | It exists. **There are two files named `ERD.md`**, and the search ran against the other one |

That is the single most useful fact in this plan: **the blocker list overstates how blocked the
project is.** Two habits account for all six — the rank check belongs *before* the word "conflict"
is written down, and **one spelling, or one file, is not a search.**

**Closing a blocker is not bookkeeping.** `BLK-07`'s enum refused `KycDocument` on the day it
landed — a value the shape `CHECK` had accepted for weeks, in committed code, pinned by a test.

---

## 2c. THE SEVEN PARTIALS, AS PHASES — written 2026-08-10, and this is the working queue

The owner asked for the remaining partials broken into phases with the work named. This section is
that. It supersedes nothing below: §3's five phases are the shape of the whole roadmap, and this is
the shape of the seven milestones sitting at the front of it.

**Ordered by what unblocks what, not by milestone number.** Every item is `FREE` — nothing stops it
today — or names its blocker. The percentages are the verified audit's, not estimates.

---

### Phase P1 — M-023 RBAC · 70% → done

The guard is bound as of `c9c851e`, which was the hard part. What is left is all free.

| Deliverable | State |
| :--- | :--- |
| `GET /admin/users/:id/permissions` (`FR-RBAC-05`) — a cross-tenant grants port, its Prisma adapter, a use case, the route | FREE. `annotatedEffectivePermissions()` and `inspectPermission()` exist and are tested; what is missing is a reader for one user's grants ACROSS tenants, which needs `runElevated()` |
| `docs/features/rbac.md` — §21.3's five sections plus `DG3`'s sequence diagram | FREE since `ADR-0041` |
| A `ResourceTenantGuard` unit spec | FREE. The file has 126 lines and **zero** test references |
| `rbac.contract-spec.ts` — 403 envelopes carry a registry code and a correlation id | FREE |

**Exit:** `M-023` is `✅`. The nearest milestone to done in the project.

---

### Phase P2 — M-024 MFA · 70% → done, and the seed that gates it

| Deliverable | State |
| :--- | :--- |
| **Give the eleven seeded principals a password** | FREE, and it gates the row below. `prisma/seed/users.ts` leaves `password_hash` NULL on all eleven; enrolment re-authenticates against that hash, so no seeded account can enrol MFA today |
| Register `MfaGuard` | Blocked on the row above and on nothing else. `permissions-guard-registered.spec.ts` asserts its absence — delete that test in the commit that binds it |
| `docs/features/mfa.md` | FREE |
| `mfa.contract-spec.ts` · `staff-login-requires-mfa.int-spec.ts` | FREE |
| `amr` / `auth_time` per-session freshness | **Stays `KL-102`.** Not part of this exit |

**Exit:** `M-024` is `✅`, and `NFR-SEC-11`'s mandatory staff second factor actually runs.

---

### Phase P3 — M-025 Impersonation · 45% → done

Almost all of it is built and **inert** — `TD-047`. Ordered behind P1 deliberately: lifting the
token check without a bound `PermissionsGuard` would have granted the session the subject's FULL
permission set, the union-by-omission `AC-5` forbids. That guard is now bound, so this is open.

| Deliverable | State |
| :--- | :--- |
| `AccessTokenVerifier` accepts `typ: 'IMPERSONATION'`, with structural checks and fail-closed on a truncated claim | FREE. Today it refuses, so `POST /auth/impersonate/end` cannot be called with the token its own contract requires |
| Register `ImpersonationRestrictionGuard` | FREE |
| Open the ALS frame per request — `runAsImpersonator` has no production caller | FREE |
| Wire `mayElevate()` and `impersonationExpired()`, both dead outside their unit tests | FREE |
| `docs/features/impersonation.md` · `impersonation.contract-spec.ts` · two int-specs | FREE |

**Exit:** `M-025` is `✅`, and a session can be started, used and ended.

---

### Phase P4 — M-031 catalogue · 30% → done

`BLK-19` closed, so the five branch routes are buildable. `catalog/permissions.ts` shipped in
`d2cfc7b`. **Nothing in this phase is blocked.**

| Deliverable | State |
| :--- | :--- |
| `dto/` — three Zod request/response pairs | FREE |
| Four use cases — create, update, deactivate, list — plus specs | FREE |
| `gym.prisma-repository.ts` + Testcontainers int-spec; the write half of `branch.prisma-repository.ts` | FREE |
| `branch.controller.ts` — five routes, each declaring a `CATALOG_PERMISSIONS` key | FREE |
| `AC-9`'s audit row inside each mutation | FREE |
| `catalog.seed.ts`, `SEED_VERSION` → `0.5` | FREE |
| `EXPLAIN` baseline for `ST_DWithin` · `postgis-radius.int-spec.ts` · `one-primary-per-gym.int-spec.ts` | FREE |
| `docs/database/catalog.md` · `docs/apis/api-ten-catalog.md` | FREE |

**Exit:** `M-031` is `✅`.

---

### Phase P5 — M-027 wizard · 20% → done

`BLK-14` closed and `onboarding/permissions.ts` carries the tenant's five keys. Today the milestone
is a step enum and a normaliser, and nothing else.

| Deliverable | State |
| :--- | :--- |
| `packages/types/src/schemas/onboarding.schema.ts` — one Zod schema per step | FREE |
| `business-identity.vo.ts` · `onboarding.errors.ts` | FREE |
| `save-wizard-step` · `get-wizard-state` · `validate-step` use cases + specs | FREE |
| `wizard-draft.prisma-repository.ts` — the draft IS `applications` at `version = 0` | FREE |
| `dto/` and the routes | FREE |
| `AC-8`'s audit row per step save | FREE |
| `docs/features/onboarding-wizard.md` | FREE |
| **`POST /tenants` — wizard step 1** | **BLOCKED.** Declares `tenancy.tenant.create`, which is in no matrix row. A second `BLK-14`-shaped hole, not yet raised as one |

**Exit:** steps 2–6 work end to end. Step 1 needs one more `§C10` row.

---

### Phase P6 — M-029 KYC · 45% → done

`A-42` landed, so documents can be scanned at all. Two things still are not free.

| Deliverable | State |
| :--- | :--- |
| Bind a real MinIO `ObjectStoragePort` adapter | FREE. MinIO already runs; the port answers `UNAVAILABLE` |
| Checklist-membership check on upload (`KYC_DOCUMENT_TYPE_NOT_IN_CHECKLIST`) | FREE |
| Supersession on re-upload · the `audit_log` row · populate `kyc_checklists_id` | FREE |
| Sharp renditions + EXIF stripping | FREE — `A-17` is approved |
| The reviewer read path, `GET .../documents/:id/view` | **`BLK-16`.** The two-hop design exists (`GETDEL`, `appendOrThrow`) and came back PROCEED WITH CHANGES |
| `kyc-storage-segregation.int-spec.ts` | Follows the row above |

**Exit:** an owner can upload and a reviewer can open. `E2E-01` becomes reachable.

---

### Phase P7 — M-030 pre-checks · 62% → done

| Deliverable | State |
| :--- | :--- |
| Bind the real `DuplicateAddressProbe` — its dependency (`gyms`, `branches`) shipped at M-031 | FREE. Today one of six checks reports `ERROR` on every submission |
| Bind a `GEOCODING_PORT` adapter with recorded fixtures | FREE — `DEP-02`; fixtures need no vendor |
| The composition root that assembles the six and runs them at submission | FREE |
| A `MetricsPort` emitting `precheck_outcome_total` | FREE |
| `cross-tenant-prechecks.int-spec.ts` · `duplicate-address.check.int-spec.ts` | FREE |
| The persistence shape and the duplicate register | **`BLK-22`.** The design came back **feature-dead as drafted**: a `SECURITY DEFINER` function owned by `app_migrator` under `FORCE` RLS sees zero rows, and every duplicate check would silently report `PASS` |
| `AC-10`'s `job_runs` record | **`BLK-08`** — deferred by the owner |

**Exit:** four checks run and persist. Two wait on `BLK-22`.

---

### What this queue is honest about

**It is not one sitting, and saying otherwise would be the easy lie.** P1 alone is four deliverables
including a new port, adapter, use case and route. P4 is eight and P5 is eight. Added up, the seven
partials are most of Sprints 1 and 2.

**Three phases are fully free** — P1, P3, P4 — and P1 finishes the nearest milestone in the project.
**Two are free but gated on one small thing each:** P2 on the seed, P6 on `BLK-16`. **P5 and P7
complete except for one item each**, and both of those need an owner decision.

**Order: P1 → P4 → P3 → P2 → P5 → P7 → P6.** Free-and-finishable first; owner-gated last; and the
two decisions raised early enough that the answer arrives before the work that needs it.

---

## 3. The five execution phases

Grouped by what unblocks what, not by calendar. Each phase's exit condition is a fact somebody can
check, not a judgement.

### Phase A — clear the nine internal blockers · *no milestone dependency*

Work each of the nine through the discipline in §4. Expected outcome, based on today's five: most
resolve on precedence or on a misreading; one or two are genuine and get an ADR; any that turn out
to need the owner move to §2a and this plan says so plainly rather than quietly carrying them.

**Exit:** every one of the nine is either resolved with an ADR, or reclassified as external with
the question stated in one sentence.

**Why first:** `BLK-10`, `BLK-11` and `BLK-14` gate routes on three of the seven partial
milestones. Nothing else in the plan is as cheap per milestone unblocked.

### Phase B — finish the seven partial milestones

| Milestone | What it owes |
| :--- | :--- |
| `M-023` RBAC | `docs/features/rbac.md` (unblocked today by `ADR-0041`), the `FR-RBAC-05` endpoint (`BLK-11`), global guard registration (`BLK-10`) |
| `M-024` MFA | `docs/features/mfa.md`; `amr` per-session freshness stays `KL-102` |
| `M-025` Impersonation | `docs/features/impersonation.md` |
| `M-027` Wizard | The tenant-facing routes (`BLK-14`) |
| `M-029` KYC | Upload use cases and routes (`BLK-14`, `BLK-17`); the PDF rendition needs a rasteriser with no `A-NN` row |
| `M-030` Pre-checks | The geocoding ACL and its recorded fixtures (`DEP-02`, no vendor); `precheck_outcome_total` (no metrics facility yet) |
| `M-031` Catalogue | `catalog/` use cases and repositories, `SEED_VERSION 0.6`, `docs/database/catalog.md`; five branch routes (`BLK-19`) |

**Exit:** each of the seven is `✅ DONE`, or its remaining item is an entry in §2a with the
milestone marked `BE DONE` and the reason cited.

**Note the shape:** three of the seven are waiting on a *document* that `ADR-0041` unblocked this
morning. Those are writable now.

### Phase C — the marketplace becomes usable · `M-032` … `M-050`

Sprints 2–4. Catalogue completion, the price authority, discovery and ranking. This is the first
phase whose output a member could actually use: search a city, open a gym, see a price.

**Prerequisite from Phase A:** `BLK-19`'s answer, because every tenant-facing catalogue route
needs a permission key.

**Exit:** `E2E-01` (a gym gets verified and listed) and the `EP-06a` discovery gates.

### Phase D — money · `M-051` … `M-103`

Sprints 5–12. Orders, Razorpay Route, the webhook, invoices, the membership lifecycle, check-in,
staff, reviews, the ledger, settlements, refunds.

**This is the largest phase and the most gated.** `BLK-04` sits across all of it: the tax
questions are not engineering questions and the architecture already holds them as configuration,
so resolution is a data task — but until the numbers exist, invoices cannot be correct and
settlements cannot be reconciled.

**Recommended split, so the phase is not one long block:**

- **D1 · `M-051` … `M-060`** — orders and money-in. Buildable against the `FakePaymentProvider`
  (`FR-PAY-12`) with no Razorpay account, which is the point of that milestone.
- **D2 · `M-061` … `M-076`** — memberships and check-in. Depends on D1's activation path but not
  on any external party.
- **D3 · `M-077` … `M-090`** — staff, CRM, reviews, the ledger foundations.
- **D4 · `M-091` … `M-103`** — settlement completion, refunds and disputes. **Needs `BLK-04`.**

**Exit:** `E2E-07`, `E2E-08` and `E2E-12` pass with zero variance.

### Phase E — the rest · `M-104` … `M-120`

Sprints 13–18. Reporting, notifications, support, the admin console, hardening, UAT, launch.
`M-118` is hardening, `M-119` is UAT, `M-120` is launch — and sprints 16–18 carry deliberately
unfilled reserve (`R-M16`) for pen-test remediation and defect fixes, which this plan does not
try to consume.

**Exit:** `BAC-01` … `BAC-15`.

---

## 4. The discipline each milestone goes through

Not a style preference. Every item below caught a real defect in this project on 2026-08-10, and
the ones that caught the worst defects are marked.

1. **Read the binding documents first**, in the precedence order. Cite the identifiers.
2. **When two documents appear to disagree, check their RANK before calling it a conflict.**
   ★ Four of five blockers closed today were mis-framed at exactly this step.
3. **Never conclude an absence from one spelling.** ★ `BLK-20` recorded a constraint as
   "never created"; it existed under a reversed name.
4. **Prove it against real PostgreSQL, as the deployed role.** ★ `BLK-18` — every audit write
   failed for four milestones, invisible because the local fallback is a superuser and superusers
   bypass RLS.
5. **Put a recommendation through an adversary before signing it.** ★ The permission-vocabulary
   decision came back with four latent privilege escalations and was refused.
6. **A test asserts an absence loudly, or it asserts nothing.** A gate that skips must say so;
   "0 checked" and "all fine" must never print the same line.
7. **Record every decision as an ADR, every gap as `KL-` or `TD-`.** There is no third option.
8. **When a recommendation widens access, refuse it.** Narrowing is always safe; widening is not.

---

## 5. What makes me stop and ask

Stated in advance so it is a rule and not a mood.

- A decision that **widens** who can do something, where the documents do not force it.
- Anything that would **destroy data the owner is using** — the dev database reset that `TD-041`
  needs is the live example, and it is why that debt is still open.
- A **new dependency** with no `A-NN` row. `CLAUDE.md` §5 makes this a review blocker, not a
  judgement call.
- A decision whose **permanent part** is what is in question. `ADR-0042` shipped a taxonomy because
  the keys were fixed and only the display layer was open; `BLK-19` was refused because the thing
  being decided was the permanent part.
- **Money, tax or legal** numbers. `BLK-04` is the whole of §2a for a reason.

---

## 6. The honest caveat about this plan

Eighty-nine milestones is not a sprint's work, and no ordering makes it one. What this document
fixes is the *sequence* and the *stopping conditions* — not the size.

Two things would change the shape of it more than any engineering decision:

1. **`BLK-04`.** Until an Indian tax advisor answers six questions, Phase D4 cannot complete and
   Phase D1–D3 build against numbers that may move.
2. **`OQ-20`.** No cloud provider is approved, so `infra/terraform/` is empty and nothing in this
   plan reaches an environment anyone else can see. `DP12` fixes that every byte stays in India;
   `Deployment.md` names no vendor, deliberately.

Both are asks, not blockers I can engineer around, and both are cheaper to answer now than at the
end of Phase D.

And one defect found while building this plan, recorded here because it changes Phase D:

**`payout_accounts` is created by no milestone.** `Schema.md` §4.4 specifies the table in full —
`ifsc`, `is_primary`, the partial unique index, the RLS key. `API_Catalog.md` 987–988 freezes `GET`
and `PUT /tenant/payout-account` against `FR-ONB-06`. `§B3.2`'s *Change payout bank account* is
shipped in `CAPABILITY_MATRIX`. And the string `payout_accounts` appears **zero times** across all
four `Milestones_*.md` files. Nothing creates it, so `FR-ONB-06` has no delivering milestone. Same
class as the `SCR-ADM-006` gap already in `PHASES.md` — the roadmap is a *"structural spine, not a
complete build plan"* (`README.md` §9.3) — but this one is a register table with two frozen
endpoints, and it is on the money path.

Two related findings from the same sweep, both **less severe than they first looked**, and stated
that way because overstating a gap costs as much as missing one: `commission_rules` **is** created,
at `Milestones_090-119.md` 1650 with a full migration spec — late (Sprint 14) relative to the
milestones that reason about commission, but present. `tax_profiles` appears once and only inside a
*negative* clause — *"no read path joins to `tax_profiles`"* — so it is referenced without being
created, which is a smaller gap than `payout_accounts` and lands inside `BLK-04`'s territory anyway.
