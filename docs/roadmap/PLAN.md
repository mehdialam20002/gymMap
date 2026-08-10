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
